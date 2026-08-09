```js
import Expense from "../models/Expense.js";

// ==========================================
// CREATE EXPENSE
// ==========================================
export const createExpense = async (req, res) => {
  try {
    const {
      date,
      natureOfExpense,
      amount,
      gpayNo,
      payeeName,
      description,
    } = req.body;

    // -----------------------------
    // VALIDATION
    // -----------------------------
    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Expense date is required.",
      });
    }

    if (!natureOfExpense || !String(natureOfExpense).trim()) {
      return res.status(400).json({
        success: false,
        message: "Nature of expense is required.",
      });
    }

    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      Number.isNaN(Number(amount)) ||
      Number(amount) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required.",
      });
    }

    if (!payeeName || !String(payeeName).trim()) {
      return res.status(400).json({
        success: false,
        message: "Payee name is required.",
      });
    }

    // -----------------------------
    // CLEAN DATA
    // -----------------------------
    const cleanPayee = String(payeeName).trim();
    const cleanNature = String(natureOfExpense).trim();

    const cleanGpay = gpayNo
      ? String(gpayNo).trim()
      : "";

    const cleanDescription = description
      ? String(description).trim()
      : "";

    const expenseAmount = Number(amount);

    // -----------------------------
    // DATE NORMALIZATION
    // -----------------------------
    const expenseDate = new Date(date);

    if (Number.isNaN(expenseDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense date.",
      });
    }

    // ==========================================
    // DUPLICATE CHECK
    // ==========================================

    const escapedPayee = cleanPayee.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const escapedNature = cleanNature.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const duplicateQuery = {
      amount: expenseAmount,

      payeeName: {
        $regex: escapedPayee,
        $options: "i",
      },

      natureOfExpense: {
        $regex: escapedNature,
        $options: "i",
      },
    };

    // G-Pay number থাকলে সেটাকেও duplicate check-এ ব্যবহার করব
    if (cleanGpay) {
      duplicateQuery.gpayNo = {
        $regex: cleanGpay.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        ),
        $options: "i",
      };
    }

    const duplicate = await Expense.findOne(
      duplicateQuery
    ).sort({
      createdAt: -1,
    });

    // -----------------------------
    // DUPLICATE FOUND
    // -----------------------------
    if (duplicate) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message:
          "Possible duplicate expense found. Please review before saving.",

        existingExpense: duplicate,

        similarity: 90,
      });
    }

    // ==========================================
    // CREATE EXPENSE
    // ==========================================

    const expense = await Expense.create({
      date: expenseDate,

      natureOfExpense: cleanNature,

      amount: expenseAmount,

      gpayNo: cleanGpay,

      payeeName: cleanPayee,

      description: cleanDescription,

      createdBy: req.user?._id || null,

      // New expenses always start as Pending
      status: "pending",
    });

    return res.status(201).json({
      success: true,

      duplicate: false,

      message: "Expense created successfully.",

      expense,
    });
  } catch (error) {
    console.error(
      "CREATE EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create expense.",
      error: error.message,
    });
  }
};


// ==========================================
// GET ALL EXPENSES
// ==========================================
export const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find()
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

      count: expenses.length,

      expenses,
    });
  } catch (error) {
    console.error(
      "GET EXPENSES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch expenses.",
      error: error.message,
    });
  }
};


// ==========================================
// GET SINGLE EXPENSE
// ==========================================
export const getExpenseById = async (
  req,
  res
) => {
  try {
    const expense =
      await Expense.findById(req.params.id)
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
        message: "Expense not found.",
      });
    }

    return res.status(200).json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error(
      "GET EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch expense.",
      error: error.message,
    });
  }
};


// ==========================================
// UPDATE EXPENSE
// ==========================================
export const updateExpense = async (
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
      description,
    } = req.body;

    const updateData = {};

    if (date !== undefined) {
      const parsedDate = new Date(date);

      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid expense date.",
        });
      }

      updateData.date = parsedDate;
    }

    if (natureOfExpense !== undefined) {
      updateData.natureOfExpense =
        String(natureOfExpense).trim();
    }

    if (amount !== undefined) {
      if (
        amount === "" ||
        Number.isNaN(Number(amount)) ||
        Number(amount) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid expense amount.",
        });
      }

      updateData.amount = Number(amount);
    }

    if (gpayNo !== undefined) {
      updateData.gpayNo =
        String(gpayNo).trim();
    }

    if (payeeName !== undefined) {
      updateData.payeeName =
        String(payeeName).trim();
    }

    if (description !== undefined) {
      updateData.description =
        String(description).trim();
    }

    const expense =
      await Expense.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Expense updated successfully.",
      expense,
    });
  } catch (error) {
    console.error(
      "UPDATE EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to update expense.",
      error: error.message,
    });
  }
};


// ==========================================
// DELETE EXPENSE
// ==========================================
export const deleteExpense = async (
  req,
  res
) => {
  try {
    const expense =
      await Expense.findByIdAndDelete(
        req.params.id
      );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Expense deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete expense.",
      error: error.message,
    });
  }
};


// ==========================================
// APPROVE EXPENSE
// ==========================================
export const approveExpense = async (
  req,
  res
) => {
  try {
    const expense =
      await Expense.findById(
        req.params.id
      );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    if (expense.status === "approved") {
      return res.status(400).json({
        success: false,
        message:
          "Expense is already approved.",
      });
    }

    expense.status = "approved";

    expense.approvedBy =
      req.user?._id || null;

    expense.approvedAt = new Date();

    // Clear rejection information
    expense.rejectedBy = null;
    expense.rejectedAt = null;

    await expense.save();

    return res.status(200).json({
      success: true,
      message:
        "Expense approved successfully.",
      expense,
    });
  } catch (error) {
    console.error(
      "APPROVE EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to approve expense.",
      error: error.message,
    });
  }
};


// ==========================================
// REJECT EXPENSE
// ==========================================
export const rejectExpense = async (
  req,
  res
) => {
  try {
    const {
      rejectionReason,
    } = req.body;

    const expense =
      await Expense.findById(
        req.params.id
      );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    expense.status = "rejected";

    expense.rejectedBy =
      req.user?._id || null;

    expense.rejectedAt = new Date();

    expense.rejectionReason =
      rejectionReason
        ? String(rejectionReason).trim()
        : "";

    // Clear approval information
    expense.approvedBy = null;
    expense.approvedAt = null;

    await expense.save();

    return res.status(200).json({
      success: true,
      message:
        "Expense rejected successfully.",
      expense,
    });
  } catch (error) {
    console.error(
      "REJECT EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to reject expense.",
      error: error.message,
    });
  }
};
```
