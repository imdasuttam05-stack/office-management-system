import express from "express";
import auth from "../middleware/auth.js";

import {
  createExpense,
  getExpenses,
  getExpenseById,
  approveExpense,
  rejectExpense,
} from "../controllers/expenseController.js";

const router = express.Router();

// Create Expense
router.post("/", auth, createExpense);

// Get all Expenses
router.get("/", auth, getExpenses);

// Get single Expense
router.get("/:id", auth, getExpenseById);

// Approve Expense
router.patch("/:id/approve", auth, approveExpense);

// Reject Expense
router.patch("/:id/reject", auth, rejectExpense);

export default router;
