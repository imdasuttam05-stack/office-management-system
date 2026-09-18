import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import Holiday from "../models/Holiday.js";
import Salary from "../models/Salary.js";
import PayrollSetting from "../models/PayrollSetting.js";
import Company from "../models/Company.js";

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

export async function payrollOptions(req, res) {
  let settings = await PayrollSetting.findOne({ key: "default" }).lean();
  if (!settings) settings = await PayrollSetting.create({ key: "default" });
  const companies = await Company.find({ status: "Active" }).sort({ name: 1 }).lean();
  const existingCompanyNames = await Employee.distinct("companyName", { companyName: { $nin: ["", null] } });
  const envCompanies = String(process.env.COMPANY_NAMES || "").split(",").map(x => x.trim()).filter(Boolean);
  const companyNames = [...new Set([...companies.map(x => x.name), ...existingCompanyNames, ...envCompanies])].sort((a,b) => a.localeCompare(b));
  res.json({
    success: true,
    companies: companyNames,
    settings: {
      basicPercent: Number(settings.basicPercent ?? 60), hraPercent: Number(settings.hraPercent ?? 20),
      daPercent: Number(settings.daPercent ?? 10), conveyancePercent: Number(settings.conveyancePercent ?? 5),
      otherAllowancePercent: Number(settings.otherAllowancePercent ?? 0), gratuityPercent: Number(settings.gratuityPercent ?? 4.81),
      pfPercent: Number(settings.pfPercent ?? 12), esiPercent: Number(settings.esiPercent ?? 0.75),
      employerPfPercent: Number(settings.employerPfPercent ?? 12), employerEsiPercent: Number(settings.employerEsiPercent ?? 3.25),
      hraBase: settings.hraBase ?? "gross", daBase: settings.daBase ?? "gross", conveyanceBase: settings.conveyanceBase ?? "gross",
      otherAllowanceBase: settings.otherAllowanceBase ?? "gross", gratuityBase: settings.gratuityBase ?? "basic",
      pfBase: settings.pfBase ?? "gross", pfCeilingEnabled: settings.pfCeilingEnabled !== false, pfWageCeiling: Number(settings.pfWageCeiling ?? 15000),
      esiBase: settings.esiBase ?? "gross", esiCeilingEnabled: settings.esiCeilingEnabled !== false, esiWageCeiling: Number(settings.esiWageCeiling ?? 21000),
      stateRules: settings.stateRules || {},
    },
    states: ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh"],
    departmentOptions: ["HR","Accounts","Sales","Purchase","Operations","Warehouse","Admin","IT"],
    designationOptions: ["Manager","Executive","Officer","Supervisor","Assistant","Accountant","Sales Executive","Worker"],
    employeeTypeOptions: ["Permanent","Temporary","Contract","Part Time","Trainee"]
  });
}

export async function savePayrollOptions(req, res) {
  const keys = ["basicPercent","hraPercent","daPercent","conveyancePercent","otherAllowancePercent","gratuityPercent","pfPercent","esiPercent","employerPfPercent","employerEsiPercent","pfWageCeiling","esiWageCeiling"];
  const data = {};
  for (const key of keys) if (req.body?.[key] !== undefined) data[key] = n(req.body[key]);
  for (const key of ["hraBase","daBase","conveyanceBase","otherAllowanceBase","gratuityBase","pfBase","esiBase"])
    if (req.body?.[key] !== undefined) data[key] = String(req.body[key]);
  for (const key of ["pfCeilingEnabled","esiCeilingEnabled"])
    if (req.body?.[key] !== undefined) data[key] = Boolean(req.body[key]);
  if (req.body?.stateRules && typeof req.body.stateRules === "object") {
    const cleaned = {};
    for (const [state, rule] of Object.entries(req.body.stateRules)) {
      if (!rule || typeof rule !== "object") continue;
      cleaned[state] = {};
      for (const key of STATE_RULE_KEYS) {
        if (rule[key] === undefined) continue;
        if (key.endsWith("Percent") || key.endsWith("Ceiling")) cleaned[state][key] = n(rule[key]);
        else if (key.endsWith("Enabled")) cleaned[state][key] = Boolean(rule[key]);
        else cleaned[state][key] = String(rule[key]);
      }
      if (rule.pfWageCeiling !== undefined) cleaned[state].pfWageCeiling = n(rule.pfWageCeiling);
      if (rule.esiWageCeiling !== undefined) cleaned[state].esiWageCeiling = n(rule.esiWageCeiling);
    }
    data.stateRules = cleaned;
  }
  const structure = [data.basicPercent,data.hraPercent,data.daPercent,data.conveyancePercent,data.otherAllowancePercent].reduce((a,b)=>a+(Number.isFinite(b)?b:0),0);
  if (structure > 100) return res.status(400).json({success:false,message:"Basic + HRA + DA + Conveyance + Other Allowance percentages cannot exceed 100%."});
  const settings = await PayrollSetting.findOneAndUpdate({key:"default"},{$set:data,$setOnInsert:{key:"default"}},{upsert:true,new:true,runValidators:true});
  res.json({success:true,settings});
}

