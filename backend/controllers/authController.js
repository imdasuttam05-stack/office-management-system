import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import AuditLog from "../models/AuditLog.js";
import { getClientIp } from "../utils/security.js";

/* =========================================================
   HELPERS
========================================================= */

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

function isAdminOrManager(user) {
  return ["Admin", "Manager"].includes(user?.role);
}

function canSeeAllExpenses(user) {
  return isAdminOrManager(user);
}

function canManageExpense(user, expense) {
  if (isAdminOrManager(user)) {
    return true;
  }

  return (
    String(expense.createdBy) ===
    String(user?._id)
  );
}

function validExpenseId(id) {
  return mongoose.isValidObjectId(id);
}

function parseAmount(value) {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000000
  ) {
    return null;
  }

  return amount;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/* =========================================================
   SAFE EXPENSE RESPONSE
   Prevent accidental exposure of internal fields
========================================================= */

function safeExpense(expense) {
  if (!expense) {
    return null;
  }

  const data =
    typeof expense.toObject === "function"
      ? expense.toObject()
      : { ...expense };

  delete data.__v;

  return data;
}

/* =========================================================
   AUDIT LOG
========================================================= */

async function audit(
  req,
  action,
  entityId = null,
  metadata = {}
) {
  try {
    await AuditLog.create({
      actorUser:
        req.user?._id || null,

      action,

      entity: "Expense",

      entityId,

      metadata,

      ip: getClientIp(req),

      userAgent:
        req.headers["user-agent"] || "",
    });
  } catch (error) {
    /*
      Audit failure must never expose
      database details to the client.
    */

    console.error(
      "AUDIT LOG ERROR:",
      error.message
    );
  }
}

/* =========================================================
   CREATE EXPENSE
========================================================= */

