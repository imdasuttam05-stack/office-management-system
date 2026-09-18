import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import Holiday from "../models/Holiday.js";
import Salary from "../models/Salary.js";
import PayrollSetting from "../models/PayrollSetting.js";
import Company from "../models/Company.js";
import Shift from "../models/Shift.js";
import AttendanceSetting from "../models/AttendanceSetting.js";
import XLSX from "xlsx";

const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;

function timeToMinutes(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]), min = Number(m[2]);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function calculateTimeAdjustments(checkIn, checkOut, shift) {
  const cin = timeToMinutes(checkIn), cout = timeToMinutes(checkOut);
  if (cin == null || cout == null || !shift) return { overtimeHours: 0, cuttingMinutes: 0 };
  const scheduledStart = timeToMinutes(shift.startTime);
  const scheduledEnd = timeToMinutes(shift.endTime);
  if (scheduledStart == null || scheduledEnd == null) return { overtimeHours: 0, cuttingMinutes: 0 };
  let scheduled = scheduledEnd - scheduledStart;
  if (scheduled < 0) scheduled += 1440;
  scheduled = Math.max(0, scheduled - n(shift.breakMinutes));
  let actual = cout - cin;
  if (actual < 0) actual += 1440;
  const delta = actual - scheduled;
  return { overtimeHours: delta > 0 ? Math.round((delta / 60) * 100) / 100 : 0, cuttingMinutes: delta < 0 ? Math.abs(delta) : 0 };
}

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

function isoDays(from, to) {
  const out = [];
  const d = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (d < end) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

function dayRuleForDate(settings, iso) {
  const weekday = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  const key = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][weekday];
  return key === "saturday" ? settings?.saturday : settings?.days?.[key];
}

export async function attendance(req, res) {
  const query = {};
  if (req.query.employeeId) query.employeeId = req.query.employeeId;
  if (req.query.location) query.workLocation = req.query.location;
  if (req.query.from || req.query.to) {
    query.date = {};
    if (req.query.from) query.date.$gte = new Date(`${req.query.from}T00:00:00.000Z`);
    if (req.query.to) query.date.$lt = new Date(`${req.query.to}T00:00:00.000Z`);
  }
  const rows = await Attendance.find(query)
    .populate("employeeId", "employeeCode name workLocation state shiftId")
    .populate("shiftId", "name startTime endTime breakMinutes graceMinutes")
    .sort({ date: 1 });

  // Always show every active employee, even when there is no punch record yet.
  // This gives the Attendance Summary a real absent/pending view instead of hiding staff.
  const includeStaff = req.query.includeStaff !== "0";
  if (!includeStaff || !req.query.from || !req.query.to) {
    return res.json({ success: true, attendance: rows });
  }

  const settings = await AttendanceSetting.findOne({ key: "default" }).lean();
  const employees = await Employee.find({ status: "Active" })
    .populate("shiftId", "name startTime endTime breakMinutes graceMinutes")
    .lean();
  const rowMap = new Map(rows.map(r => [`${String(r.employeeId?._id || r.employeeId)}|${new Date(r.date).toISOString().slice(0,10)}`, r]));
  const dates = isoDays(req.query.from, req.query.to);
  const merged = [];

  for (const employee of employees) {
    if (req.query.location && (employee.workLocation || employee.location || "") !== req.query.location) continue;
    for (const iso of dates) {
      const key = `${employee._id}|${iso}`;
      const existing = rowMap.get(key);
      if (existing) { merged.push(existing); continue; }
      const rule = dayRuleForDate(settings, iso) || { type: "Working", shiftId: null, overtimeAllowed: true };
      const shiftId = employee.shiftId?._id || rule.shiftId || settings?.defaultShiftId || null;
      let shift = employee.shiftId || null;
      if (!shift && shiftId) shift = await Shift.findById(shiftId).lean();
      const status = rule.type === "Week Off" ? "Week Off" : rule.type === "Half Day" ? "Half Day" : "Absent";
      merged.push({
        _id: `virtual-${employee._id}-${iso}`,
        employeeId: { ...employee, shiftId: employee.shiftId?._id || null },
        date: new Date(`${iso}T00:00:00.000Z`),
        status, checkIn: "", checkOut: "", workLocation: employee.workLocation || employee.location || "",
        shiftId: shift?._id || null, shiftName: shift?.name || "", shift, overtimeHours: 0, fineHours: 0, virtual: true
      });
    }
  }
  merged.sort((a,b) => new Date(a.date) - new Date(b.date) || String(a.employeeId?.name||"").localeCompare(String(b.employeeId?.name||"")));
  res.json({ success: true, attendance: merged });
}

