import Expense from "../models/Expense.js";

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function normalizeText(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeGpay(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function calculateSimilarity(text1 = "", text2 = "") {
  const a = normalizeText(text1);
  const b = normalizeText(text2);

  if (!a || !b) return 0;

  if (a === b) return 100;

  const aWords = new Set(a.split(" "));
  const bWords = new Set(b.split(" "));

  const intersection = [...aWords].filter((word) =>
    bWords.has(word)
  );

  const union = new Set([...aWords, ...bWords]);

  if (union.size === 0) return 0;

  return Math.round(
    (intersection.length / union.size) * 100
  );
}

function calculateDateDifference(date1, date2) {
  const first = new Date(date1);
  const second = new Date(date2);

  const difference =
    Math.abs(first.getTime() - second.getTime());

  return Math.ceil(
    difference / (1000 * 60 * 60 * 24)
  );
}

/* =========================================================
   DUPLICATE DETECTION
========================================================= */

async function checkDuplicateExpense({
  date,
  natureOfExpense,
  amount,
  gpayNo,
  payeeName,
}) {
  const normalizedPayee = normalizeText(payeeName);
  const normalizedGpay = normalizeGpay(gpayNo);

  /*
   * First look for strong database matches.
   */
  const candidates = await Expense.find({
    amount: Number(amount),
    payeeName: {
      $regex: `^${normalizedPayee.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}$`,
      $options: "i",
    },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  let bestMatch = null;
  let bestScore = 0;

  for (const existing of candidates) {
    const dateDifference = calculateDateDifference(
      date,
      existing.date
    );

    const payeeSimilarity = calculateSimilarity(
      payeeName,
      existing.payeeName
    );

    const natureSimilarity = calculateSimilarity(
      natureOfExpense,
      existing.natureOfExpense
    );

    const sameGpay =
      normalizedGpay &&
      normalizeGpay(existing.gpayNo) === normalizedGpay;

    /*
     * HIGH CONFIDENCE
     *
     * Same:
     * Date
     * Amount
     * Payee
     * GPay
     */

    if (
      dateDifference === 0 &&
      Number(existing.amount) === Number(amount) &&
      payeeSimilarity >= 95 &&
      sameGpay
    ) {
      return {
        status: "DUPLICATE",
        score: 100,
        expenseId: existing._id,
        reason:
          "Same date, amount, payee and G-Pay number already exists.",
      };
    }

    /*
     * Calculate possible duplicate score.
     */

    let score = 0;

    if (dateDifference === 0) {
      score += 30;
    } else if (dateDifference <= 3) {
      score += 20;
    } else if (dateDifference <= 7) {
      score += 10;
    }

    if (Number(existing.amount) === Number(amount)) {
      score += 25;
    }

    score += Math.round(
      payeeSimilarity * 0.25
    );

    score += Math.round(
      natureSimilarity * 0.15
    );

    if (sameGpay) {
      score += 20;
    }

    if (score > bestScore) {
      bestScore = score;

      bestMatch = {
        expenseId: existing._id,
        score,
        dateDifference,
        payeeSimilarity,
        natureSimilarity,
        sameGpay,
      };
    }
  }

  if (bestMatch && bestMatch.score >= 70) {
    return {
      status: "POSSIBLE_DUPLICATE",
      score: Math.min(bestMatch.score, 99),
      expenseId: bestMatch.expenseId,
      reason:
        "A similar expense was found. Please review the existing entry.",
    };
  }

  return {
    status: "NONE",
    score: 0,
    expenseId: null,
    reason: "",
  };
}

/* =========================================================
   CREATE EXPENSE
========================================================= */

export async function createExpense(req, res) {
  try {
    const {
      date,
      natureOfExpense,
      amount,
      gpayNo,
      payeeName,
      receiptUrl = "",
      receiptPublicId = "",
      source = "MANUAL",
    } = req.body;

    /*
     * Basic validation
     */

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Expense date is required.",
      });
    }

    if (!natureOfExpense?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nature of expense is required.",
      });
    }

    if (
      amount === undefined ||
      amount === null ||
      Number.isNaN(Number(amount))
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid expense amount is required.",
      });
    }

    if (!payeeName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Payee name is required.",
      });
    }

    /*
     * Check duplicate before saving.
     */

    const duplicate = await checkDuplicateExpense({
      date,
      natureOfExpense,
      amount,
      gpayNo,
      payeeName,
    });

    /*
     * Save expense.
     *
     * IMPORTANT:
     * Possible duplicates are still saved as PENDING
     * with duplicateStatus so the frontend can ask
     * the user to review them.
     */

    const expense = await Expense.create({
      date,
      natureOfExpense: natureOfExpense.trim(),
      amount: Number(amount),
      gpayNo: gpayNo?.trim() || "",
      payeeName: payeeName.trim(),
      receiptUrl,
      receiptPublicId,
      source,
      createdBy: req.user._id,
      duplicateStatus: duplicate.status,
      duplicateScore: duplicate.score,
      duplicateOf: duplicate.expenseId,
      duplicateReason: duplicate.reason,
      approvalStatus: "PENDING",
    });

    /*
     * High-confidence duplicate
     */

    if (duplicate.status === "DUPLICATE") {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: "Duplicate expense found.",
        duplicateStatus: duplicate.status,
        duplicateScore: duplicate.score,
        duplicateOf: duplicate.expenseId,
        expense,
      });
    }

    /*
     * Possible duplicate
     */

    if (
      duplicate.status ===
      "POSSIBLE_DUPLICATE"
    ) {
      return res.status(201).json({
        success: true,
        possibleDuplicate: true,
        message:
          "Expense saved but a possible duplicate was found.",
        duplicateStatus: duplicate.status,
        duplicateScore: duplicate.score,
        duplicateOf: duplicate.expenseId,
        expense,
      });
    }

    /*
     * Normal expense
     */

    return res.status(201).json({
      success: true,
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
    });
  }
}

