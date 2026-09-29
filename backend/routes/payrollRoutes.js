import express from "express";

import auth from "../middleware/auth.js";

import {
  createPayroll,
  getPayrolls,
  getPayrollById,
} from "../controllers/payrollController.js";

const router = express.Router();

router.use(auth);

router.get("/", getPayrolls);

router.post("/", createPayroll);

router.get("/:id", getPayrollById);

export default router;
