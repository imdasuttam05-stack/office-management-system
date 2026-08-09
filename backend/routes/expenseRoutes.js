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

// ==========================================
// CREATE EXPENSE
// POST /api/expenses
// ==========================================
router.post(
  "/",
  auth,
  createExpense
);


// ==========================================
// GET ALL EXPENSES
// GET /api/expenses
// ==========================================
router.get(
  "/",
  auth,
  getExpenses
);


// ==========================================
// GET SINGLE EXPENSE
// GET /api/expenses/:id
// ==========================================
router.get(
  "/:id",
  auth,
  getExpenseById
);


// ==========================================
// UPDATE EXPENSE
// PUT /api/expenses/:id
// ==========================================
router.put(
  "/:id",
  auth,
  updateExpense
);


// ==========================================
// DELETE EXPENSE
// DELETE /api/expenses/:id
// ==========================================
router.delete(
  "/:id",
  auth,
  deleteExpense
);


// ==========================================
// APPROVE EXPENSE
// PATCH /api/expenses/:id/approve
// ==========================================
router.patch(
  "/:id/approve",
  auth,
  approveExpense
);


// ==========================================
// REJECT EXPENSE
// PATCH /api/expenses/:id/reject
// ==========================================
router.patch(
  "/:id/reject",
  auth,
  rejectExpense
);


// ==========================================
// UPDATE EXPENSE STATUS
// PATCH /api/expenses/:id/status
//
// Body:
// {
//   "status": "pending"
// }
//
// or
//
// {
//   "status": "approved"
// }
//
// or
//
// {
//   "status": "rejected",
//   "rejectionReason": "Incorrect amount"
// }
// ==========================================
router.patch(
  "/:id/status",
  auth,
  async (req, res) => {
    try {
      const {
        status,
        rejectionReason,
      } = req.body;

      const allowedStatuses = [
        "pending",
        "approved",
        "rejected",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid expense status.",
        });
      }

      const Expense =
        (
          await import(
            "../models/Expense.js"
          )
        ).default;

      const expense =
        await Expense.findById(
          req.params.id
        );

      if (!expense) {
        return res.status(404).json({
          success: false,
          message:
            "Expense not found.",
        });
      }

      expense.status = status;

      if (status === "approved") {
        expense.approvedBy =
          req.user?._id || null;

        expense.approvedAt =
          new Date();

        expense.rejectedBy = null;
        expense.rejectedAt = null;
        expense.rejectionReason = "";
      }

      if (status === "rejected") {
        expense.rejectedBy =
          req.user?._id || null;

        expense.rejectedAt =
          new Date();

        expense.rejectionReason =
          rejectionReason
            ? String(
                rejectionReason
              ).trim()
            : "";

        expense.approvedBy = null;
        expense.approvedAt = null;
      }

      if (status === "pending") {
        expense.approvedBy = null;
        expense.approvedAt = null;
        expense.rejectedBy = null;
        expense.rejectedAt = null;
        expense.rejectionReason = "";
      }

      await expense.save();

      return res.status(200).json({
        success: true,
        message:
          "Expense status updated successfully.",
        expense,
      });
    } catch (error) {
      console.error(
        "UPDATE EXPENSE STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update expense status.",
        error: error.message,
      });
    }
  }
);


export default router;
