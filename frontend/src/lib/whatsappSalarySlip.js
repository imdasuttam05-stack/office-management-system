export function normalizeWhatsAppNumber(value, countryCode = "91") {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // Indian local numbers such as 9876543210 -> 919876543210.
  if (digits.length === 10 && digits.startsWith("0") === false) {
    digits = `${countryCode}${digits}`;
  }

  // 0XXXXXXXXXX -> country code + XXXXXXXXXX.
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = `${countryCode}${digits.slice(1)}`;
  }

  // Keep a reasonable international WhatsApp number length.
  if (digits.length < 11 || digits.length > 15) return "";

  return digits;
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function minutesText(value) {
  const total = Math.max(0, Math.round(Number(value || 0)));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

function hoursText(value) {
  const totalMinutes = Math.max(0, Math.round(Number(value || 0) * 60));
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`;
}

export function buildSalarySlipWhatsAppMessage(salary, detailed = null) {
  const slip = detailed?.slip || {};
  const employee = detailed?.salary?.employeeId || salary?.employeeId || {};

  const month = slip.monthLabel ||
    (salary?.month && salary?.year ? `${salary.month}/${salary.year}` : "");

  const name = slip.employeeName || employee.name || "Employee";
  const code = slip.employeeCode || employee.employeeCode || "";
  const designation = slip.designation || employee.designation || "";
  const gross = slip?.totals?.earnings ?? salary?.grossSalary ?? 0;
  const net = slip?.totals?.netPayable ?? salary?.netSalary ?? 0;

  const basic = slip?.earnings?.basic ?? salary?.basicSalary ?? employee.basicSalary ?? 0;
  const hra = slip?.earnings?.hra ?? employee.hra ?? 0;
  const conveyance = slip?.earnings?.conveyance ?? employee.conveyance ?? 0;

  const pf = slip?.deductions?.pf ?? employee.pfAmount ?? 0;
  const esi = slip?.deductions?.esi ?? employee.esiAmount ?? 0;
  const pt = slip?.deductions?.professionalTax ?? employee.professionalTax ?? 0;
  const cutting = slip?.deductions?.cutting ?? salary?.cuttingAmount ?? 0;
  const otherDeduction = slip?.deductions?.other ?? 0;

  const otHours = slip?.totals?.overtimeApprovedHours ?? salary?.overtimeApprovedHours ?? 0;
  const otAmount = slip?.totals?.overtimeAmount ?? salary?.overtimeAmount ?? 0;
  const cuttingMinutes = slip?.totals?.cuttingApprovedMinutes ?? salary?.cuttingApprovedMinutes ?? 0;

  const company = slip.companyName || employee.companyName || "Company";

  return [
    `*${company}*`,
    `*Salary Slip - ${month}*`,
    "",
    `Employee: ${name}`,
    code ? `Employee ID: ${code}` : "",
    designation ? `Designation: ${designation}` : "",
    "",
    `Basic: ${money(basic)}`,
    `HRA: ${money(hra)}`,
    `Conveyance: ${money(conveyance)}`,
    `Gross Salary: ${money(gross)}`,
    "",
    otAmount > 0 || Number(otHours) > 0
      ? `Approved OT: ${hoursText(otHours)} | ${money(otAmount)}`
      : "",
    cuttingMinutes > 0 || cutting > 0
      ? `Approved Fine/Cutting: ${minutesText(cuttingMinutes)} | ${money(cutting)}`
      : "",
    "",
    `PF: ${money(pf)}`,
    `ESI: ${money(esi)}`,
    `Professional Tax: ${money(pt)}`,
    `Other Deduction: ${money(otherDeduction)}`,
    `Total Deductions: ${money(slip?.totals?.deductions ?? salary?.deductions ?? 0)}`,
    "",
    `*NET PAYABLE: ${money(net)}*`,
    "",
    "This salary slip was generated from the Office Management System.",
  ].filter(Boolean).join("\n");
}

export function sendSalarySlipToWhatsApp({
  salary,
  detailed = null,
  countryCode = "91",
}) {
  const employee = detailed?.salary?.employeeId || salary?.employeeId || {};
  const mobile =
    employee?.mobile ||
    employee?.phone ||
    employee?.mobileNo ||
    employee?.mobile_no ||
    "";

  const number = normalizeWhatsAppNumber(mobile, countryCode);

  if (!number) {
    throw new Error(
      "Employee WhatsApp number is missing or invalid. Please update Mobile No. in Employee Master."
    );
  }

  const message = buildSalarySlipWhatsAppMessage(salary, detailed);
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.href = url;
  }

  return { number, url, message };
}
