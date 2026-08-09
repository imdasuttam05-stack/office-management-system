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

const router = express.Router();

router.post(
  "/",
  auth,
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
  deleteExpense
);

router.patch(
  "/:id/approve",
  auth,
  approveExpense
);

router.patch(
  "/:id/reject",
  auth,
  rejectExpense
);

export default router;
