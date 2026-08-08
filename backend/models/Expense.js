import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    natureOfExpense: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    gpayNo: {
      type: String,
      trim: true,
      default: "",
    },

    payeeName: {
      type: String,
      required: true,
      trim: true,
    },

    receiptUrl: {
      type: String,
      default: "",
    },

    receiptPublicId: {
      type: String,
      default: "",
    },

    approvalStatus: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
      ],
      default: "PENDING",
    },

    duplicateStatus: {
      type: String,
      enum: [
        "NONE",
        "POSSIBLE_DUPLICATE",
        "DUPLICATE",
      ],
      default: "NONE",
    },

    duplicateScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      default: null,
    },

    duplicateReason: {
      type: String,
      default: "",
    },

    source: {
      type: String,
      enum: [
        "MANUAL",
        "OCR",
      ],
      default: "MANUAL",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Useful database indexes
expenseSchema.index({
  date: 1,
  amount: 1,
  payeeName: 1,
});

expenseSchema.index({
  gpayNo: 1,
});

expenseSchema.index({
  approvalStatus: 1,
});

expenseSchema.index({
  duplicateStatus: 1,
});

const Expense = mongoose.model(
  "Expense",
  expenseSchema
);

export default Expense;
