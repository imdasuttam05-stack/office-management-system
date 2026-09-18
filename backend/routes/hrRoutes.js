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

// Get all employees
router.get("/employees", getEmployees);

// Create employee
router.post("/employees", createEmployee);

// Update employee
router.put("/employees/:id", updateEmployee);


/* =========================================================
   HR OPTIONS
========================================================= */

// Get HR options
router.get("/options", getOptions);

// Save HR options
router.post("/options", saveOptions);


/* =========================================================
   COMPANY
========================================================= */

// Create company
router.post("/company", createCompany);


/* =========================================================
   ATTENDANCE
========================================================= */

// Get attendance
// Example:
// GET /api/hr/attendance?from=2026-09-01&to=2026-09-30
router.get("/attendance", getAttendance);

// Save / update attendance
router.post("/attendance", saveAttendance);

// Import attendance Excel
router.post("/attendance/import", importAttendanceExcel);


/* =========================================================
   ATTENDANCE SETTINGS
========================================================= */

// Get attendance settings
router.get(
  "/attendance-settings",
  getAttendanceSettings
);

// Save attendance settings
router.post(
  "/attendance-settings",
  saveAttendanceSettings
);


/* =========================================================
   SHIFTS
========================================================= */

// Get shifts
router.get("/shifts", getShifts);

// Create shift
router.post("/shifts", createShift);

// Update shift
router.put("/shifts/:id", updateShift);


/* =========================================================
   LEAVES
========================================================= */

// Get leaves
router.get("/leaves", getLeaves);

// Create leave
router.post("/leaves", createLeave);

// Update leave status
router.put(
  "/leaves/:id/status",
  updateLeaveStatus
);


/* =========================================================
   HOLIDAYS
========================================================= */

// Get holidays
router.get("/holidays", getHolidays);

// Create holiday
router.post("/holidays", createHoliday);


/* =========================================================
   SALARY
========================================================= */

// Get salaries
router.get("/salaries", getSalaries);

// Generate salary
router.post(
  "/salary/generate",
  generateSalary
);

// Get salary slip
router.get(
  "/salary-slip/:id",
  getSalarySlip
);


/* =========================================================
   PAYROLL APPROVALS
========================================================= */

// Existing HR payroll approval route
// Example:
// GET /api/payroll-approvals
router.get(
  "/payroll-approvals",
  payrollApprovals
);

// Existing payroll adjustment approval
router.post(
  "/payroll-approvals/adjustments",
  approvePayrollAdjustments
);


/* =========================================================
   PAYROLL FRONTEND COMPATIBILITY ROUTE
========================================================= */

/*
   Your frontend is requesting:

   GET
   /api/payroll/payroll/approvals?month=9&year=2026

   If this router is mounted as:

   app.use("/api/payroll", router);

   then this route becomes:

   /api/payroll/payroll/approvals
*/

router.get(
  "/payroll/approvals",
  payrollApprovals
);


/* =========================================================
   EXPORT
========================================================= */

export default router;
