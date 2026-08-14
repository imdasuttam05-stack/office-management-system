import express from "express";
import {
  employees, createEmployee, updateEmployee,
  attendance, saveAttendance,
  leaves, createLeave, leaveStatus,
  holidays, createHoliday,
  generateSalary, salaries, salarySlip
} from "../controllers/hrController.js";
import { hrAuth, hrAdmin } from "../middleware/hrAuth.js";

const router = express.Router();
router.use(hrAuth);

// Payroll landing endpoint used by older frontend versions.
// Returns the latest salary records instead of "route not found".
router.get("/", salaries);


router.get("/employees", employees);
router.post("/employees", hrAdmin, createEmployee);
router.put("/employees/:id", hrAdmin, updateEmployee);

router.get("/attendance", attendance);
router.post("/attendance", saveAttendance);

router.get("/leaves", leaves);
router.post("/leaves", createLeave);
router.patch("/leaves/:id/status", hrAdmin, leaveStatus);

router.get("/holidays", holidays);
router.post("/holidays", hrAdmin, createHoliday);

router.get("/salaries", salaries);
router.post("/salaries/generate", hrAdmin, generateSalary);
router.get("/salaries/:id/slip", salarySlip);

export default router;
