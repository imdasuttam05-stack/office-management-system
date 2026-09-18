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

router.get("/employees", getEmployees);
router.post("/employees", createEmployee);
router.put("/employees/:id", updateEmployee);


/* =========================================================
   HR OPTIONS / COMPANY
========================================================= */

router.get("/options", getOptions);
router.post("/options", saveOptions);

router.post("/company", createCompany);


/* =========================================================
   ATTENDANCE
========================================================= */

// Get attendance
router.get("/attendance", getAttendance);

// Save / update attendance
router.post("/attendance", saveAttendance);

// Import attendance from Excel
router.post("/attendance/import", importAttendanceExcel);


/* =========================================================
   ATTENDANCE SETTINGS
========================================================= */

router.get("/attendance-settings", getAttendanceSettings);
router.post("/attendance-settings", saveAttendanceSettings);


/* =========================================================
   SHIFTS
========================================================= */

router.get("/shifts", getShifts);
router.post("/shifts", createShift);
router.put("/shifts/:id", updateShift);


/* =========================================================
   LEAVES
========================================================= */

router.get("/leaves", getLeaves);
router.post("/leaves", createLeave);
router.put("/leaves/:id/status", updateLeaveStatus);


/* =========================================================
   HOLIDAYS
========================================================= */

router.get("/holidays", getHolidays);
router.post("/holidays", createHoliday);


/* =========================================================
   SALARY / PAYROLL
========================================================= */

router.get("/salaries", getSalaries);

router.post("/salary/generate", generateSalary);

router.get("/salary-slip/:id", getSalarySlip);


/* =========================================================
   PAYROLL APPROVAL
========================================================= */

router.get("/payroll-approvals", payrollApprovals);

router.post(
  "/payroll-approvals/adjustments",
  approvePayrollAdjustments
);


export default router;
