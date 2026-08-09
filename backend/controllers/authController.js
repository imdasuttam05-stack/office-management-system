import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import AuditLog from "../models/AuditLog.js";
import { getClientIp } from "../utils/security.js";

function cleanString(value, maxLength = 2000) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function escapeRegex(value) {
  return String(value || "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

async function audit(req, action, entityId, metadata = {}) {
  try {
    await AuditLog.create({
      actorUser: req.user?._id || null,
      action,
      entity: "Expense",
      entityId,
      metadata,
      ip: getClientIp(req),
      userAgent:
        req.headers["user-agent"] || "",
    });
  } catch {
    // Do not break a successful business action if audit logging fails.
  }
}

function canSeeAllExpenses(user) {
  return (
    user.role === "Admin" ||
    user.role === "Manager"
  );
}

function canManageExpense(user, expense) {
  if (
    user.role === "Admin" ||
    user.role === "Manager"
  ) {
    return true;
  }

  return (
    String(expense.createdBy) ===
    String(user._id)
  );
}

export const createExpense = async (
  req,
  res
) => {
  try {
    const {
      date,
      natureOfExpense,
      amount,
      gpayNo,
      payeeName,
      billNo,
      description,
      forceSave,
    } = req.body || {};

    const cleanNature =
      cleanString(
        natureOfExpense,
        150
      );

    const cleanPayee =
      cleanString(
        payeeName,
        150
      );

    const cleanGpay =
      cleanString(
        gpayNo,
        120
      );

    const cleanBillNo =
      cleanString(
        billNo,
        120
      );

    const cleanDescription =
      cleanString(
        description,
        2000
      );

    const parsedDate =
      new Date(date);

    const expenseAmount =
      Number(amount);

    if (
      !date ||
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid expense date is required.",
      });
    }

    if (!cleanNature) {
      return res.status(400).json({
        success: false,
        message:
          "Nature of expense is required.",
      });
    }

    if (
      !Number.isFinite(
        expenseAmount
      ) ||
      expenseAmount <= 0 ||
      expenseAmount > 1000000000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid expense amount is required.",
      });
    }

    if (!cleanPayee) {
      return res.status(400).json({
        success: false,
        message:
          "Payee name is required.",
      });
    }

    const duplicate =
      await Expense.findOne({
        isDeleted: false,
        amount: expenseAmount,
        payeeName: {
          $regex:
            escapeRegex(cleanPayee),
          $options: "i",
        },
        natureOfExpense: {
          $regex:
            escapeRegex(cleanNature),
          $options: "i",
        },
      }).sort({
        createdAt: -1,
      });

    const isOverride =
      Boolean(forceSave) &&
      (
        req.user.role === "Admin" ||
        req.user.role === "Manager"
      );

    if (duplicate && !isOverride) {
      let similarity = 85;

      if (
        cleanBillNo &&
        duplicate.billNo &&
        cleanBillNo.toLowerCase() ===
          duplicate.billNo.toLowerCase()
      ) {
        similarity = 98;
      } else if (
        cleanGpay &&
        duplicate.gpayNo &&
        cleanGpay.toLowerCase() ===
          duplicate.gpayNo.toLowerCase()
      ) {
        similarity = 97;
      }

      return res.status(409).json({
        success: false,
        duplicate: true,
        message:
          "Possible duplicate expense found. Manager or Admin approval is required to save it anyway.",
        similarity,
        existingExpense:
          duplicate,
      });
    }

    const expense =
      await Expense.create({
        date: parsedDate,
        natureOfExpense:
          cleanNature,
        amount:
          expenseAmount,
        gpayNo:
          cleanGpay,
        payeeName:
          cleanPayee,
        billNo:
          cleanBillNo,
        description:
          cleanDescription,
        createdBy:
          req.user._id,
        status:
          "pending",
        duplicateOverrideBy:
          isOverride
            ? req.user._id
            : null,
        duplicateOverrideAt:
          isOverride
            ? new Date()
            : null,
      });

    await audit(
      req,
      "EXPENSE_CREATED",
      expense._id,
      {
        amount: expenseAmount,
        duplicateOverride:
          isOverride,
      }
    );

    return res.status(201).json({
      success: true,
      duplicate: false,
      message:
        "Expense created successfully.",
      expense,
    });
  } catch (error) {
    console.error(
      "CREATE EXPENSE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create expense.",
    });
  }
};

export const getExpenses = async (
  req,
  res
) => {
  try {
    const filter = {
      isDeleted: false,
    };

    if (!canSeeAllExpenses(req.user)) {
      filter.createdBy =
        req.user._id;
    }

    const expenses =
      await Expense.find(filter)
        .populate(
          "createdBy",
          "name email role"
        )
        .populate(
          "approvedBy",
          "name email role"
        )
        .populate(
          "rejectedBy",
          "name email role"
        )
        .sort({
          date: -1,
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      count:
        expenses.length,
      expenses,
    });
  } catch (error) {
    console.error(
      "GET EXPENSES ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch expenses.",
    });
  }
};

