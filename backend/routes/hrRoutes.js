import express from "express";
import multer from "multer";
import {
  employees, createEmployee, updateEmployee, payrollOptions, savePayrollOptions, createCompany,
  attendance, saveAttendance,
  leaves, createLeave, leaveStatus,
  holidays, createHoliday,
  generateSalary, salaries, salarySlip, attendanceImport, attendanceSettings, saveAttendanceSettings, shifts, createShift, updateShift
} from "../controllers/hrController.js";
import { hrAuth, hrAdmin } from "../middleware/hrAuth.js";
import { payrollApprovals, approvePayrollAdjustments } from "../controllers/payrollApprovalController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(hrAuth);

// Payroll landing endpoint used by older frontend versions.
// Returns the latest salary records instead of "route not found".
router.get("/", salaries);


router.get("/employees", employees);
router.get("/options", payrollOptions);
router.put("/options", hrAdmin, savePayrollOptions);
router.post("/companies", hrAdmin, createCompany);
router.post("/employees", hrAdmin, createEmployee);
router.put("/employees/:id", hrAdmin, updateEmployee);

router.get("/attendance", attendance);
router.post("/attendance", saveAttendance);
router.post("/attendance/import", upload.single("file"), attendanceImport);
router.get("/attendance/settings", attendanceSettings);
router.put("/attendance/settings", hrAdmin, saveAttendanceSettings);
router.get("/attendance/shifts", shifts);
router.post("/attendance/shifts", hrAdmin, createShift);
router.put("/attendance/shifts/:id", hrAdmin, updateShift);

router.get("/leaves", leaves);
router.post("/leaves", createLeave);
router.patch("/leaves/:id/status", hrAdmin, leaveStatus);

router.get("/holidays", holidays);
router.post("/holidays", hrAdmin, createHoliday);

router.get("/salaries", salaries);
router.get("/payroll/approvals", payrollApprovals);
router.post("/payroll/approvals/bulk", hrAdmin, approvePayrollAdjustments);
router.post("/salaries/generate", hrAdmin, generateSalary);
router.get("/salaries/:id/slip", salarySlip);

export default router;
