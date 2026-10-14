import express from "express";

import auth from "../middleware/auth.js";
import requireCompanyContext from "../middleware/companyContext.js";

import {
  createPayroll,
  getPayrolls,
  getPayrollById,
} from "../controllers/payrollController.js";

const router = express.Router();

router.use(auth, requireCompanyContext);

router.get("/", getPayrolls);

router.post("/", createPayroll);

router.get("/:id", getPayrollById);

export default router;