function excelDateToISO(value) {
  if (value instanceof Date) return value.toISOString().slice(0,10);
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const raw = String(value || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10);
}

function normalizeKey(k) {
  return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rowValue(row, aliases) {
  const map = Object.fromEntries(Object.entries(row).map(([k,v]) => [normalizeKey(k), v]));
  for (const a of aliases) if (map[normalizeKey(a)] !== undefined) return map[normalizeKey(a)];
  return "";
}

export async function attendanceImport(req, res) {
  if (!req.file) return res.status(400).json({ success:false, message:"Excel file is required." });
  try {
    const workbook = XLSX.read(req.file.buffer, { type:"buffer", cellDates:true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval:"" });
    const employees = await Employee.find().lean();
    const byCode = new Map(employees.map(e => [String(e.employeeCode || "").toLowerCase(), e]));
    const byName = new Map(employees.map(e => [String(e.name || "").toLowerCase(), e]));
    let imported = 0, skipped = 0;
    const errors = [];
    for (let i=0; i<rows.length; i++) {
      const r = rows[i];
      const code = String(rowValue(r,["Employee Code","EmployeeCode","Code","Emp Code","EmpCode"])).trim().toLowerCase();
      const name = String(rowValue(r,["Employee Name","Name","Staff Name"])).trim().toLowerCase();
      const employee = (code && byCode.get(code)) || (name && byName.get(name));
      const date = excelDateToISO(rowValue(r,["Date","Attendance Date","Work Date"]));
      if (!employee || !date) { skipped++; errors.push(`Row ${i+2}: employee code/name or date not found.`); continue; }
      const statusRaw = String(rowValue(r,["Status","Attendance","Present/Absent"])).trim().toLowerCase();
      const status = statusRaw.includes("absent") || statusRaw === "a" ? "Absent" : statusRaw.includes("half") || statusRaw === "hd" ? "Half Day" : statusRaw.includes("leave") || statusRaw === "l" ? "Leave" : statusRaw.includes("holiday") ? "Holiday" : statusRaw.includes("week") ? "Week Off" : "Present";
      const workLocation = String(rowValue(r,["Work Location","Location"]) || employee.workLocation || employee.location || "").trim();
      const shiftName = String(rowValue(r,["Shift","Shift Name"]) || "").trim();
      let shift = shiftName ? await Shift.findOne({name:shiftName}) : null;
      if (!shift && employee.shiftId) shift = await Shift.findById(employee.shiftId);
      const data = {
        employeeId: employee._id, date: new Date(`${date}T00:00:00.000Z`), status,
        checkIn: String(rowValue(r,["Check In","CheckIn","In Time","Punch In"]) || "").trim(),
        checkOut: String(rowValue(r,["Check Out","CheckOut","Out Time","Punch Out"]) || "").trim(),
        overtimeHours: n(rowValue(r,["OT","OT Hours","Overtime","Overtime Hours"])),
        note: String(rowValue(r,["Note","Remarks"]) || "").trim(), workLocation,
        shiftId: shift?._id || null, shiftName: shift?.name || shiftName
      };
      await Attendance.findOneAndUpdate({employeeId:employee._id,date:data.date},data,{upsert:true,new:true,runValidators:true});
      imported++;
    }
    res.json({success:true, imported, skipped, errors:errors.slice(0,50)});
  } catch (error) { res.status(400).json({success:false,message:error.message || "Excel import failed."}); }
}

export async function saveAttendance(req, res) {
  const employee = await Employee.findById(req.body.employeeId).lean();
  if (!employee) return res.status(404).json({success:false,message:"Employee not found."});
  const data = { ...req.body, date: new Date(req.body.date) };
  data.workLocation = employee.workLocation || employee.location || req.body.workLocation || "";

  let shift = null;
  if (req.body.shiftId) shift = await Shift.findById(req.body.shiftId).lean();
  else if (employee.shiftId) shift = await Shift.findById(employee.shiftId).lean();
  if (shift) { data.shiftName = shift.name; data.shiftId = shift._id; }

  if (data.checkIn && !data.checkOut && String(req.body.status || "Present") === "Present") {
    return res.status(400).json({success:false,message:"Out time is mandatory to mark present."});
  }
  if (data.checkIn && data.checkOut) data.status = "Present";
  else if (!data.checkIn && !data.checkOut && !data.status) data.status = "Absent";

  if (data.checkIn && data.checkOut && shift) {
    const calc = calculateTimeAdjustments(data.checkIn, data.checkOut, shift);
    data.overtimeHours = req.body.overtimeHours !== undefined ? n(req.body.overtimeHours) : calc.overtimeHours;
    data.cuttingMinutes = req.body.cuttingMinutes !== undefined ? n(req.body.cuttingMinutes) : calc.cuttingMinutes;
  } else {
    data.overtimeHours = n(req.body.overtimeHours);
    data.cuttingMinutes = n(req.body.cuttingMinutes);
  }

  // Any changed OT/cutting value must go through approval again.
  data.overtimeApproved = false;
  data.cuttingApproved = false;
  data.overtimeApprovedBy = null;
  data.overtimeApprovedAt = null;
  data.cuttingApprovedBy = null;
  data.cuttingApprovedAt = null;

  const row = await Attendance.findOneAndUpdate({employeeId:req.body.employeeId,date:data.date},data,{upsert:true,new:true,runValidators:true});
  res.json({success:true,attendance:row});
}

export async function shifts(req,res){
  res.json({success:true,shifts:await Shift.find({status:"Active"}).sort({name:1})});
}

export async function createShift(req,res){
  const shift=await Shift.create(req.body); res.status(201).json({success:true,shift});
}

export async function updateShift(req,res){
  const shift=await Shift.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true});
  if(!shift) return res.status(404).json({success:false,message:"Shift not found."});
  res.json({success:true,shift});
}