/* =========================================================
   GET ALL EXPENSES
========================================================= */

export async function getExpenses(req, res) {
  try {
    const {
      status,
      duplicateStatus,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) {
      filter.approvalStatus = status;
    }

    if (duplicateStatus) {
      filter.duplicateStatus =
        duplicateStatus;
    }

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    const [expenses, total] =
      await Promise.all([
        Expense.find(filter)
          .populate(
            "createdBy",
            "name email role"
          )
          .populate(
            "duplicateOf",
            "date amount payeeName natureOfExpense gpayNo"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        Expense.countDocuments(filter),
      ]);

    return res.json({
      success: true,
      expenses,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(
          total / limitNumber
        ),
      },
    });
  } catch (error) {
    console.error(
      "GET EXPENSES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch expenses.",
    });
  }
}

/* =========================================================
   GET SINGLE EXPENSE
========================================================= */

export async function getExpenseById(
  req,
  res
) {
  try {
    const expense =
      await Expense.findById(req.params.id)
        .populate(
          "createdBy",
          "name email role"
        )
        .populate(
          "updatedBy",
          "name email role"
        )
        .populate(
          "duplicateOf",
          "date amount payeeName natureOfExpense gpayNo"
        );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    return res.json({
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
    });
  }
}

/* =========================================================
   APPROVE EXPENSE
========================================================= */

export async function approveExpense(
  req,
  res
) {
  try {
    const expense =
      await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    expense.approvalStatus = "APPROVED";
    expense.updatedBy = req.user._id;

    await expense.save();

    return res.json({
      success: true,
      message: "Expense approved successfully.",
      expense,
    });
  } catch (error) {
    console.error(
      "APPROVE EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to approve expense.",
    });
  }
}

/* =========================================================
   REJECT EXPENSE
========================================================= */

export async function rejectExpense(
  req,
  res
) {
  try {
    const expense =
      await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    expense.approvalStatus = "REJECTED";
    expense.updatedBy = req.user._id;

    await expense.save();

    return res.json({
      success: true,
      message: "Expense rejected successfully.",
      expense,
    });
  } catch (error) {
    console.error(
      "REJECT EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to 
