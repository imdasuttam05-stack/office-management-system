import xlsx from "xlsx";

import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import AttendanceSetting from "../models/AttendanceSetting.js";
import Holiday from "../models/Holiday.js";
import Shift from "../models/Shift.js";
import Leave from "../models/Leave.js";
import Salary from "../models/Salary.js";
import { sendEmployeeEmail } from "../services/employeeCommunicationService.js";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clean = (v) => (v === undefined || v === null ? "" : String(v).trim());

const dayKeys = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function dateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseDate(value, fallback = null) {
  if (!value) return fallback;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return fallback;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function startOfMonth(year, month) {
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1));
}

function nextDay(date) {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function eachDate(start, endExclusive) {
  const out = [];
  for (let d = new Date(start); d < endExclusive; d = nextDay(d)) {
    out.push(new Date(d));
    if (out.length > 370) break;
  }
  return out;
}

function timeToMinutes(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && value >= 0 && value < 1) {
    return Math.round(value * 24 * 60);
  }
  const raw = String(value).trim();
  const m = raw.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3] || 0);
  if (mm > 59 || ss > 59) return null;
  const ap = String(m[4] || "").toUpperCase();
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
  } else if (h > 23) return null;
  return h * 60 + mm;
}

function actualMinutes(checkIn, checkOut) {
  const a = timeToMinutes(checkIn);
  const b = timeToMinutes(checkOut);
  if (a === null || b === null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 1440;
  return Math.max(0, diff);
}

function shiftDurationMinutes(shift) {
  if (!shift) return null;
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);
  if (start === null || end === null) return null;
  let duration = end - start;
  if (duration < 0) duration += 1440;
  return Math.max(0, duration - n(shift.breakMinutes));
}

function normalizeShiftIds(rule, fallback = null) {
  const raw = Array.isArray(rule?.shiftIds)
    ? rule.shiftIds
    : rule?.shiftId
      ? [rule.shiftId]
      : fallback
        ? [fallback]
        : [];
  return [...new Set(raw.filter(Boolean).map((id) => String(id)))];
}

function effectiveRule(settings, date) {
  const key = dateKey(date);
  const override = Array.isArray(settings?.dateOverrides)
    ? settings.dateOverrides.find((x) => dateKey(x?.date) === key)
    : null;

  if (override) {
    const shiftIds = normalizeShiftIds(override, settings?.defaultShiftId || null);
    return {
      type: override.type || "Working",
      shiftIds,
      shiftId: shiftIds[0] || null,
      overtimeAllowed: override.overtimeAllowed !== false,
      requiredWorkMinutes: Number.isFinite(Number(override.requiredWorkMinutes))
        ? Number(override.requiredWorkMinutes)
        : null,
      note: override.note || "",
      source: "date",
    };
  }

  const day = dayKeys[new Date(`${key}T00:00:00.000Z`).getUTCDay()];
  const rule = day === "saturday" ? settings?.saturday : settings?.days?.[day];
  if (rule) {
    const shiftIds = normalizeShiftIds(rule, settings?.defaultShiftId || null);
    return {
      type: rule.type || "Working",
      shiftIds,
      shiftId: shiftIds[0] || null,
      overtimeAllowed: rule.overtimeAllowed !== false,
      requiredWorkMinutes: Number.isFinite(Number(rule.requiredWorkMinutes))
        ? Number(rule.requiredWorkMinutes)
        : null,
      note: "",
      source: day,
    };
  }

  const shiftIds = normalizeShiftIds({}, settings?.defaultShiftId || null);
  return {
    type: "Working",
    shiftIds,
    shiftId: shiftIds[0] || null,
    overtimeAllowed: true,
    requiredWorkMinutes: null,
    note: "",
    source: "default",
  };
}

function shiftForEmployee(rule, employee, shifts) {
  const employeeShiftId = employee?.shiftId ? String(employee.shiftId) : "";
  const allowed = rule.shiftIds || [];

  if (employeeShiftId && (!allowed.length || allowed.includes(employeeShiftId))) {
    return shifts.find((s) => String(s._id) === employeeShiftId) || null;
  }
  if (allowed.length) {
    return shifts.find((s) => String(s._id) === allowed[0]) || null;
  }
  return null;
}

function adjustments(checkIn, checkOut, shift, requiredWorkMinutes, overtimeAllowed = true) {
  const actual = actualMinutes(checkIn, checkOut);
  let target = Number.isFinite(Number(requiredWorkMinutes))
    ? Number(requiredWorkMinutes)
    : shiftDurationMinutes(shift);

  if (target === null) target = 0;

  const delta = actual - Math.max(0, target);
  return {
    actualMinutes: actual,
    overtimeMinutes: delta > 0 && overtimeAllowed ? delta : 0,
    cuttingMinutes: delta < 0 ? Math.abs(delta) : 0,
    overtimeHours: delta > 0 && overtimeAllowed ? Math.round((delta / 60) * 100) / 100 : 0,
  };
}

