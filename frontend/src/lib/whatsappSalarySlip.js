export function normalizeWhatsAppNumber(value, countryCode = "91") {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) digits = `${countryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) digits = `${countryCode}${digits.slice(1)}`;
  if (digits.length < 11 || digits.length > 15) return "";
  return digits;
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hoursText(value) {
  const totalMinutes = Math.max(0, Math.round(Number(value || 0) * 60));
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`;
}

export function buildSalarySlipWhatsAppMessage(salary, detailed = null, pdfUrl = "") {
  const slip = detailed?.slip || salary || {};
  const employee = detailed?.salary?.employeeId || salary?.employeeId || {};
  const month = slip.monthLabel || (salary?.month && salary?.year ? `${salary.month}/${salary.year}` : "");
  const name = slip.employeeName || employee.name || "Employee";
  const code = slip.employeeCode || employee.employeeCode || "";
  const designation = slip.designation || employee.designation || "";
  const net = slip?.totals?.netPayable ?? salary?.netSalary ?? 0;
  const company = slip.companyName || employee.companyName || "Hansaria Food Pvt Ltd";
  const lines = [
    `*${company}*`,
    `*Salary Slip - ${month}*`,
    "",
    `Employee: ${name}`,
    code ? `Employee ID: ${code}` : "",
    designation ? `Designation: ${designation}` : "",
    "",
    `Net Payable: ${money(net)}`,
    "",
    "Please find your complete salary slip PDF below:",
    pdfUrl || "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function getEmployeeWhatsAppNumber(employee = {}) {
  return employee?.whatsappNumber || employee?.whatsapp || employee?.mobile || employee?.mobileNumber || employee?.mobileNo || employee?.phone || employee?.phoneNumber || employee?.contactNumber || "";
}

export function sendSalarySlipToWhatsApp({ salary, detailed = null, pdfUrl = "", countryCode = "91", popup = null }) {
  const employee = detailed?.salary?.employeeId || salary?.employeeId || {};
  const mobile = getEmployeeWhatsAppNumber(employee) || getEmployeeWhatsAppNumber(detailed?.employee || {}) || detailed?.slip?.mobile || detailed?.slip?.whatsapp || "";
  const number = normalizeWhatsAppNumber(mobile, countryCode);
  if (!number) throw new Error("Employee WhatsApp number is missing or invalid. Please update Mobile No. in Employee Master.");
  const message = buildSalarySlipWhatsAppMessage(salary, detailed, pdfUrl);
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  if (popup && !popup.closed) popup.location.href = url;
  else {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = url;
  }
  return { number, url, message, pdfUrl };
}

export function createSalarySlipWhatsAppMessage({ salary, detailed, pdfUrl = "" }) {
  return buildSalarySlipWhatsAppMessage(salary, detailed, pdfUrl);
}

export default {
  normalizeWhatsAppNumber,
  buildSalarySlipWhatsAppMessage,
  createSalarySlipWhatsAppMessage,
  getEmployeeWhatsAppNumber,
  sendSalarySlipToWhatsApp,
};
