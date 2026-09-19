import express from "express";

import {
  getEmployees,
  createEmployee,
  updateEmployee,

  getOptions,
  saveOptions,
  createCompany,

  getAttendance,
  saveAttendance,
  importAttendanceExcel,

  getAttendanceSettings,
  saveAttendanceSettings,

  getShifts,
  createShift,
  updateShift,

  getLeaves,
  createLeave,
  updateLeaveStatus,

  getHolidays,
  createHoliday,

  getSalaries,
  generateSalary,
  getSalarySlip,

  payrollApprovals,
  approvePayrollAdjustments,
} from "../controllers/hrController.js";

import {
  getEmployeeTasks,
  createEmployeeTask,
  updateEmployeeTask,
  getEmployeeLetterTypes,
  previewEmployeeLetter,
  sendEmployeeLetter,
  getEmployeeLetters,
} from "../controllers/employeeCommunicationController.js";

const router = express.Router();


/* =========================================================
   EMPLOYEES
========================================================= */

// /api/hr/employees
router.get("/employees", getEmployees);
router.post("/employees", createEmployee);
router.put("/employees/:id", updateEmployee);


// Payroll compatibility
// /api/payroll/employees
router.get("/payroll/employees", getEmployees);
router.post("/payroll/employees", createEmployee);
router.put("/payroll/employees/:id", updateEmployee);


/* =========================================================
   EMPLOYEE TASKS & LETTERS
========================================================= */
router.get("/employee-tasks", getEmployeeTasks);
router.post("/employee-tasks", createEmployeeTask);
router.put("/employee-tasks/:id", updateEmployeeTask);

router.get("/employee-letter-types", getEmployeeLetterTypes);
router.post("/employee-letters/preview", previewEmployeeLetter);
router.post("/employee-letters/send", sendEmployeeLetter);
router.get("/employee-letters", getEmployeeLetters);

// /api/payroll compatibility
router.get("/payroll/employee-tasks", getEmployeeTasks);
router.post("/payroll/employee-tasks", createEmployeeTask);
router.put("/payroll/employee-tasks/:id", updateEmployeeTask);
router.get("/payroll/employee-letter-types", getEmployeeLetterTypes);
router.post("/payroll/employee-letters/preview", previewEmployeeLetter);
router.post("/payroll/employee-letters/send", sendEmployeeLetter);
router.get("/payroll/employee-letters", getEmployeeLetters);


/* =========================================================
   OPTIONS
========================================================= */

// /api/hr/options
router.get("/options", getOptions);
router.post("/options", saveOptions);
router.put("/options", saveOptions);


// Payroll compatibility
// /api/payroll/options
router.get("/payroll/options", getOptions);
router.post("/payroll/options", saveOptions);


/* =========================================================
   COMPANY
========================================================= */

router.post("/company", createCompany);
router.post("/companies", createCompany);

// Payroll compatibility
router.post("/payroll/company", createCompany);


/* =========================================================
   ATTENDANCE
========================================================= */

// /api/hr/attendance
router.get("/attendance", getAttendance);
router.post("/attendance", saveAttendance);
router.post(
  "/attendance/import",
  importAttendanceExcel
);


// Payroll compatibility
// /api/payroll/attendance
router.get("/payroll/attendance", getAttendance);
router.post("/payroll/attendance", saveAttendance);
router.post(
  "/payroll/attendance/import",
  importAttendanceExcel
);


/* =========================================================
   ATTENDANCE SETTINGS
========================================================= */

// /api/hr/attendance-settings
router.get(
  "/attendance-settings",
  getAttendanceSettings
);

router.post(
  "/attendance-settings",
  saveAttendanceSettings
);


// /api/payroll/attendance/settings
router.get(
  "/attendance/settings",
  getAttendanceSettings
);

router.post(
  "/attendance/settings",
  saveAttendanceSettings
);


/* =========================================================
   SHIFTS
========================================================= */

// /api/hr/shifts
router.get("/shifts", getShifts);
router.post("/shifts", createShift);
router.put("/shifts/:id", updateShift);


// /api/payroll/shifts
router.get("/payroll/shifts", getShifts);
router.post("/payroll/shifts", createShift);
router.put(
  "/payroll/shifts/:id",
  updateShift
);


/* =========================================================
   LEAVES
========================================================= */

// /api/hr/leaves
router.get("/leaves", getLeaves);
router.post("/leaves", createLeave);
router.put(
  "/leaves/:id/status",
  updateLeaveStatus
);


// /api/payroll/leaves
router.get("/payroll/leaves", getLeaves);
router.post("/payroll/leaves", createLeave);
router.put(
  "/payroll/leaves/:id/status",
  updateLeaveStatus
);


/* =========================================================
   HOLIDAYS
========================================================= */

// /api/hr/holidays
router.get("/holidays", getHolidays);
router.post("/holidays", createHoliday);


// /api/payroll/holidays
router.get("/payroll/holidays", getHolidays);
router.post("/payroll/holidays", createHoliday);


/* =========================================================
   SALARIES
========================================================= */

// /api/hr/salaries
router.get("/salaries", getSalaries);

router.post(
  "/salary/generate",
  generateSalary
);

router.get(
  "/salary-slip/:id",
  getSalarySlip
);


// /api/payroll/salaries
router.get(
  "/payroll/salaries",
  getSalaries
);

router.post(
  "/payroll/salary/generate",
  generateSalary
);

router.get(
  "/payroll/salary-slip/:id",
  getSalarySlip
);


/* =========================================================
   PAYROLL APPROVALS
========================================================= */

// /api/hr/payroll-approvals
router.get(
  "/payroll-approvals",
  payrollApprovals
);

router.post(
  "/payroll-approvals/adjustments",
  approvePayrollAdjustments
);


// /api/payroll/payroll/approvals
router.get(
  "/payroll/approvals",
  payrollApprovals
);

router.post(
  "/payroll/approvals/adjustments",
  approvePayrollAdjustments
);


/* =========================================================
   EXPORT
========================================================= */

export default router;
