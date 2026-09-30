/**
 * WhatsApp Salary Slip Helper
 *
 * File:
 * frontend/src/lib/whatsappSalarySlip.js
 */

/* =========================================================
   NORMALIZE WHATSAPP NUMBER
   ========================================================= */

export function normalizeWhatsAppNumber(phone) {
  if (!phone) {
    return "";
  }

  let number = String(phone).trim();

  // Remove spaces, +, -, brackets and other characters
  number = number.replace(/[^\d]/g, "");

  // Example: 919876543210
  if (number.length === 12 && number.startsWith("91")) {
    return number;
  }

  // Example: 9876543210
  if (number.length === 10) {
    return `91${number}`;
  }

  // Example: 09876543210
  if (number.length === 11 && number.startsWith("0")) {
    return `91${number.substring(1)}`;
  }

  // International number
  return number;
}


/* =========================================================
   VALIDATE WHATSAPP NUMBER
   ========================================================= */

export function isValidWhatsAppNumber(phone) {
  const number = normalizeWhatsAppNumber(phone);

  return /^91[6-9]\d{9}$/.test(number);
}


/* =========================================================
   FORMAT SALARY
   ========================================================= */

export function formatSalary(amount) {
  const value = Number(amount || 0);

  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


/* =========================================================
   CREATE SALARY SLIP MESSAGE
   ========================================================= */

export function createSalarySlipWhatsAppMessage({
  employeeName = "",
  month = "",
  netSalary = 0,
  companyName = "",
  pdfUrl = "",
}) {
  const name = employeeName || "Employee";

  const salaryMonth = month || "Salary";

  const salary = formatSalary(netSalary);

  let message = `Hello ${name},

Your salary slip for ${salaryMonth} is ready.

Company: ${companyName || "Company"}

Net Salary: ₹${salary}`;

  if (pdfUrl) {
    message += `

Salary Slip PDF:
${pdfUrl}`;
  }

  message += `

Regards,
${companyName || "HR / Accounts"}`;

  return message;
}


/* =========================================================
   OPEN WHATSAPP WITH SALARY MESSAGE
   ========================================================= */

export function sendSalarySlipWhatsApp({
  employeeName = "",
  phone = "",
  month = "",
  netSalary = 0,
  companyName = "",
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

  return whatsappUrl;
}


/* =========================================================
   GENERIC WHATSAPP FUNCTION
   ========================================================= */

export function openWhatsApp({
  phone = "",
  message = "",
}) {
  const whatsappNumber = normalizeWhatsAppNumber(phone);

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

  return whatsappUrl;
}


/* =========================================================
   GET EMPLOYEE PHONE NUMBER
   ========================================================= */

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


/* =========================================================
   GET EMPLOYEE NAME
   ========================================================= */

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

  const firstName =
    employee.firstName || "";

  const lastName =
    employee.lastName || "";

  const fullName =
    `${firstName} ${lastName}`.trim();

  return fullName || "Employee";
}


/* =========================================================
   GET NET SALARY
   ========================================================= */

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


/* =========================================================
   PREPARE SALARY SLIP DATA
   ========================================================= */

export function getSalarySlipWhatsAppData({
  employee = {},
  salary = {},
  month = "",
  companyName = "",
  pdfUrl = "",
}) {
  const phone =
    getEmployeeWhatsAppNumber(employee);

  const employeeName =
    getEmployeeName(employee);

  const netSalary =
    getEmployeeNetSalary(
      employee,
      salary
    );

  return {
    employeeName,
    phone,
    month,
    netSalary,
    companyName,
    pdfUrl,
  };
}


/* =========================================================
   SEND EMPLOYEE SALARY SLIP WHATSAPP
   ========================================================= */

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

  return sendSalarySlipWhatsApp(data);
}


/* =========================================================
   SEND SALARY SLIP FROM SIMPLE DATA
   ========================================================= */

export function sendSimpleSalarySlipWhatsApp({
  employeeName = "",
  phone = "",
  month = "",
  netSalary = 0,
  companyName = "",
  pdfUrl = "",
}) {
  return sendSalarySlipWhatsApp({
    employeeName,
    phone,
    month,
    netSalary,
    companyName,
    pdfUrl,
  });
}


/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

export default {
  normalizeWhatsAppNumber,
  isValidWhatsAppNumber,
  formatSalary,
  createSalarySlipWhatsAppMessage,
  sendSalarySlipWhatsApp,
  openWhatsApp,
  getEmployeeWhatsAppNumber,
  getEmployeeName,
  getEmployeeNetSalary,
  getSalarySlipWhatsAppData,
  sendEmployeeSalarySlipWhatsApp,
  sendSimpleSalarySlipWhatsApp,
};
