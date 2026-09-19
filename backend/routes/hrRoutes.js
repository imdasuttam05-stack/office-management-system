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
router.get(
  "/employees",
  getEmployees
);

// POST /api/hr/employees
router.post(
  "/employees",
  createEmployee
);

// PUT /api/hr/employees/:id
router.put(
  "/employees/:id",
  updateEmployee
);


/* =========================================================
   OPTIONS
========================================================= */

// GET /api/payroll/options
router.get(
  "/options",
  getOptions
);

// POST /api/payroll/options
router.post(
  "/options",
  saveOptions
);

// PUT /api/payroll/options
router.put(
  "/options",
  saveOptions
);


/* =========================================================
   COMPANY
========================================================= */

// POST /api/payroll/company
router.post(
  "/company",
  createCompany
);

// POST /api/payroll/companies
// Frontend compatibility
router.post(
  "/companies",
  createCompany
);


/* =========================================================
   ATTENDANCE
========================================================= */

// GET /api/payroll/attendance
router.get(
  "/attendance",
  getAttendance
);

// POST /api/payroll/attendance
router.post(
  "/attendance",
  saveAttendance
);

// POST /api/payroll/attendance/import
router.post(
  "/attendance/import",
  importAttendanceExcel
);


/* =========================================================
   ATTENDANCE SETTINGS
========================================================= */

// GET /api/payroll/attendance/settings
router.get(
  "/attendance/settings",
  getAttendanceSettings
);

// POST /api/payroll/attendance/settings
router.post(
  "/attendance/settings",
  saveAttendanceSettings
);

// PUT /api/payroll/attendance/settings
router.put(
  "/attendance/settings",
  saveAttendanceSettings
);


/* =========================================================
   SHIFTS
========================================================= */

// IMPORTANT:
// Frontend uses:
//
// /api/payroll/attendance/shifts

// GET
router.get(
  "/attendance/shifts",
  getShifts
);

// POST
router.post(
  "/attendance/shifts",
  createShift
);

// PUT
router.put(
  "/attendance/shifts/:id",
  updateShift
);


/* =========================================================
   NORMAL SHIFTS COMPATIBILITY
========================================================= */

// /api/payroll/shifts
router.get(
  "/shifts",
  getShifts
);

router.post(
  "/shifts",
  createShift
);

router.put(
  "/shifts/:id",
  updateShift
);


/* =========================================================
   LEAVES
========================================================= */

// GET /api/payroll/leaves
router.get(
  "/leaves",
  getLeaves
);

// POST /api/payroll/leaves
router.post(
  "/leaves",
  createLeave
);

// PUT /api/payroll/leaves/:id/status
router.put(
  "/leaves/:id/status",
  updateLeaveStatus
);

// PATCH /api/payroll/leaves/:id/status
// Frontend compatibility
router.patch(
  "/leaves/:id/status",
  updateLeaveStatus
);


/* =========================================================
   HOLIDAYS
========================================================= */

// GET /api/payroll/holidays
router.get(
  "/holidays",
  getHolidays
);

// POST /api/payroll/holidays
router.post(
  "/holidays",
  createHoliday
);


/* =========================================================
   SALARY
========================================================= */

// GET /api/payroll/salaries
router.get(
  "/salaries",
  getSalaries
);

// POST /api/payroll/salaries/generate
router.post(
  "/salaries/generate",
  generateSalary
);

// POST /api/payroll/salary/generate
// Compatibility
router.post(
  "/salary/generate",
  generateSalary
);

// GET /api/payroll/salaries/:id/slip
router.get(
  "/salaries/:id/slip",
  getSalarySlip
);

// GET /api/payroll/salary-slip/:id
// Compatibility
router.get(
  "/salary-slip/:id",
  getSalarySlip
);


/* =========================================================
   PAYROLL APPROVALS
========================================================= */

// GET /api/payroll/payroll/approvals
router.get(
  "/payroll/approvals",
  payrollApprovals
);

// GET /api/payroll/approvals
// Frontend compatibility
router.get(
  "/approvals",
  payrollApprovals
);


/* =========================================================
   PAYROLL APPROVAL BULK
========================================================= */

// IMPORTANT:
// Frontend uses:
//
// POST /api/payroll/approvals/bulk

router.post(
  "/approvals/bulk",
  approvePayrollAdjustments
);

// Compatibility:
// POST /api/payroll/payroll/approvals/bulk

router.post(
  "/payroll/approvals/bulk",
  approvePayrollAdjustments
);


/* =========================================================
   OLD PAYROLL APPROVAL ROUTES
========================================================= */

router.get(
  "/payroll-approvals",
  payrollApprovals
);

router.post(
  "/payroll-approvals/adjustments",
  approvePayrollAdjustments
);


/* =========================================================
   EXPORT
========================================================= */

export default router;