export async function createCompany(req, res) {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ success: false, message: "Company name is required." });
  try { const company = await Company.create({ name }); res.status(201).json({ success: true, company }); }
  catch (error) { if (error?.code === 11000) return res.status(409).json({ success: false, message: "Company already exists." }); throw error; }
}

function baseAmount(base, gross, basic, da) {
  if (base === "basic") return basic;
  if (base === "basicDa") return basic + da;
  return gross;
}

const STATE_RULE_KEYS = [
  "basicPercent","hraPercent","daPercent","conveyancePercent","otherAllowancePercent",
  "gratuityPercent","pfPercent","esiPercent","employerPfPercent","employerEsiPercent",
  "hraBase","daBase","conveyanceBase","otherAllowanceBase","gratuityBase","pfBase",
  "pfCeilingEnabled","pfWageCeiling","esiBase","esiCeilingEnabled","esiWageCeiling"
];

function effectivePayrollSettings(settings, state) {
  const common = { ...settings };
  const rules = settings?.stateRules && typeof settings.stateRules === "object" ? settings.stateRules : {};
  const override = state ? rules[state] : null;
  if (!override || typeof override !== "object") return common;
  const merged = { ...common };
  for (const key of STATE_RULE_KEYS) if (override[key] !== undefined) merged[key] = override[key];
  return merged;
}

function salaryBreakup(body, settings) {
  const gross = n(body.grossSalary);
  const basic = +(gross * n(settings.basicPercent) / 100).toFixed(2);
  const daBaseAmount = baseAmount(settings.daBase, gross, basic, 0);
  const da = +(daBaseAmount * n(settings.daPercent) / 100).toFixed(2);
  const hra = +(baseAmount(settings.hraBase, gross, basic, da) * n(settings.hraPercent) / 100).toFixed(2);
  const conveyance = +(baseAmount(settings.conveyanceBase, gross, basic, da) * n(settings.conveyancePercent) / 100).toFixed(2);
  const otherAllowance = +(baseAmount(settings.otherAllowanceBase, gross, basic, da) * n(settings.otherAllowancePercent) / 100).toFixed(2);
  const pfWage = baseAmount(settings.pfBase, gross, basic, da);
  const pfBaseAmount = settings.pfCeilingEnabled ? Math.min(pfWage, n(settings.pfWageCeiling)) : pfWage;
  const pf = body.pfApplicable ? +(pfBaseAmount * n(settings.pfPercent) / 100).toFixed(2) : 0;
  const esiWage = baseAmount(settings.esiBase, gross, basic, da);
  const esiEligible = !settings.esiCeilingEnabled || esiWage <= n(settings.esiWageCeiling);
  const esi = body.esiApplicable && esiEligible ? +(esiWage * n(settings.esiPercent) / 100).toFixed(2) : 0;
  const employerPf = body.pfApplicable ? +(pfBaseAmount * n(settings.employerPfPercent) / 100).toFixed(2) : 0;
  const employerEsi = body.esiApplicable && esiEligible ? +(esiWage * n(settings.employerEsiPercent) / 100).toFixed(2) : 0;
  const gratuityBaseAmount = settings.gratuityBase === "gross" ? gross : settings.gratuityBase === "basicDa" ? basic + da : basic;
  const gratuity = +(gratuityBaseAmount * n(settings.gratuityPercent) / 100).toFixed(2);
  const ctc = +(gross + employerPf + employerEsi + gratuity).toFixed(2);
  return { grossSalary:gross,basicSalary:basic,hra,da,conveyance,otherAllowance,pfAmount:pf,esiAmount:esi,pfRate:n(settings.pfPercent),esiRate:n(settings.esiPercent),employerPfAmount:employerPf,employerPfRate:n(settings.employerPfPercent),employerEsiAmount:employerEsi,employerEsiRate:n(settings.employerEsiPercent),gratuityAmount:gratuity,gratuityPercent:n(settings.gratuityPercent),ctc,pfWageBase:pfWage,pfBaseAmount,esiWageBase:esiWage,esiEligible };
}

