import Employee from "../models/Employee.js";
import EmployeeTask from "../models/EmployeeTask.js";
import EmployeeLetter from "../models/EmployeeLetter.js";
import { sendEmployeeEmail } from "../services/employeeCommunicationService.js";

export const LETTER_TYPES = [
  "Offer Letter",
  "Appointment / Joining Letter",
  "Confirmation Letter",
  "Promotion Letter",
  "Salary Revision Letter",
  "Increment Letter",
  "Transfer Letter",
  "Warning Letter",
  "Experience Letter",
  "Relieving Letter",
  "Termination Letter",
  "No Objection Certificate",
  "Custom Letter",
];

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function letterDefaults(type, employee) {
  const company = employee.companyName || "Your Company";
  const name = employee.name || "Employee";
  const code = employee.employeeCode || "";
  const designation = employee.designation || "";
  const department = employee.department || "";
  const joining = employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString("en-IN") : "";

  const subjects = {
    "Offer Letter": `Offer Letter - ${name}`,
    "Appointment / Joining Letter": `Appointment Letter - ${name}`,
    "Confirmation Letter": `Employment Confirmation - ${name}`,
    "Promotion Letter": `Promotion Letter - ${name}`,
    "Salary Revision Letter": `Salary Revision Letter - ${name}`,
    "Increment Letter": `Salary Increment Letter - ${name}`,
    "Transfer Letter": `Transfer Letter - ${name}`,
    "Warning Letter": `Official Warning Letter - ${name}`,
    "Experience Letter": `Experience Certificate - ${name}`,
    "Relieving Letter": `Relieving Letter - ${name}`,
    "Termination Letter": `Employment Termination Notice - ${name}`,
    "No Objection Certificate": `No Objection Certificate - ${name}`,
    "Custom Letter": `Official Letter - ${name}`,
  };

  const bodies = {
    "Offer Letter": `Dear ${name},\n\nWe are pleased to offer you employment with ${company} for the position of ${designation || "Employee"} in the ${department || "relevant"} department. Your proposed joining date is ${joining || "to be confirmed"}.\n\nPlease review the terms communicated by the company and confirm your acceptance.\n\nRegards,\nHR Department\n${company}`,
    "Appointment / Joining Letter": `Dear ${name},\n\nThis is to confirm your appointment with ${company} as ${designation || "Employee"}. Your employee ID is ${code}. Your joining date is ${joining || ""}.\n\nYou are expected to follow the company's policies, attendance rules and instructions of your reporting manager.\n\nRegards,\nHR Department\n${company}`,
    "Confirmation Letter": `Dear ${name},\n\nWe are pleased to confirm your employment with ${company}. Your performance and conduct have been reviewed in accordance with company policy.\n\nCongratulations and best wishes for your continued contribution.\n\nRegards,\nHR Department\n${company}`,
    "Promotion Letter": `Dear ${name},\n\nWe are pleased to inform you that you have been promoted. Your revised role/designation and applicable terms will be effective as communicated by the company.\n\nWe wish you success in your new responsibilities.\n\nRegards,\nHR Department\n${company}`,
    "Salary Revision Letter": `Dear ${name},\n\nThis letter confirms a revision to your salary structure effective from the date communicated by the company. Please refer to the attached/updated payroll details for the applicable amounts.\n\nRegards,\nHR Department\n${company}`,
    "Increment Letter": `Dear ${name},\n\nWe are pleased to inform you of an increment in your compensation. The revised salary will be reflected in payroll from the applicable effective date.\n\nRegards,\nHR Department\n${company}`,
    "Transfer Letter": `Dear ${name},\n\nYou are hereby informed of your transfer to the location/department communicated by the company. Please coordinate with HR and your reporting manager for the transition.\n\nRegards,\nHR Department\n${company}`,
    "Warning Letter": `Dear ${name},\n\nThis letter serves as an official warning regarding the matter discussed with you. You are expected to comply with company policies and instructions going forward.\n\nPlease treat this communication as important.\n\nRegards,\nHR Department\n${company}`,
    "Experience Letter": `To Whom It May Concern,\n\nThis is to certify that ${name}, employee ID ${code}, was associated with ${company} in the position of ${designation || "Employee"}. This certificate is issued upon request.\n\nWe wish them success in future endeavours.\n\nRegards,\nHR Department\n${company}`,
    "Relieving Letter": `Dear ${name},\n\nThis is to confirm that you have been relieved from your duties with ${company}, subject to completion of the applicable company formalities.\n\nWe thank you for your service and wish you success in the future.\n\nRegards,\nHR Department\n${company}`,
    "Termination Letter": `Dear ${name},\n\nThis letter communicates the termination of your employment with ${company}, effective as stated by the company and subject to the applicable terms and policies.\n\nPlease contact HR for clearance and final settlement formalities.\n\nRegards,\nHR Department\n${company}`,
    "No Objection Certificate": `To Whom It May Concern,\n\nThis is to certify that ${company} has no objection to ${name}, employee ID ${code}, for the purpose for which this certificate is requested, subject to applicable company requirements.\n\nRegards,\nHR Department\n${company}`,
    "Custom Letter": `Dear ${name},\n\n[Write your letter content here.]\n\nRegards,\nHR Department\n${company}`,
  };
  return { subject: subjects[type] || subjects["Custom Letter"], body: bodies[type] || bodies["Custom Letter"] };
}

