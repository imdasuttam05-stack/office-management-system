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
import requireRole from "../middleware/role.js";

const router = express.Router();

router.post(
  "/",
  auth,
  requireRole(
    "Admin",
    "Manager",
    "Employee"
  ),
  createExpense
);

router.get(
  "/",
  auth,
  getExpenses
);

router.get(
  "/:id",
  auth,
  getExpenseById
);

router.put(
  "/:id",
  auth,
  updateExpense
);

router.delete(
  "/:id",
  auth,
  requireRole("Admin"),
  deleteExpense
);

router.patch(
  "/:id/approve",
  auth,
  requireRole(
    "Admin",
    "Manager"
  ),
  approveExpense
);

router.patch(
  "/:id/reject",
  auth,
  requireRole(
    "Admin",
    "Manager"
  ),
  rejectExpense
);

export default router;
