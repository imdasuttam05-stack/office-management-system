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

const router = express.Router();

/* =========================================================
   EMPLOYEES
========================================================= */

// GET /api/hr/employees
router.get("/employees", getEmployees);

// POST /api/hr/employees
router.post("/employees", createEmployee);

// PUT /api/hr/employees/:id
router.put("/employees/:id", updateEmployee);


/* =========================================================
   OPTIONS
========================================================= */

// GET /api/hr/options
router.get("/options", getOptions);

// POST /api/hr/options
router.post("/options", saveOptions);


/* =========================================================
   COMPANY
========================================================= */

// POST /api/hr/company
router.post("/company", createCompany);


/* =========================================================
   ATTENDANCE
========================================================= */

// GET /api/hr/attendance
router.get("/attendance", getAttendance);

// POST /api/hr/attendance
router.post("/attendance", saveAttendance);

// POST /api/hr/attendance/import
router.post(
  "/attendance/import",
  importAttendanceExcel
);


/* =========================================================
   ATTENDANCE SETTINGS
========================================================= */

// Original route
// GET /api/hr/attendance-settings
router.get(
  "/attendance-settings",
  getAttendanceSettings
);

// Original route
// POST /api/hr/attendance-settings
router.post(
  "/attendance-settings",
  saveAttendanceSettings
);


// Compatibility route
// GET /api/payroll/attendance/settings
router.get(
  "/attendance/settings",
  getAttendanceSettings
);

// Compatibility route
// POST /api/payroll/attendance/settings
router.post(
  "/attendance/settings",
  saveAttendanceSettings
);


/* =========================================================
   SHIFTS
========================================================= */

// GET /api/hr/shifts
router.get("/shifts", getShifts);

// POST /api/hr/shifts
router.post("/shifts", createShift);

// PUT /api/hr/shifts/:id
router.put("/shifts/:id", updateShift);


/* =========================================================
   LEAVES
========================================================= */

// GET /api/hr/leaves
router.get("/leaves", getLeaves);

// POST /api/hr/leaves
router.post("/leaves", createLeave);

// PUT /api/hr/leaves/:id/status
router.put(
  "/leaves/:id/status",
  updateLeaveStatus
);


/* =========================================================
   HOLIDAYS
========================================================= */

// GET /api/hr/holidays
router.get("/holidays", getHolidays);

// POST /api/hr/holidays
router.post("/holidays", createHoliday);


/* =========================================================
   SALARY
========================================================= */

// GET /api/hr/salaries
router.get("/salaries", getSalaries);

// POST /api/hr/salary/generate
router.post(
  "/salary/generate",
  generateSalary
);

// GET /api/hr/salary-slip/:id
router.get(
  "/salary-slip/:id",
  getSalarySlip
);


/* =========================================================
   PAYROLL APPROVALS
========================================================= */

// Original route
// GET /api/hr/payroll-approvals
router.get(
  "/payroll-approvals",
  payrollApprovals
);

// POST /api/hr/payroll-approvals/adjustments
router.post(
  "/payroll-approvals/adjustments",
  approvePayrollAdjustments
);


// Compatibility route
// GET /api/payroll/payroll/approvals
router.get(
  "/payroll/approvals",
  payrollApprovals
);

// Compatibility route
// POST /api/payroll/payroll/approvals/adjustments
router.post(
  "/payroll/approvals/adjustments",
  approvePayrollAdjustments
);


/* =========================================================
   EXPORT
========================================================= */

export default router;
