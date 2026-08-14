import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import Holiday from "../models/Holiday.js";
import Salary from "../models/Salary.js";

const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;

function range(month, year) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1))
  };
}

export async function employees(req, res) {
  res.json({ success: true, employees: await Employee.find().sort({ name: 1 }) });
}

export async function createEmployee(req, res) {
  const employee = await Employee.create(req.body);
  res.status(201).json({ success: true, employee });
}

export async function updateEmployee(req, res) {
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true
  });
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found." });
  res.json({ success: true, employee });
}

export async function attendance(req, res) {
  const query = {};
  if (req.query.employeeId) query.employeeId = req.query.employeeId;
  if (req.query.from || req.query.to) {
    query.date = {};
    if (req.query.from) query.date.$gte = new Date(req.query.from);
    if (req.query.to) query.date.$lt = new Date(req.query.to);
  }
  res.json({
    success: true,
    attendance: await Attendance.find(query)
      .populate("employeeId", "employeeCode name")
      .sort({ date: 1 })
  });
}

export async function saveAttendance(req, res) {
  const data = {
    ...req.body,
    date: new Date(req.body.date),
    overtimeHours: n(req.body.overtimeHours)
  };
  const row = await Attendance.findOneAndUpdate(
    { employeeId: req.body.employeeId, date: data.date },
    data,
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ success: true, attendance: row });
}

export async function leaves(req, res) {
  const q = req.query.employeeId ? { employeeId: req.query.employeeId } : {};
  res.json({
    success: true,
    leaves: await Leave.find(q).populate("employeeId", "employeeCode name").sort({ fromDate: -1 })
  });
}

export async function createLeave(req, res) {
  const from = new Date(req.body.fromDate);
  const to = new Date(req.body.toDate);
  const days = Math.max(0.5, Math.floor((to - from) / 86400000) + 1);
  const leave = await Leave.create({ ...req.body, fromDate: from, toDate: to, days });
  res.status(201).json({ success: true, leave });
}

export async function leaveStatus(req, res) {
  const leave = await Leave.findByIdAndUpdate(
    req.params.id, { status: req.body.status }, { new: true, runValidators: true }
  );
  if (!leave) return res.status(404).json({ success: false, message: "Leave not found." });
  res.json({ success: true, leave });
}

export async function holidays(req, res) {
  res.json({ success: true, holidays: await Holiday.find().sort({ date: 1 }) });
}

export async function createHoliday(req, res) {
  const holiday = await Holiday.create({ ...req.body, date: new Date(req.body.date) });
  res.status(201).json({ success: true, holiday });
}

export async function generateSalary(req, res) {
  const month = n(req.body.month);
  const year = n(req.body.year);
  const employee = await Employee.findById(req.body.employeeId);
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found." });

  const { start, end } = range(month, year);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const [att, holidays] = await Promise.all([
    Attendance.find({ employeeId: employee._id, date: { $gte: start, $lt: end } }),
    Holiday.find({ date: { $gte: start, $lt: end } })
  ]);

  const holidaySet = new Set(holidays.map(x => new Date(x.date).toISOString().slice(0, 10)));
  const byDate = new Map(att.map(x => [new Date(x.date).toISOString().slice(0, 10), x]));

  let workingDays=0,presentDays=0,halfDays=0,paidLeaveDays=0,absentDays=0,holidayDays=0,weekOffDays=0,overtimeHours=0;

  for (let d=1; d<=days; d++) {
    const date = new Date(Date.UTC(year, month-1, d));
    const key = date.toISOString().slice(0,10);
    if (holidaySet.has(key)) { holidayDays++; continue; }
    if (date.getUTCDay() === 0) { weekOffDays++; continue; }

    workingDays++;
    const a = byDate.get(key);
    if (!a) { absentDays++; continue; }

    if (a.status === "Present") presentDays++;
    else if (a.status === "Half Day") halfDays++;
    else if (a.status === "Leave") paidLeaveDays++;
    else if (a.status === "Absent") absentDays++;
    else if (a.status === "Holiday") holidayDays++;
    else if (a.status === "Week Off") weekOffDays++;
    overtimeHours += n(a.overtimeHours);
  }

  const allowanceTotal = employee.allowances
    ? [...employee.allowances.values()].reduce((s,v) => s+n(v), 0)
    : 0;

  const basic = n(employee.basicSalary);
  const perDay = workingDays ? basic / workingDays : 0;
  const attendancePay = (presentDays + paidLeaveDays + halfDays * 0.5) * perDay;
  const unpaidDeduction = absentDays * perDay;
  const overtimeRate = n(req.body.overtimeRate) || (basic / 26 / 8 * 1.5);
  const overtimeAmount = overtimeHours * overtimeRate;
  const bonus = n(req.body.bonus);
  const deductions = unpaidDeduction + n(req.body.deductions);
  const grossSalary = attendancePay + allowanceTotal + overtimeAmount + bonus;
  const netSalary = Math.max(0, grossSalary - deductions);

  const salary = await Salary.findOneAndUpdate(
    { employeeId: employee._id, month, year },
    {
      employeeId: employee._id, month, year, workingDays, presentDays, halfDays,
      paidLeaveDays, unpaidLeaveDays: 0, absentDays, holidayDays, weekOffDays,
      basicSalary: basic, attendancePay, allowances: allowanceTotal,
      overtimeAmount, bonus, deductions, grossSalary, netSalary, status: "Processed"
    },
    { upsert: true, new: true, runValidators: true }
  );

  res.json({ success: true, salary });
}

export async function salaries(req, res) {
  const q = {};
  if (req.query.employeeId) q.employeeId = req.query.employeeId;
  if (req.query.month) q.month = n(req.query.month);
  if (req.query.year) q.year = n(req.query.year);

  res.json({
    success: true,
    salaries: await Salary.find(q)
      .populate("employeeId", "employeeCode name department designation")
      .sort({ year: -1, month: -1 })
  });
}

export async function salarySlip(req, res) {
  const salary = await Salary.findById(req.params.id)
    .populate("employeeId", "employeeCode name email mobile department designation joiningDate");
  if (!salary) return res.status(404).json({ success: false, message: "Salary record not found." });
  res.json({ success: true, salary });
}