export async function createEmployee(req, res) {
  const body = { ...req.body };
  if (!String(body.name || "").trim()) return res.status(400).json({ success:false,message:"Employee name is required." });
  if (!body.joiningDate) return res.status(400).json({ success:false,message:"Joining date is required." });
  if (!body.employeeCode || !String(body.employeeCode).trim()) {
    const year = new Date().getFullYear(), prefix=`EMP-${year}-`;
    const latest=await Employee.findOne({employeeCode:new RegExp(`^${prefix}\\d+$`)}).sort({employeeCode:-1}).select("employeeCode").lean();
    const last=latest?.employeeCode?.match(/(\d+)$/)?.[1]; body.employeeCode=`${prefix}${String(Number(last||0)+1).padStart(5,"0")}`;
  }
  for (const f of ["dateOfBirth","joiningDate"]) if(body[f]) body[f]=new Date(body[f]);
  for (const f of ["grossSalary","basicSalary","hra","da","conveyance","otherAllowance","professionalTax","otherDeduction","pfRate","pfAmount","esiRate","esiAmount","employerPfRate","employerPfAmount","employerEsiRate","employerEsiAmount","gratuityPercent","gratuityAmount","ctc"]) body[f]=n(body[f]);
  let settings=await PayrollSetting.findOne({key:"default"}).lean(); if(!settings) settings=await PayrollSetting.create({key:"default"});
  settings = effectivePayrollSettings(settings, body.state);
  Object.assign(body,salaryBreakup(body,settings));
  const employee=await Employee.create(body); res.status(201).json({success:true,employee});
}

export async function updateEmployee(req, res) {
  const current=await Employee.findById(req.params.id); if(!current) return res.status(404).json({success:false,message:"Employee not found."});
  const body={...req.body};
  let settings=await PayrollSetting.findOne({key:"default"}).lean(); if(!settings) settings=await PayrollSetting.create({key:"default"});
  settings = effectivePayrollSettings(settings, body.state);
  if(body.grossSalary!==undefined) Object.assign(body,salaryBreakup(body,settings));
  for (const f of ["dateOfBirth","joiningDate"]) if(body[f]) body[f]=new Date(body[f]);
  const employee=await Employee.findByIdAndUpdate(req.params.id,body,{new:true,runValidators:true}); res.json({success:true,employee});
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

  const mapAllowanceTotal = employee.allowances
    ? [...employee.allowances.values()].reduce((s,v) => s+n(v), 0)
    : 0;
  const fixedAllowanceTotal =
    n(employee.hra) +
    n(employee.da) +
    n(employee.conveyance) +
    n(employee.otherAllowance);
  const allowanceTotal = mapAllowanceTotal + fixedAllowanceTotal;

  const basic = n(employee.basicSalary);
  const perDay = workingDays ? basic / workingDays : 0;
  const attendancePay = (presentDays + paidLeaveDays + halfDays * 0.5) * perDay;
  const unpaidDeduction = absentDays * perDay;
  const overtimeRate = n(req.body.overtimeRate) || (basic / 26 / 8 * 1.5);
  const overtimeAmount = overtimeHours * overtimeRate;
  const bonus = n(req.body.bonus);
  const deductions =
    unpaidDeduction +
    n(req.body.deductions) +
    n(employee.professionalTax) +
    n(employee.otherDeduction);
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