function inRange(date, start, endExclusive) {
  const t = new Date(date).getTime();
  return t >= start.getTime() && t < endExclusive.getTime();
}

function employeeFilter(req) {
  const ids = clean(req.query.employeeIds || req.query.employeeId)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const filter = {};
  if (ids.length) filter._id = { $in: ids };
  if (clean(req.query.companyName)) filter.companyName = clean(req.query.companyName);
  if (clean(req.query.department)) filter.department = clean(req.query.department);
  if (clean(req.query.employeeStatus)) filter.status = clean(req.query.employeeStatus);
  return { filter, ids };
}

function dateRangeFromQuery(req) {
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const start = parseDate(req.query.from, defaultStart);
  let end = parseDate(req.query.to, defaultEnd);
  if (req.query.to) end = nextDay(end);
  if (!end || end <= start) end = nextDay(start);

  const maxDays = 370;
  if ((end - start) / 86400000 > maxDays) {
    end = new Date(start.getTime() + maxDays * 86400000);
  }
  return { start, end };
}

async function buildAttendanceRows(req) {
  const { start, end } = dateRangeFromQuery(req);
  const { filter } = employeeFilter(req);
  const employees = await Employee.find(filter).sort({ name: 1 });
  const employeeIds = employees.map((e) => e._id);

  if (!employeeIds.length) {
    return { start, end, employees, rows: [], totals: {} };
  }

  const [attendance, settings, holidays, shifts, leaves] = await Promise.all([
    Attendance.find({ employeeId: { $in: employeeIds }, date: { $gte: start, $lt: end } }).populate("shiftId", "name startTime endTime breakMinutes"),
    AttendanceSetting.findOne({}),
    Holiday.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 }),
    Shift.find({}).sort({ name: 1 }),
    Leave.find({ employeeId: { $in: employeeIds }, status: "Approved", fromDate: { $lt: end }, toDate: { $gte: start } }),
  ]);

  const attendanceMap = new Map();
  for (const a of attendance) attendanceMap.set(`${String(a.employeeId)}_${dateKey(a.date)}`, a);
  const holidayMap = new Map(holidays.map((h) => [dateKey(h.date), h]));
  const leaveList = leaves.map((l) => ({
    ...l.toObject(),
    from: new Date(l.fromDate),
    to: new Date(l.toDate),
  }));

  const rows = [];

  for (const employee of employees) {
    for (const d of eachDate(start, end)) {
      const key = dateKey(d);
      const a = attendanceMap.get(`${String(employee._id)}_${key}`);
      const rule = effectiveRule(settings, d);
      const holiday = holidayMap.get(key);
      const employeeLeave = leaveList.find(
        (l) => String(l.employeeId) === String(employee._id) && inRange(d, startOfDate(l.from), nextDay(startOfDate(l.to)))
      );

      let status = a?.status || "";
      let note = a?.note || "";
      if (!a) {
        if (employeeLeave) {
          status = "Leave";
          note = `Approved ${employeeLeave.leaveType || "Leave"}`;
        } else if (holiday) {
          status = "Week Off";
          note = `Holiday: ${holiday.name || "Holiday"}`;
        } else if (rule.type === "Week Off") {
          status = "Week Off";
          note = rule.note || "Weekly Off";
        } else {
          status = "Absent";
        }
      }

      const shift = shiftForEmployee(rule, employee, shifts) || a?.shiftId || null;
      const adj = a && status === "Present"
        ? adjustments(a.checkIn, a.checkOut, shift, rule.requiredWorkMinutes, rule.overtimeAllowed)
        : { actualMinutes: 0, overtimeMinutes: 0, cuttingMinutes: 0, overtimeHours: 0 };

      rows.push({
        employeeId: String(employee._id),
        employeeCode: employee.employeeCode || "",
        employeeName: employee.name || "",
        companyName: employee.companyName || "",
        department: employee.department || "",
        designation: employee.designation || "",
        workLocation: employee.workLocation || employee.location || "",
        date: key,
        day: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
        status,
        checkIn: a?.checkIn || "",
        checkOut: a?.checkOut || "",
        shiftName: shift?.name || a?.shiftName || "",
        hours: Math.round((adj.actualMinutes / 60) * 100) / 100,
        overtimeHours: adj.overtimeHours,
        overtimeApproved: Boolean(a?.overtimeApproved),
        cuttingMinutes: adj.cuttingMinutes,
        cuttingApproved: Boolean(a?.cuttingApproved),
        ruleSource: rule.source,
        ruleType: rule.type,
        note,
      });
    }
  }

  const totals = rows.reduce((acc, row) => {
    acc.present += row.status === "Present" ? 1 : 0;
    acc.halfDay += row.status === "Half Day" ? 1 : 0;
    acc.absent += row.status === "Absent" ? 1 : 0;
    acc.leave += row.status === "Leave" ? 1 : 0;
    acc.weekOff += row.status === "Week Off" ? 1 : 0;
    acc.hours += row.hours;
    acc.otHours += row.overtimeHours;
    acc.cuttingMinutes += row.cuttingMinutes;
    return acc;
  }, { present: 0, halfDay: 0, absent: 0, leave: 0, weekOff: 0, hours: 0, otHours: 0, cuttingMinutes: 0 });

  return { start, end, employees, rows, totals };
}