export const getExpenseById = async (
  req,
  res
) => {
  try {
    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid expense ID.",
      });
    }

    const expense =
      await Expense.findOne({
        _id:
          req.params.id,
        isDeleted: false,
      })
        .populate(
          "createdBy",
          "name email role"
        )
        .populate(
          "approvedBy",
          "name email role"
        )
        .populate(
          "rejectedBy",
          "name email role"
        );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

    if (
      !canSeeAllExpenses(
        req.user
      ) &&
      String(expense.createdBy?._id) !==
        String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this expense.",
      });
    }

    return res.status(200).json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error(
      "GET EXPENSE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch expense.",
    });
  }
};

export const updateExpense = async (
  req,
  res
) => {
  try {
    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid expense ID.",
      });
    }

    const expense =
      await Expense.findOne({
        _id:
          req.params.id,
        isDeleted: false,
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

    if (
      !canManageExpense(
        req.user,
        expense
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to edit this expense.",
      });
    }

    if (
      expense.status !== "pending"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Approved or rejected expenses cannot be edited.",
      });
    }

    const allowedFields = [
      "date",
      "natureOfExpense",
      "amount",
      "gpayNo",
      "payeeName",
      "billNo",
      "description",
    ];

    for (const field of allowedFields) {
      if (
        req.body?.[field] !==
        undefined
      ) {
        if (
          field === "amount"
        ) {
          const value =
            Number(
              req.body[field]
            );

          if (
            !Number.isFinite(value) ||
            value <= 0
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Invalid amount.",
            });
          }

          expense.amount =
            value;
        } else if (
          field === "date"
        ) {
          const value =
            new Date(
              req.body[field]
            );

          if (
            Number.isNaN(
              value.getTime()
            )
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Invalid date.",
            });
          }

          expense.date =
            value;
        } else {
          expense[field] =
            cleanString(
              req.body[field],
              field ===
                "description"
                ? 2000
                : 150
            );
        }
      }
    }

    expense.updatedBy =
      req.user._id;

    await expense.save();

    await audit(
      req,
      "EXPENSE_UPDATED",
      expense._id
    );

    return res.status(200).json({
      success: true,
      message:
        "Expense updated successfully.",
      expense,
    });
  } catch (error) {
    console.error(
      "UPDATE EXPENSE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update expense.",
    });
  }
};

export const deleteExpense = async (
  req,
  res
) => {
  try {
    if (
      req.user.role !== "Admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Admin can delete expenses.",
      });
    }

    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid expense ID.",
      });
    }

    const expense =
      await Expense.findOne({
        _id:
          req.params.id,
        isDeleted: false,
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

    expense.isDeleted = true;
    expense.deletedBy =
      req.user._id;
    expense.deletedAt =
      new Date();
    expense.updatedBy =
      req.user._id;

    await expense.save();

    await audit(
      req,
      "EXPENSE_DELETED",
      expense._id
    );

    return res.status(200).json({
      success: true,
      message:
        "Expense deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE EXPENSE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete expense.",
    });
  }
};

export const approveExpense = async (
  req,
  res
) => {
  try {
    if (
      !["Admin", "Manager"].includes(
        req.user.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Manager or Admin can approve expenses.",
      });
    }

    const expense =
      await Expense.findOne({
        _id:
          req.params.id,
        isDeleted: false,
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

    if (
      expense.status !== "pending"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Only pending expenses can be approved.",
      });
    }

    expense.status =
      "approved";
    expense.approvedBy =
      req.user._id;
    expense.approvedAt =
      new Date();
    expense.rejectedBy =
      null;
    expense.rejectedAt =
      null;
    expense.rejectedReason =
      "";
    expense.updatedBy =
      req.user._id;

    await expense.save();

    await audit(
      req,
      "EXPENSE_APPROVED",
      expense._id
    );

    return res.status(200).json({
      success: true,
      message:
        "Expense approved successfully.",
      expense,
    });
  } catch (error) {
    console.error(
      "APPROVE EXPENSE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to approve expense.",
    });
  }
};

export const rejectExpense = async (
  req,
  res
) => {
  try {
    if (
      !["Admin", "Manager"].includes(
        req.user.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Manager or Admin can reject expenses.",
      });
    }

    const expense =
      await Expense.findOne({
        _id:
          req.params.id,
        isDeleted: false,
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

    if (
      expense.status !== "pending"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Only pending expenses can be rejected.",
      });
    }

    expense.status =
      "rejected";
    expense.rejectedBy =
      req.user._id;
    expense.rejectedAt =
      new Date();
    expense.updatedBy =
      req.user._id;

    await expense.save();

    await audit(
      req,
      "EXPENSE_REJECTED",
      expense._id
    );

    return res.status(200).json({
      success: true,
      message:
        "Expense rejected successfully.",
      expense,
    });
  } catch (error) {
    console.error(
      "REJECT EXPENSE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to reject expense.",
    });
  }
};
