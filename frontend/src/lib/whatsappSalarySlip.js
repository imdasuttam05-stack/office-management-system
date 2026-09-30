```javascript
// frontend/src/lib/whatsappSalarySlip.js

/**
 * Normalize Indian WhatsApp number.
 *
 * Examples:
 * 9876543210      -> 919876543210
 * 09876543210     -> 919876543210
 * +91 9876543210  -> 919876543210
 * 919876543210    -> 919876543210
 */
export function normalizeWhatsAppNumber(phone) {
  if (!phone) {
    return "";
  }

  let number = String(phone).trim();

  // Remove spaces, +, -, brackets and other characters.
  number = number.replace(/\D/g, "");

  // 10 digit Indian mobile number.
  if (number.length === 10) {
    return `91${number}`;
  }

  // 11 digit number beginning with 0.
  if (number.length === 11 && number.startsWith("0")) {
    return `91${number.substring(1)}`;
  }

  // Already has India country code.
  if (number.length === 12 && number.startsWith("91")) {
    return number;
  }

  return number;
}


/**
 * Validate Indian WhatsApp number.
 */
export function isValidWhatsAppNumber(phone) {
  const number = normalizeWhatsAppNumber(phone);

  return /^91[6-9]\d{9}$/.test(number);
}


/**
 * Format salary.
 */
export function formatSalary(amount) {
  const value = Number(amount || 0);

  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


/**
 * Create WhatsApp salary-slip message.
 */
export function createSalarySlipWhatsAppMessage({
  employeeName = "Employee",
  month = "",
  netSalary = 0,
  companyName = "Company",
  pdfUrl = "",
}) {
  let message = `Hello ${employeeName},

Your salary slip for ${month || "this month"} is ready.

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


/**
 * Open WhatsApp chat with salary message.
 *
 * NOTE:
 * Browser/WhatsApp Web cannot automatically attach
 * a local PDF file. This function opens WhatsApp with
 * the salary message and optional PDF URL.
 */
export function sendSalarySlipToWhatsApp({
  employeeName = "Employee",
  phone = "",
  month = "",
  netSalary = 0,
  companyName = "Company",
  pdfUrl = "",
}) {
  const whatsappNumber = normalizeWhatsAppNumber(phone);

  if (!whatsappNumber) {
    throw new Error(
      "Employee WhatsApp/mobile number is missing."
    );
  }

  if (!isValidWhatsAppNumber(phone)) {
    throw new Error(
      "Please enter a valid Indian WhatsApp mobile number."
    );
  }

  const message = createSalarySlipWhatsAppMessage({
    employeeName,
    month,
    netSalary,
    companyName,
    pdfUrl,
  });

  const whatsappUrl =
    `https://wa.me/${whatsappNumber}` +
    `?text=${encodeURIComponent(message)}`;

  window.open(
    whatsappUrl,
    "_blank",
    "noopener,noreferrer"
  );

  return true;
}


/**
 * Get employee WhatsApp/mobile number from
 * different possible employee fields.
 */
export function getEmployeeWhatsAppNumber(employee = {}) {
  return (
    employee.whatsappNumber ||
    employee.whatsapp ||
    employee.mobileNumber ||
    employee.mobile ||
    employee.phone ||
    employee.contactNumber ||
    employee.contact ||
    employee.phoneNumber ||
    ""
  );
}


/**
 * Get employee name.
 */
export function getEmployeeName(employee = {}) {
  if (employee.name) {
    return employee.name;
  }

  if (employee.employeeName) {
    return employee.employeeName;
  }

  if (employee.fullName) {
    return employee.fullName;
  }

  const firstName = employee.firstName || "";
  const lastName = employee.lastName || "";

  const fullName =
    `${firstName} ${lastName}`.trim();

  return fullName || "Employee";
}


/**
 * Get net salary from salary/employee object.
 */
export function getEmployeeNetSalary(
  employee = {},
  salary = {}
) {
  return (
    salary.netSalary ??
    salary.netPay ??
    salary.netAmount ??
    salary.net ??
    salary.totals?.netPayable ??
    employee.netSalary ??
    employee.netPay ??
    employee.netAmount ??
    0
  );
}


/**
 * Prepare salary slip WhatsApp data.
 */
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

    companyName:
      companyName ||
      employee.companyName ||
      "Company",

    pdfUrl,
  };
}


/**
 * Send employee salary slip to WhatsApp.
 */
export function sendEmployeeSalarySlipWhatsApp({
  employee = {},
  salary = {},
  month = "",
  companyName = "",
  pdfUrl = "",
}) {
  const data =
    getSalarySlipWhatsAppData({
      employee,
      salary,
      month,
      companyName,
      pdfUrl,
    });

  return sendSalarySlipToWhatsApp(data);
}


/**
 * Generic WhatsApp function.
 */
export function openWhatsApp({
  phone = "",
  message = "",
}) {
  const whatsappNumber =
    normalizeWhatsAppNumber(phone);

  if (!whatsappNumber) {
    throw new Error(
      "WhatsApp/mobile number is missing."
    );
  }

  if (!isValidWhatsAppNumber(phone)) {
    throw new Error(
      "Please enter a valid Indian WhatsApp mobile number."
    );
  }

  const whatsappUrl =
    `https://wa.me/${whatsappNumber}` +
    `?text=${encodeURIComponent(message || "")}`;

  window.open(
    whatsappUrl,
    "_blank",
    "noopener,noreferrer"
  );

  return true;
}


/**
 * Default export.
 */
export default {
  normalizeWhatsAppNumber,
  isValidWhatsAppNumber,
  formatSalary,
  createSalarySlipWhatsAppMessage,
  sendSalarySlipToWhatsApp,
  sendEmployeeSalarySlipWhatsApp,
  getEmployeeWhatsAppNumber,
  getEmployeeName,
  getEmployeeNetSalary,
  getSalarySlipWhatsAppData,
  openWhatsApp,
};
```