function renderLetterHtml({ company, employee, subject, body }) {
  const lines = String(body || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  return `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#182230"><div style="max-width:760px;margin:28px auto;background:#fff;border:1px solid #e5eaf0;border-radius:16px;overflow:hidden"><div style="padding:28px 34px;border-bottom:3px solid #1d4f91"><div style="font-size:24px;font-weight:800;color:#1d4f91">${esc(company || "Company")}</div><div style="margin-top:5px;color:#667085">Human Resources Department</div></div><div style="padding:34px"><div style="font-size:13px;color:#667085;margin-bottom:18px">Employee ID: ${esc(employee.employeeCode)} &nbsp; | &nbsp; Designation: ${esc(employee.designation)}</div><h2 style="margin:0 0 24px;font-size:22px">${esc(subject)}</h2>${lines.map(p => `<p style="font-size:15px;line-height:1.8;margin:0 0 14px">${esc(p)}</p>`).join("")}<div style="margin-top:38px;padding-top:18px;border-top:1px solid #e5eaf0;color:#667085;font-size:13px">This is an electronically generated HR communication.</div></div></div></body></html>`;
}

export async function getEmployeeTasks(req, res) {
  try {
    const { employeeId, status } = req.query;
    const q = {};
    if (employeeId) q.assignedTo = employeeId;
    if (status) q.status = status;
    const tasks = await EmployeeTask.find(q).populate("assignedTo", "employeeCode name department designation email").sort({ createdAt: -1 });
    res.json({ success: true, tasks });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
}

export async function createEmployeeTask(req, res) {
  try {
    const { title, description, priority, dueDate, employeeIds = [] } = req.body;
    const ids = [...new Set(employeeIds.filter(Boolean).map(String))];
    if (!title?.trim() || !ids.length) return res.status(400).json({ success: false, message: "Task title and at least one employee are required." });
    const employees = await Employee.find({ _id: { $in: ids } }).select("_id");
    if (employees.length !== ids.length) return res.status(400).json({ success: false, message: "One or more employees were not found." });
    const task = await EmployeeTask.create({ title: title.trim(), description: description || "", priority: priority || "Medium", dueDate: dueDate || null, assignedTo: ids, createdBy: req.user?._id || null });
    const populated = await task.populate("assignedTo", "employeeCode name department designation email");
    res.status(201).json({ success: true, task: populated });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
}

export async function updateEmployeeTask(req, res) {
  try {
    const patch = { ...req.body };
    if (patch.status === "Complete") patch.completedAt = new Date();
    const task = await EmployeeTask.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true }).populate("assignedTo", "employeeCode name department designation email");
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    res.json({ success: true, task });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
}

export async function getEmployeeLetterTypes(req, res) {
  res.json({ success: true, types: LETTER_TYPES });
}

export async function previewEmployeeLetter(req, res) {
  try {
    const employee = await Employee.findById(req.body.employeeId);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found." });
    const type = req.body.type || "Custom Letter";
    const defaults = letterDefaults(type, employee);
    const subject = req.body.subject || defaults.subject;
    const body = req.body.body || defaults.body;
    const html = renderLetterHtml({ company: employee.companyName, employee, subject, body });
    res.json({ success: true, subject, body, html });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
}

export async function sendEmployeeLetter(req, res) {
  try {
    const employee = await Employee.findById(req.body.employeeId);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found." });
    if (!employee.email) return res.status(400).json({ success: false, message: "Employee email is not available." });
    const type = req.body.type || "Custom Letter";
    const defaults = letterDefaults(type, employee);
    const subject = req.body.subject || defaults.subject;
    const body = req.body.body || defaults.body;
    const html = renderLetterHtml({ company: employee.companyName, employee, subject, body });
    const letter = await EmployeeLetter.create({ employeeId: employee._id, type, subject, body, email: employee.email, status: "Draft", createdBy: req.user?._id || null });
    try {
      await sendEmployeeEmail({ to: employee.email, subject, html, text: body });
      letter.status = "Sent";
      letter.sentAt = new Date();
      await letter.save();
    } catch (mailError) {
      letter.status = "Failed";
      await letter.save();
      throw mailError;
    }
    res.json({ success: true, letter });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
}

export async function getEmployeeLetters(req, res) {
  try {
    const q = req.query.employeeId ? { employeeId: req.query.employeeId } : {};
    const letters = await EmployeeLetter.find(q).populate("employeeId", "employeeCode name email designation").sort({ createdAt: -1 });
    res.json({ success: true, letters });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
}