export const createExpense = async (
  req,
  res
) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

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

    const parsedDate =
      parseDate(date);

    const expenseAmount =
      parseAmount(amount);

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

    /* -------------------------
       VALIDATION
    ------------------------- */

    if (!parsedDate) {
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

    if (expenseAmount === null) {
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

    /* -------------------------
       DUPLICATE DETECTION
    ------------------------- */

    const duplicate =
      await Expense.findOne({
        isDeleted: false,

        amount:
          expenseAmount,

        payeeName: {
          $regex:
            escapeRegex(
              cleanPayee
            ),
          $options: "i",
        },

        natureOfExpense: {
          $regex:
            escapeRegex(
              cleanNature
            ),
          $options: "i",
        },
      })
        .sort({
          createdAt: -1,
        })
        .lean();

    /*
      Only Admin / Manager can bypass
      duplicate protection.
    */

    const isOverride =
      Boolean(forceSave) &&
      isAdminOrManager(
        req.user
      );

    if (
      duplicate &&
      !isOverride
    ) {
      let similarity = 85;

      if (
        cleanBillNo &&
        duplicate.billNo &&
        cleanBillNo.toLowerCase() ===
          String(
            duplicate.billNo
          ).toLowerCase()
      ) {
        similarity = 98;
      } else if (
        cleanGpay &&
        duplicate.gpayNo &&
        cleanGpay.toLowerCase() ===
          String(
            duplicate.gpayNo
          ).toLowerCase()
      ) {
        similarity = 97;
      }

      /*
        SECURITY:
        Never return the complete MongoDB
        document to the client.
      */

      return res.status(409).json({
        success: false,

        duplicate: true,

        message:
          "Possible duplicate expense found. Manager or Admin approval is required to save it anyway.",

        similarity,

        existingExpense: {
          id:
            duplicate._id,

          date:
            duplicate.date,

          natureOfExpense:
            duplicate.natureOfExpense,

          amount:
            duplicate.amount,

          payeeName:
            duplicate.payeeName,

          billNo:
            duplicate.billNo || "",
        },
      });
    }

    /* -------------------------
       CREATE EXPENSE
    ------------------------- */

    const expense =
      await Expense.create({
        date:
          parsedDate,

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
        amount:
          expenseAmount,

        duplicateOverride:
          isOverride,
      }
    );

    return res.status(201).json({
      success: true,

      duplicate: false,

      message:
        "Expense created successfully.",

      expense:
        safeExpense(expense),
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

/* =========================================================
   GET EXPENSES
========================================================= */

export const getExpenses = async (
  req,
  res
) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const filter = {
      isDeleted: false,
    };

    /*
      Admin / Manager:
      see all expenses.

      Employee:
      see only own expenses.
    */

    if (
      !canSeeAllExpenses(
        req.user
      )
    ) {
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
        })
        .lean();

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

/* =========================================================
   GET EXPENSE BY ID
========================================================= */

export const getExpenseById = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (
      !validExpenseId(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid expense ID.",
      });
    }

    const expense =
      await Expense.findOne({
        _id: id,

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
        )
        .lean();

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

    /*
      Employee can only access
      their own expense.
    */

    if (
      !canSeeAllExpenses(
        req.user
      ) &&
      String(
        expense.createdBy?._id
      ) !==
        String(
          req.user._id
        )
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

/* =========================================================
   UPDATE EXPENSE
========================================================= */

export const updateExpense = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (
      !validExpenseId(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid expense ID.",
      });
    }

    const expense =
      await Expense.findOne({
        _id: id,

        isDeleted: false,
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

    /*
      Authorization check.
    */

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

    /*
      Only pending expenses
      can be edited.
    */

    if (
      expense.status !==
      "pending"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Approved or rejected expenses cannot be edited.",
      });
    }

    const body =
      req.body || {};

    /* -------------------------
       DATE
    ------------------------- */

    if (
      body.date !==
      undefined
    ) {
      const date =
        parseDate(
          body.date
        );

      if (!date) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid date.",
        });
      }

      expense.date =
        date;
    }

    /* -------------------------
       NATURE
    ------------------------- */

    if (
      body.natureOfExpense !==
      undefined
    ) {
      const value =
        cleanString(
          body.natureOfExpense,
          150
        );

      if (!value) {
        return res.status(400).json({
          success: false,
          message:
            "Nature of expense is required.",
        });
      }

      expense.natureOfExpense =
        value;
    }

    /* -------------------------
       AMOUNT
    ------------------------- */

    if (
      body.amount !==
      undefined
    ) {
      const amount =
        parseAmount(
          body.amount
        );

      if (
        amount === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid amount.",
        });
      }

      expense.amount =
        amount;
    }

    /* -------------------------
       PAYEE
    ------------------------- */

    if (
      body.payeeName !==
      undefined
    ) {
      const value =
        cleanString(
          body.payeeName,
          150
        );

      if (!value) {
        return res.status(400).json({
          success: false,
          message:
            "Payee name is required.",
        });
      }

      expense.payeeName =
        value;
    }

    /* -------------------------
       GPAY
    ------------------------- */

    if (
      body.gpayNo !==
      undefined
    ) {
      expense.gpayNo =
        cleanString(
          body.gpayNo,
          120
        );
    }

    /* -------------------------
       BILL NUMBER
    ------------------------- */

    if (
      body.billNo !==
      undefined
    ) {
      expense.billNo =
        cleanString(
          body.billNo,
          120
        );
    }

    /* -------------------------
       DESCRIPTION
    ------------------------- */

    if (
      body.description !==
      undefined
    ) {
      expense.description =
        cleanString(
          body.description,
          2000
        );
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

      expense:
        safeExpense(expense),
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

/* =========================================================
   DELETE EXPENSE
   ADMIN ONLY
========================================================= */

export const deleteExpense = async (
  req,
  res
) => {
  try {
    if (
      req.user?.role !==
      "Admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Admin can delete expenses.",
      });
    }

    const { id } =
      req.params;

    if (
      !validExpenseId(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid expense ID.",
      });
    }

    const expense =
      await Expense.findOne({
        _id: id,

        isDeleted: false,
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

    /*
      Soft delete.
      Data remains in database for audit.
    */

    expense.isDeleted =
      true;

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

/* =========================================================
   APPROVE EXPENSE
   ADMIN / MANAGER ONLY
========================================================= */

export const approveExpense = async (
  req,
  res
) => {
  try {
    if (
      !isAdminOrManager(
        req.user
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Manager or Admin can approve expenses.",
      });
    }

    const { id } =
      req.params;

    if (
      !validExpenseId(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid expense ID.",
      });
    }

    const expense =
      await Expense.findOne({
        _id: id,

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
      expense.status !==
      "pending"
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

      expense:
        safeExpense(expense),
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

/* =========================================================
   REJECT EXPENSE
   ADMIN / MANAGER ONLY
========================================================= */

export const rejectExpense = async (
  req,
  res
) => {
  try {
    if (
      !isAdminOrManager(
        req.user
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Manager or Admin can reject expenses.",
      });
    }

    const { id } =
      req.params;

    if (
      !validExpenseId(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid expense ID.",
      });
    }

    const expense =
      await Expense.findOne({
        _id: id,

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
      expense.status !==
      "pending"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Only pending expenses can be rejected.",
      });
    }

    const reason =
      cleanString(
        req.body?.reason,
        1000
      );

    if (!reason) {
      return res.status(400).json({
        success: false,
        message:
          "Rejection reason is required.",
      });
    }

    expense.status =
      "rejected";

    expense.rejectedBy =
      req.user._id;

    expense.rejectedAt =
      new Date();

    expense.rejectedReason =
      reason;

    expense.updatedBy =
      req.user._id;

    await expense.save();

    await audit(
      req,
      "EXPENSE_REJECTED",
      expense._id,
      {
        reason,
      }
    );

    return res.status(200).json({
      success: true,

      message:
        "Expense rejected successfully.",

      expense:
        safeExpense(expense),
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
