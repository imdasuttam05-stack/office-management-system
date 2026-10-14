import express from "express";

import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
} from "../controllers/expenseController.js";

import auth from "../middleware/auth.js";
import requireCompanyContext from "../middleware/companyContext.js";
import requireRole from "../middleware/role.js";

const router = express.Router();
router.use(auth, requireCompanyContext);

router.post(
  "/",
  requireRole(
    "Admin",
    "Manager",
    "Employee"
  ),
  createExpense
);

router.get(
  "/",
  getExpenses
);

router.get(
  "/:id",
  getExpenseById
);

router.put(
  "/:id",
  updateExpense
);

router.delete(
  "/:id",
  requireRole("Admin"),
  deleteExpense
);

router.patch(
  "/:id/approve",
  requireRole(
    "Admin",
    "Manager"
  ),
  approveExpense
);

router.patch(
  "/:id/reject",
  requireRole(
    "Admin",
    "Manager"
  ),
  rejectExpense
);

export default router;