function startOfDate(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function aggregateMonthly(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.employeeId;
    if (!map.has(key)) {
      map.set(key, {
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        companyName: row.companyName,
        department: row.department,
        designation: row.designation,
        presentDays: 0,
        halfDays: 0,
        absentDays: 0,
        leaveDays: 0,
        weekOffDays: 0,
        holidayDays: 0,
        hours: 0,
        overtimeHours: 0,
        cuttingMinutes: 0,
      });
    }
    const x = map.get(key);
    if (row.status === "Present") x.presentDays += 1;
    if (row.status === "Half Day") x.halfDays += 1;
    if (row.status === "Absent") x.absentDays += 1;
    if (row.status === "Leave") x.leaveDays += 1;
    if (row.status === "Week Off") {
      x.weekOffDays += 1;
      if (row.note?.toLowerCase().startsWith("holiday:")) x.holidayDays += 1;
    }
    x.hours += row.hours;
    x.overtimeHours += row.overtimeHours;
    x.cuttingMinutes += row.cuttingMinutes;
  }
  return [...map.values()].map((x) => ({
    ...x,
    payableDays: x.presentDays + x.halfDays * 0.5 + x.leaveDays + x.weekOffDays,
    hours: Math.round(x.hours * 100) / 100,
    overtimeHours: Math.round(x.overtimeHours * 100) / 100,
  }));
}

function asWorkbook(sheetName, rows) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows.length ? rows : [{ Message: "No records found" }]);
  xlsx.utils.book_append_sheet(wb, ws, String(sheetName).slice(0, 31));
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}

function sendWorkbook(res, filename, buffer) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.end(buffer);
}

