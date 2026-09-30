export function normalizeWhatsAppNumber(phone) {
  if (!phone) return "";

  let number = String(phone).trim();

  // Remove +, spaces, -, brackets etc.
  number = number.replace(/\D/g, "");

  // 10 digit Indian number
  if (number.length === 10) {
    return `91${number}`;
  }

  // 0XXXXXXXXXX
  if (number.length === 11 && number.startsWith("0")) {
    return `91${number.slice(1)}`;
  }

  // Already 91XXXXXXXXXX
  if (number.length === 12 && number.startsWith("91")) {
    return number;
  }

  return number;
}

export function isValidWhatsAppNumber(phone) {
  const number = normalizeWhatsAppNumber(phone);

  return /^91[6-9]\d{9}$/.test(number);
}

export function formatSalary(amount) {
  const value = Number(amount || 0);

  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function createSalarySlipWhatsAppMessage({
  employeeName = "Employee",
  month = "",
  netSalary = 0,
  companyName = "Company",
  pdfUrl = "",
}) {
  let message = `Hello ${employeeName},

Your salary slip for ${month} is ready.

Company: ${companyName}

Net Salary: ₹${formatSalary(netSalary)}`;

  if (pdfUrl) {
    message += `

Salary Slip PDF:
${pdfUrl}`;
  }

  message += `

Regards,
${companyName}
HR / Accounts`;

  return message;
}

export function sendSalarySlipWhatsApp({
  employeeName = "Employee",
  phone = "",
  month = "",
  netSalary = 0,
  companyName = "Company",
  pdfUrl = "",
}) {
  const whatsappNumber = normalizeWhatsAppNumber(phone);

  if (!whatsappNumber) {
    alert("Employee WhatsApp/mobile number is missing.");
    return false;
  }

  if (!isValidWhatsAppNumber(phone)) {
    alert("Please enter a valid Indian WhatsApp mobile number.");
    return false;
  }

  const message = createSalarySlipWhatsAppMessage({
    employeeName,
    month,
    netSalary,
    companyName,
    pdfUrl,
  });

  const whatsappUrl =
    `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  window.open(
    whatsappUrl,
    "_blank",
    "noopener,noreferrer"
  );

  return true;
}

export function getEmployeeWhatsAppNumber(employee = {}) {
  return (
    employee.whatsappNumber ||
    employee.whatsapp ||
    employee.mobileNumber ||
    employee.mobile ||
    employee.phone ||
    employee.contactNumber ||
    employee.contact ||
    ""
  );
}

export function getEmployeeName(employee = {}) {
  if (employee.name) return employee.name;

  if (employee.employeeName) {
    return employee.employeeName;
  }

  if (employee.fullName) {
    return employee.fullName;
  }

  const firstName = employee.firstName || "";
  const lastName = employee.lastName || "";

  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "Employee";
}

export function getEmployeeNetSalary(
  employee = {},
  salary = {}
) {
  return (
    salary.netSalary ??
    salary.netPay ??
    salary.netAmount ??
    salary.net ??
    employee.netSalary ??
    employee.netPay ??
    employee.netAmount ??
    0
  );
}

export function getSalarySlipWhatsAppData({
  employee = {},
  salary = {},
  month = "",
  companyName = "",
  pdfUrl = "",
}) {
  return {
    employeeName: getEmployeeName(employee),

    phone: getEmployeeWhatsAppNumber(employee),

    month,

    netSalary: getEmployeeNetSalary(
      employee,
      salary
    ),

    companyName,

    pdfUrl,
  };
}

export function sendEmployeeSalarySlipWhatsApp({
  employee = {},
  salary = {},
  month = "",
  companyName = "",
  pdfUrl = "",
}) {
  const data = getSalarySlipWhatsAppData({
    employee,
    salary,
    month,
    companyName,
    pdfUrl,
  });

  return sendSalarySlipWhatsApp(data);
}

export function openWhatsApp({
  phone = "",
  message = "",
}) {
  const whatsappNumber = normalizeWhatsAppNumber(phone);

  if (!whatsappNumber) {
    alert("WhatsApp/mobile number is missing.");
    return false;
  }

  if (!isValidWhatsAppNumber(phone)) {
    alert("Please enter a valid Indian WhatsApp mobile number.");
    return false;
  }

  const whatsappUrl =
    `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  window.open(
    whatsappUrl,
    "_blank",
    "noopener,noreferrer"
  );

  return true;
}

export default {
  normalizeWhatsAppNumber,
  isValidWhatsAppNumber,
  formatSalary,
  createSalarySlipWhatsAppMessage,
  sendSalarySlipWhatsApp,
  getEmployeeWhatsAppNumber,
  getEmployeeName,
  getEmployeeNetSalary,
  getSalarySlipWhatsAppData,
  sendEmployeeSalarySlipWhatsApp,
  openWhatsApp,
};