export async function attendanceSettings(req,res){
  let settings=await AttendanceSetting.findOne({key:"default"}).lean();
  if(!settings) settings=await AttendanceSetting.create({key:"default"});
  res.json({success:true,settings,shifts:await Shift.find({status:"Active"}).sort({name:1})});
}

export async function saveAttendanceSettings(req,res){
  const data={...req.body,key:"default"};
  const settings=await AttendanceSetting.findOneAndUpdate({key:"default"},data,{upsert:true,new:true,runValidators:true});
  res.json({success:true,settings});
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

  let workingDays=0,presentDays=0,halfDays=0,paidLeaveDays=0,absentDays=0,holidayDays=0,weekOffDays=0,overtimeHours=0,cuttingMinutes=0;
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
    if (a.overtimeApproved) overtimeHours += n(a.overtimeHours);
    if (a.cuttingApproved) cuttingMinutes += n(a.cuttingMinutes);
  }

  const mapAllowanceTotal = employee.allowances ? [...employee.allowances.values()].reduce((s,v) => s+n(v), 0) : 0;
  const fixedAllowanceTotal = n(employee.hra) + n(employee.da) + n(employee.conveyance) + n(employee.otherAllowance);
  const allowanceTotal = mapAllowanceTotal + fixedAllowanceTotal;
  const basic = n(employee.basicSalary);
  const perDay = workingDays ? basic / workingDays : 0;
  const attendancePay = (presentDays + paidLeaveDays + halfDays * 0.5) * perDay;
  const unpaidDeduction = absentDays * perDay;
  const overtimeRate = n(req.body.overtimeRate) || (basic / 26 / 8 * 1.5);
  const overtimeAmount = overtimeHours * overtimeRate;
  const cuttingRate = basic / 26 / 8;
  const cuttingAmount = (cuttingMinutes / 60) * cuttingRate;
  const bonus = n(req.body.bonus);
  const deductions = unpaidDeduction + cuttingAmount + n(req.body.deductions) + n(employee.professionalTax) + n(employee.otherDeduction);
  const grossSalary = attendancePay + allowanceTotal + overtimeAmount + bonus;
  const netSalary = Math.max(0, grossSalary - deductions);

  const salary = await Salary.findOneAndUpdate(
    { employeeId: employee._id, month, year },
    { employeeId: employee._id, month, year, workingDays, presentDays, halfDays, paidLeaveDays, unpaidLeaveDays: 0, absentDays, holidayDays, weekOffDays, basicSalary: basic, attendancePay, allowances: allowanceTotal, overtimeHours, overtimeAmount, overtimeApprovedAmount: overtimeAmount, cuttingMinutes, cuttingAmount, bonus, deductions, grossSalary, netSalary, status: "Processed" },
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
