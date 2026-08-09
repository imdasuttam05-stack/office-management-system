import Expense from "../models/Expense.js";

function escapeRegex(value) {
  return String(value || "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

export const createExpense = async (req, res) => {
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
    } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Expense date is required.",
      });
    }

    if (!natureOfExpense) {
      return res.status(400).json({
        success: false,
        message:
          "Nature of expense is required.",
      });
    }

    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      Number.isNaN(Number(amount))
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required.",
      });
    }

    if (!payeeName) {
      return res.status(400).json({
        success: false,
        message: "Payee name is required.",
      });
    }

    const cleanPayee =
      String(payeeName).trim();

    const cleanNature =
      String(natureOfExpense).trim();

    const cleanGpay = gpayNo
      ? String(gpayNo).trim()
      : "";

    const cleanBillNo = billNo
      ? String(billNo).trim()
      : "";

    const cleanDescription =
      description
        ? String(description).trim()
        : "";

    const expenseAmount = Number(amount);

    if (expenseAmount <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    /*
     * Duplicate Detection
     *
     * Primary match:
     * Amount + Payee + Nature
     *
     * If Bill No or G-Pay No is also
     * matching, duplicate confidence
     * becomes stronger.
     */

    const duplicateQuery = {
      amount: expenseAmount,

      payeeName: {
        $regex: escapeRegex(cleanPayee),
        $options: "i",
      },

      natureOfExpense: {
        $regex: escapeRegex(cleanNature),
        $options: "i",
      },
    };

    const duplicate =
      await Expense.findOne(
        duplicateQuery
      ).sort({
        createdAt: -1,
      });

    if (duplicate && !forceSave) {
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
      } else if (
        duplicate.amount ===
        expenseAmount
      ) {
        similarity = 90;
      }

      return res.status(409).json({
        success: false,
        duplicate: true,
        message:
          "Possible duplicate expense found.",
        similarity,
        existingExpense: duplicate,
      });
    }

    const expense =
      await Expense.create({
        date,
        natureOfExpense: cleanNature,
        amount: expenseAmount,
        gpayNo: cleanGpay,
        payeeName: cleanPayee,
        billNo: cleanBillNo,
        description: cleanDescription,
        createdBy: req.user
          ? req.user._id
          : null,
        status: "pending",
      });

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
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create expense.",
      error: error.message,
    });
  }
};

export const getExpenses = async (
  req,
  res
) => {
  try {
    const expenses =
      await Expense.find()
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
      message:
        "Unable to fetch expenses.",
      error: error.message,
    });
  }
};

export const getExpenseById = async (
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
        message:
          "Expense not found.",
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
      message:
        "Unable to fetch expense.",
      error: error.message,
    });
  }
};

export const updateExpense = async (
  req,
  res
) => {
  try {
    const allowedFields = [
      "date",
      "natureOfExpense",
      "amount",
      "gpayNo",
      "payeeName",
      "billNo",
      "description",
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (
        req.body[field] !== undefined
      ) {
        updateData[field] =
          req.body[field];
      }
    }

    if (
      updateData.amount !== undefined
    ) {
      updateData.amount = Number(
        updateData.amount
      );
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
        message:
          "Expense not found.",
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
      message:
        "Unable to update expense.",
      error: error.message,
    });
  }
};

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
        message:
          "Expense not found.",
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

export const approveExpense = async (
  req,
  res
) => {
  try {
    const expense =
      await Expense.findByIdAndUpdate(
        req.params.id,
        {
          status: "approved",
          approvedBy: req.user
            ? req.user._id
            : null,
          approvedAt: new Date(),
        },
        {
          new: true,
        }
      );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

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

export const rejectExpense = async (
  req,
  res
) => {
  try {
    const expense =
      await Expense.findByIdAndUpdate(
        req.params.id,
        {
          status: "rejected",
          rejectedBy: req.user
            ? req.user._id
            : null,
          rejectedAt: new Date(),
        },
        {
          new: true,
        }
      );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message:
          "Expense not found.",
      });
    }

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