export async function getAttendanceReport(req, res) {
  try {
    const data = await buildAttendanceRows(req);
    const mode = clean(req.query.mode || "daily").toLowerCase() === "monthly" ? "monthly" : "daily";
    const rows = mode === "monthly" ? aggregateMonthly(data.rows) : data.rows;
    res.json({
      success: true,
      mode,
      from: dateKey(data.start),
      to: dateKey(new Date(data.end.getTime() - 86400000)),
      rows,
      totals: data.totals,
      employees: data.employees.map((e) => ({ _id: e._id, employeeCode: e.employeeCode, name: e.name, companyName: e.companyName, department: e.department })),
    });
  } catch (error) {
    console.error("getAttendanceReport:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function exportAttendanceReportExcel(req, res) {
  try {
    const data = await buildAttendanceRows(req);
    const mode = clean(req.query.mode || "daily").toLowerCase() === "monthly" ? "monthly" : "daily";
    const rows = mode === "monthly" ? aggregateMonthly(data.rows) : data.rows;
    const exportRows = rows.map((x) => mode === "monthly" ? ({
      "Employee Code": x.employeeCode,
      "Employee": x.employeeName,
      "Company": x.companyName,
      "Department": x.department,
      "Designation": x.designation,
      "Present": x.presentDays,
      "Half Day": x.halfDays,
      "Absent": x.absentDays,
      "Leave": x.leaveDays,
      "Week Off": x.weekOffDays,
      "Holiday": x.holidayDays,
      "Paid Days": x.payableDays,
      "Hours": x.hours,
      "OT Hours": x.overtimeHours,
      "Cutting Minutes": x.cuttingMinutes,
    }) : ({
      Date: x.date,
      Day: x.day,
      "Employee Code": x.employeeCode,
      Employee: x.employeeName,
      Company: x.companyName,
      Department: x.department,
      Designation: x.designation,
      Status: x.status,
      "Check In": x.checkIn,
      "Check Out": x.checkOut,
      Shift: x.shiftName,
      Hours: x.hours,
      "OT Hours": x.overtimeHours,
      "Cutting Minutes": x.cuttingMinutes,
      Note: x.note,
    }));
    const filename = `attendance-${mode}-${dateKey(data.start)}-${dateKey(new Date(data.end.getTime() - 86400000))}.xlsx`;
    sendWorkbook(res, filename, asWorkbook(mode === "monthly" ? "Monthly Attendance" : "Daily Attendance", exportRows));
  } catch (error) {
    console.error("exportAttendanceReportExcel:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function ensureSalaryRecordsForPeriod(req, month, year, employees) {
  if (!month || !year || !employees.length) return [];

  // Build the same virtual attendance view used by the Attendance Report so
  // salary for older months is based on actual attendance + configured
  // weekly-off/holiday/leave rules, not merely on existing Salary documents.
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const attendanceRequest = {
    query: {
      from: dateKey(start),
      to: dateKey(new Date(end.getTime() - 86400000)),
      employeeIds: employees.map((e) => String(e._id)).join(","),
      companyName: clean(req.query.companyName || ""),
      department: clean(req.query.department || ""),
    },
  };
  const attendanceData = await buildAttendanceRows(attendanceRequest);

  const byEmployee = new Map();
  for (const row of attendanceData.rows) {
    if (!byEmployee.has(row.employeeId)) byEmployee.set(row.employeeId, []);
    byEmployee.get(row.employeeId).push(row);
  }

  const generated = [];

  for (const employee of employees) {
    const rows = byEmployee.get(String(employee._id)) || [];
    const presentDays = rows.filter((r) => r.status === "Present").length;
    const halfDays = rows.filter((r) => r.status === "Half Day").length;
    const absentDays = rows.filter((r) => r.status === "Absent").length;
    const leaveDays = rows.filter((r) => r.status === "Leave").length;
    const weekOffDays = rows.filter((r) => r.status === "Week Off" && !String(r.note || "").toLowerCase().startsWith("holiday:")).length;
    const holidayDays = rows.filter((r) => r.status === "Week Off" && String(r.note || "").toLowerCase().startsWith("holiday:")).length;

    // Scheduled working days exclude weekly offs and holidays. A salaried
    // employee's paid attendance includes approved leave plus non-working days.
    const scheduledWorkingDays = Math.max(0, rows.length - weekOffDays - holidayDays);
    const paidScheduledDays = Math.min(
      scheduledWorkingDays,
      presentDays + halfDays * 0.5 + leaveDays
    );

    const gross = n(employee.grossSalary);
    const basic = n(employee.basicSalary || employee.basic);
    const attendancePay = scheduledWorkingDays > 0
      ? (gross / scheduledWorkingDays) * paidScheduledDays
      : 0;

    let overtimeHours = 0;
    let overtimeApprovedHours = 0;
    let cuttingMinutes = 0;
    let cuttingApprovedMinutes = 0;
    for (const row of rows) {
      if (row.status === "Present") {
        overtimeHours += n(row.overtimeHours);
        cuttingMinutes += n(row.cuttingMinutes);
        if (row.overtimeApproved) overtimeApprovedHours += n(row.overtimeHours);
        if (row.cuttingApproved) cuttingApprovedMinutes += n(row.cuttingMinutes);
      }
    }

    const overtimeRate =
      n(req.body?.overtimeRate) ||
      (basic > 0 ? (basic / 26 / 8) * 1.5 : 0);
    const overtimeAmount = overtimeApprovedHours * overtimeRate;
    const cuttingRate = basic > 0 ? basic / 26 / 8 : 0;
    const cuttingAmount = (cuttingApprovedMinutes / 60) * cuttingRate;

    const unpaidDays = Math.max(0, scheduledWorkingDays - paidScheduledDays);
    const unpaidDeduction = scheduledWorkingDays > 0
      ? unpaidDays * (gross / scheduledWorkingDays)
      : 0;

    const deductions = unpaidDeduction + cuttingAmount + n(employee.otherDeduction);
    const grossSalary = attendancePay + overtimeAmount;
    const netSalary = Math.max(0, grossSalary - deductions);

    const salary = await Salary.findOneAndUpdate(
      { employeeId: employee._id, month, year },
      {
        $set: {
          employeeId: employee._id,
          month,
          year,
          workingDays: scheduledWorkingDays,
          presentDays,
          halfDays,
          paidLeaveDays: leaveDays,
          absentDays,
          holidayDays,
          weekOffDays,
          basicSalary: basic,
          attendancePay,
          allowances: n(employee.hra) + n(employee.conveyance) + n(employee.otherAllowance),
          // Keep actual OT/Fine for audit, but only approved values affect salary.
          overtimeHours,
          overtimeApprovedHours,
          overtimeAmount,
          overtimeApprovedAmount: overtimeAmount,
          cuttingMinutes,
          cuttingApprovedMinutes,
          cuttingAmount,
          grossSalary,
          deductions,
          netSalary,
        },
        $setOnInsert: { status: "Processed" },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    generated.push(salary);
  }

  return generated;
}

export async function getSalaryReport(req, res) {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "Valid month and year are required." });
    }

    const { filter } = employeeFilter(req);
    const employees = await Employee.find(filter).sort({ name: 1 });
    const employeeIds = employees.map((e) => e._id);

    // IMPORTANT: Do not limit this to the current month or pre-existing
    // Salary documents. Any selected historical month can be generated on
    // demand from attendance, then immediately returned to the report.
    await ensureSalaryRecordsForPeriod(req, month, year, employees);

    const salaries = await Salary.find({
      employeeId: { $in: employeeIds },
      month,
      year,
    }).populate("employeeId").sort({ "employeeId.name": 1 });

    res.json({ success: true, month, year, salaries });
  } catch (error) {
    console.error("getSalaryReport:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function exportSalaryReportExcel(req, res) {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const { filter } = employeeFilter(req);
    const employees = await Employee.find(filter).sort({ name: 1 });
    const salaryFilter = { employeeId: { $in: employees.map((e) => e._id) } };
    if (month) salaryFilter.month = month;
    if (year) salaryFilter.year = year;
    const salaries = await Salary.find(salaryFilter).populate("employeeId");
    const rows = salaries.map((s) => ({
      "Employee Code": s.employeeId?.employeeCode || "",
      Employee: s.employeeId?.name || "",
      Company: s.employeeId?.companyName || "",
      Department: s.employeeId?.department || "",
      Designation: s.employeeId?.designation || "",
      "Present Days": s.presentDays || 0,
      "Half Days": s.halfDays || 0,
      "Absent Days": s.absentDays || 0,
      "Leave Days": s.paidLeaveDays || 0,
      "OT Hours": s.overtimeHours || 0,
      "OT Amount": s.overtimeAmount || s.overtimeApprovedAmount || 0,
      "Cutting Minutes": s.cuttingMinutes || 0,
      "Cutting Amount": s.cuttingAmount || 0,
      Gross: s.grossSalary || 0,
      Deductions: s.deductions || 0,
      "Net Payable": s.netSalary || 0,
      Status: s.status || "",
    }));
    sendWorkbook(res, `salary-report-${month || "all"}-${year || "all"}.xlsx`, asWorkbook("Salary Report", rows));
  } catch (error) {
    console.error("exportSalaryReportExcel:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

function formatMonth(month, year) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

function roundMoney(value) {
  return Math.round(n(value) * 100) / 100;
}

function toWords(num) {
  const number = Math.round(Math.abs(Number(num) || 0));
  if (!number) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n) => n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
  const underThousand = (n) => {
    const parts = [];
    if (Math.floor(n / 100)) parts.push(`${ones[Math.floor(n / 100)]} Hundred`);
    const rem = n % 100;
    if (rem) parts.push(two(rem));
    return parts.join(" ");
  };
  let nValue = number;
  const parts = [];
  const crore = Math.floor(nValue / 10000000); nValue %= 10000000;
  const lakh = Math.floor(nValue / 100000); nValue %= 100000;
  const thousand = Math.floor(nValue / 1000); nValue %= 1000;
  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (nValue) parts.push(underThousand(nValue));
  return parts.join(" ");
}

export async function getSalarySlip(req, res) {
  try {
    const salary = await Salary.findById(req.params.id).populate("employeeId");
    if (!salary || !salary.employeeId) return res.status(404).json({ success: false, message: "Salary not found." });

    const employee = salary.employeeId;
    const days = new Date(Date.UTC(salary.year, salary.month, 0)).getUTCDate();
    const present = n(salary.presentDays);
    const halfDays = n(salary.halfDays);
    const leave = n(salary.paidLeaveDays || salary.unpaidLeaveDays);
    const weekOff = n(salary.weekOffDays);
    const holiday = n(salary.holidayDays);
    const paidDays = Math.min(days, roundMoney(present + halfDays * 0.5 + leave + weekOff + holiday));
    const lop = Math.max(0, roundMoney(days - paidDays));

    const basic = roundMoney(salary.basicSalary || employee.basicSalary);
    const hra = roundMoney(employee.hra);
    const conveyance = roundMoney(employee.conveyance);
    const totalGross = roundMoney(salary.grossSalary || (basic + hra + conveyance + employee.otherAllowance));
    const overtimeAmount = roundMoney(salary.overtimeAmount || salary.overtimeApprovedAmount);
    const baseGross = roundMoney(Math.max(0, totalGross - overtimeAmount));
    const others = roundMoney(baseGross - basic - hra - conveyance);

    const pfBase = employee.pfApplicable ? Math.min(basic, employee.pfWageCeiling || 15000) : 0;
    const pf = employee.pfApplicable ? roundMoney(employee.pfAmount || (pfBase * n(employee.pfRate || 12)) / 100) : 0;
    const esi = employee.esiApplicable ? roundMoney(employee.esiAmount || (Math.min(totalGross, employee.esiWageCeiling || 21000) * n(employee.esiRate || 0.75)) / 100) : 0;
    const professionalTax = roundMoney(employee.professionalTax);
    const cutting = roundMoney(salary.cuttingAmount);
    const otherDeduction = Math.max(0, roundMoney(n(salary.deductions) - cutting));
    const totalDeductions = roundMoney(pf + esi + professionalTax + cutting + otherDeduction);
    const netPayable = roundMoney(Math.max(0, totalGross - totalDeductions));

    const slip = {
      salaryId: String(salary._id),
      companyName: employee.companyName || "Company",
      companyAddress: employee.companyAddress || "",
      monthLabel: formatMonth(salary.month, salary.year),
      employeeName: employee.name || "",
      employeeCode: employee.employeeCode || "",
      employeeEmail: employee.email || "",
      designation: employee.designation || "",
      uanNo: employee.uanNo || "",
      esiNo: employee.esiNumber || "",
      dob: employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString("en-GB") : "",
      doj: employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString("en-GB") : "",
      bankName: employee.bankName || "",
      ifscCode: employee.ifscCode || "",
      accountNo: employee.accountNumber || "",
      days,
      paidDays,
      lop,
      earnings: {
        basic,
        hra,
        conveyance,
        others,
      },
      deductions: {
        pf,
        esi,
        professionalTax,
        cutting,
        other: otherDeduction,
      },
      totals: {
        baseEarnings: baseGross,
        earnings: totalGross,
        deductions: totalDeductions,
        netPayable,
        overtimeHours: roundMoney(salary.overtimeHours),
        overtimeApprovedHours: roundMoney(salary.overtimeApprovedHours),
        overtimeApproved: overtimeAmount > 0,
        overtimeAmount,
        cuttingMinutes: n(salary.cuttingMinutes),
        cuttingApprovedMinutes: n(salary.cuttingApprovedMinutes),
        cuttingApproved: cutting > 0,
        cuttingAmount: cutting,
      },
      inWords: `Rupees ${toWords(netPayable)} Only`,
      status: salary.status || "Processed",
    };

    res.json({ success: true, salary, slip });
  } catch (error) {
    console.error("getSalarySlip report:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}


export async function sendSalarySlipEmail(req, res) {
  try {
    const salary = await Salary.findById(req.params.id).populate("employeeId");
    if (!salary || !salary.employeeId) {
      return res.status(404).json({ success: false, message: "Salary not found." });
    }

    const employee = salary.employeeId;
    const to = clean(req.body?.to || employee.email);
    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Employee email address is missing. Please add an email in Employee Master.",
      });
    }

    const days = new Date(Date.UTC(salary.year, salary.month, 0)).getUTCDate();
    const present = n(salary.presentDays);
    const halfDays = n(salary.halfDays);
    const leave = n(salary.paidLeaveDays || salary.unpaidLeaveDays);
    const weekOff = n(salary.weekOffDays);
    const holiday = n(salary.holidayDays);
    const paidDays = Math.min(days, roundMoney(present + halfDays * 0.5 + leave + weekOff + holiday));
    const lop = Math.max(0, roundMoney(days - paidDays));

    const basic = roundMoney(salary.basicSalary || employee.basicSalary);
    const hra = roundMoney(employee.hra);
    const conveyance = roundMoney(employee.conveyance);
    const totalGross = roundMoney(
      salary.grossSalary || (basic + hra + conveyance + employee.otherAllowance)
    );

    // Salary already stores approved OT/Cutting from payroll approval.
    const overtimeAmount = roundMoney(salary.overtimeAmount || salary.overtimeApprovedAmount);
    const overtimeApprovedHours = n(salary.overtimeApprovedHours);
    const overtimeApproved = overtimeApprovedHours > 0 || overtimeAmount > 0;

    const baseGross = roundMoney(Math.max(0, totalGross - overtimeAmount));
    const others = roundMoney(baseGross - basic - hra - conveyance);

    const pfBase = employee.pfApplicable
      ? Math.min(basic, employee.pfWageCeiling || 15000)
      : 0;
    const pf = employee.pfApplicable
      ? roundMoney(employee.pfAmount || (pfBase * n(employee.pfRate || 12)) / 100)
      : 0;
    const esi = employee.esiApplicable
      ? roundMoney(
          employee.esiAmount ||
            (Math.min(totalGross, employee.esiWageCeiling || 21000) * n(employee.esiRate || 0.75)) / 100
        )
      : 0;
    const professionalTax = roundMoney(employee.professionalTax);
    const cutting = roundMoney(salary.cuttingAmount);
    const cuttingApprovedMinutes = n(salary.cuttingApprovedMinutes);
    const cuttingApproved = cuttingApprovedMinutes > 0 || cutting > 0;
    const otherDeduction = Math.max(0, roundMoney(n(salary.deductions) - cutting));
    const totalDeductions = roundMoney(pf + esi + professionalTax + cutting + otherDeduction);
    const netPayable = roundMoney(Math.max(0, totalGross - totalDeductions));

    const moneyHtml = (v) =>
      `₹${Number(v || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    const monthLabel = formatMonth(salary.month, salary.year);
    const companyName = clean(employee.companyName) || "Company";
    const companyAddress = clean(employee.companyAddress);
    const esc = (v) =>
      clean(v).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]));

    // Actual values are shown in Attendance, while this salary email shows
    // approved payroll values. Do not show OT/Fine narration when not approved.
    const actualOt = n(salary.overtimeHours);
    const actualCut = n(salary.cuttingMinutes);
    const meta = [];
    if (overtimeApproved) {
      meta.push(
        `<span><b>OT:</b> Actual ${esc(formatHours(actualOt))} · Approved ${esc(formatHours(overtimeApprovedHours))} · Amount ${moneyHtml(overtimeAmount)}</span>`
      );
    }
    if (cuttingApproved) {
      meta.push(
        `<span><b>Fine / Cutting:</b> Actual ${esc(formatMinutes(actualCut))} · Approved ${esc(formatMinutes(cuttingApprovedMinutes))} · Amount ${moneyHtml(cutting)}</span>`
      );
    }

    const subject = `Salary Slip - ${monthLabel} - ${employee.name || employee.employeeCode || "Employee"}`;
    const html = `
      <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;color:#172033">
        <div style="max-width:900px;margin:auto;background:#fff;border:1px solid #dfe5ee;border-radius:12px;padding:28px">
          <div style="text-align:center;border-bottom:2px solid #1d4f91;padding-bottom:14px;margin-bottom:18px">
            <h1 style="margin:0;color:#172b4d;font-size:25px">${esc(companyName)}</h1>
            <div style="color:#667085;margin-top:5px">${esc(companyAddress)}</div>
            <h2 style="margin:9px 0 0;font-size:18px">Salary Slip - ${esc(monthLabel)}</h2>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px">
            <tbody>
              <tr>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>Employee's Name</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.name)}</td>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>Employee ID</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.employeeCode)}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>Designation</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.designation)}</td>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>UAN No.</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.uanNo)}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>DOB</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString("en-GB") : "")}</td>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>ESIC No.</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.esiNumber)}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>DOJ</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString("en-GB") : "")}</td>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>Days</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${days}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>Bank Name</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.bankName)}</td>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>Paid Days</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${paidDays}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>IFSC Code</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.ifscCode)}</td>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>LOP</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${lop}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>Account No.</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(employee.accountNumber)}</td>
                <td style="padding:8px;border:1px solid #e3e8ef;background:#f7f9fc"><b>Employee Email</b></td>
                <td style="padding:8px;border:1px solid #e3e8ef">${esc(to)}</td>
              </tr>
            </tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr>
                <th colspan="2" style="padding:10px;border:1px solid #dfe6ef;background:#eef4fb;text-align:center">Actuals</th>
                <th colspan="2" style="padding:10px;border:1px solid #dfe6ef;background:#eef4fb;text-align:center">Earnings</th>
                <th colspan="2" style="padding:10px;border:1px solid #dfe6ef;background:#eef4fb;text-align:center">Deductions</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding:8px;border:1px solid #e3e8ef">Basic</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(basic)}</td><td style="padding:8px;border:1px solid #e3e8ef">Basic</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(basic)}</td><td style="padding:8px;border:1px solid #e3e8ef">ESI Employee</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(esi)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e3e8ef">HRA</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(hra)}</td><td style="padding:8px;border:1px solid #e3e8ef">HRA</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(hra)}</td><td style="padding:8px;border:1px solid #e3e8ef">PF Employee</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(pf)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e3e8ef">Conveyance</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(conveyance)}</td><td style="padding:8px;border:1px solid #e3e8ef">Conveyance</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(conveyance)}</td><td style="padding:8px;border:1px solid #e3e8ef">Professional Tax</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(professionalTax)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e3e8ef">Others</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(others)}</td><td style="padding:8px;border:1px solid #e3e8ef">Others</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(others)}</td><td style="padding:8px;border:1px solid #e3e8ef">Fine / Cutting</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(cutting)}</td></tr>
              ${overtimeApproved ? `<tr><td style="padding:8px;border:1px solid #e3e8ef">OT Approved</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(overtimeAmount)}</td><td style="padding:8px;border:1px solid #e3e8ef">OT Approved</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(overtimeAmount)}</td><td style="padding:8px;border:1px solid #e3e8ef">Other / LOP</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(otherDeduction)}</td></tr>` : `<tr><td style="padding:8px;border:1px solid #e3e8ef">Others</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(0)}</td><td style="padding:8px;border:1px solid #e3e8ef"></td><td style="padding:8px;border:1px solid #e3e8ef"></td><td style="padding:8px;border:1px solid #e3e8ef">Other / LOP</td><td style="padding:8px;border:1px solid #e3e8ef;text-align:right">${moneyHtml(otherDeduction)}</td></tr>`}
              <tr style="background:#f4f7fb"><th colspan="2" style="padding:9px;border:1px solid #e3e8ef;text-align:right">Total Rs. ${moneyHtml(totalGross)}</th><th colspan="2" style="padding:9px;border:1px solid #e3e8ef;text-align:right">Earnings ${moneyHtml(totalGross)}</th><th colspan="2" style="padding:9px;border:1px solid #e3e8ef;text-align:right">Deductions ${moneyHtml(totalDeductions)}</th></tr>
            </tbody>
          </table>

          <div style="margin-top:16px;padding:14px 16px;background:#eef5ff;border:1px solid #cfe0fa;border-radius:9px;display:flex;justify-content:space-between;align-items:center">
            <div><b style="font-size:16px">Total Net Payable</b><div style="font-size:11px;color:#667085;margin-top:3px">Net salary after approved deductions</div></div>
            <b style="font-size:21px;color:#17365d">${moneyHtml(netPayable)}</b>
          </div>

          <div style="margin-top:11px;padding:11px 12px;background:#fafbfd;border:1px solid #e7ebf0;border-radius:7px;font-size:12px">
            <b>In Words:</b> Rupees ${esc(toWords(netPayable))} Only
          </div>

          ${meta.length ? `<div style="margin-top:10px;padding-top:9px;border-top:1px dashed #d6dde8;display:flex;gap:18px;flex-wrap:wrap;color:#667085;font-size:11px">${meta.join("")}</div>` : ""}

          <p style="font-size:11px;color:#667085;margin-top:18px">This is an electronically generated salary slip.</p>
        </div>
      </div>`;

    const delivery = await sendEmployeeEmail({
      to,
      subject,
      html,
      text: `${companyName}\nSalary Slip - ${monthLabel}\nEmployee: ${employee.name}\nEmployee ID: ${employee.employeeCode}\nNet Payable: ${moneyHtml(netPayable)}${meta.length ? `\n${meta.map((x) => x.replace(/<[^>]+>/g, "")).join("\n")}` : ""}`,
    });

    return res.json({
      success: true,
      message: `Salary slip sent successfully to ${to}.`,
      email: to,
      provider: delivery?.provider || null,
      messageId: delivery?.messageId || null,
      accepted: delivery?.accepted || [],
      rejected: delivery?.rejected || [],
    });
  } catch (error) {
    console.error("sendSalarySlipEmail:", error?.stack || error);
    return res.status(502).json({
      success: false,
      code: error?.code || "EMAIL_SEND_FAILED",
      message: error?.message || "Unable to send salary slip email.",
    });
  }
}

export async function exportSalarySlipExcel(req, res) {
  try {
    const fakeRes = {
      _json: null,
      status() { return this; },
      json(payload) { this._json = payload; return this; },
    };
    await getSalarySlip(req, fakeRes);
    if (!fakeRes._json?.success) return res.status(404).json(fakeRes._json || { success: false, message: "Salary not found." });
    const slip = fakeRes._json.slip;
    const rows = [
      [slip.companyName, "", "", "", "", ""],
      [slip.companyAddress, "", "", "", "", ""],
      [`Salary Slip - ${slip.monthLabel}`, "", "", "", "", ""],
      [],
      ["Employee's Name", slip.employeeName, "UAN No.", slip.uanNo, "", ""],
      ["Designation", slip.designation, "ESIC No.", slip.esiNo, "", ""],
      ["DOB", slip.dob, "Days", slip.days, "", ""],
      ["DOJ", slip.doj, "Paid Days", slip.paidDays, "", ""],
      ["Bank Name", slip.bankName, "LOP", slip.lop, "", ""],
      ["IFSC Code", slip.ifscCode, "", "", "", ""],
      ["Account No", slip.accountNo, "", "", "", ""],
      [],
      ["Actuals", "Amount", "Earnings", "Amount", "Deductions", "Amount"],
      ["Basic", slip.earnings.basic, "Basic", slip.earnings.basic, "ESI Employee", slip.deductions.esi],
      ["HRA", slip.earnings.hra, "HRA", slip.earnings.hra, "PF Employee", slip.deductions.pf],
      ["Conveyance", slip.earnings.conveyance, "Conveyance", slip.earnings.conveyance, "Professional Tax", slip.deductions.professionalTax],
      ["Others", slip.earnings.others, "Others", slip.earnings.others, "Fine / Cutting", slip.deductions.cutting],
      ["OT Approved", slip.totals.overtimeAmount, "OT Approved", slip.totals.overtimeAmount, "Other / LOP", slip.deductions.other],
      ["Total Rs.", slip.totals.earnings, "Total Rs.", slip.totals.earnings, "Total Rs.", slip.totals.deductions],
      [],
      ["Total Net Payable", slip.totals.netPayable, "", "", "", ""],
      [],
      ["In Words", slip.inWords, "", "", "", ""],
    ];
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(rows);
    ws["A1"].s = { font: { bold: true, sz: 16 } };
    xlsx.utils.book_append_sheet(wb, ws, "Salary Slip");
    sendWorkbook(res, `salary-slip-${slip.employeeCode || slip.employeeName}-${slip.monthLabel.replace(/\s+/g, "-")}.xlsx`, xlsx.write(wb, { type: "buffer", bookType: "xlsx" }));
  } catch (error) {
    console.error("exportSalarySlipExcel:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
