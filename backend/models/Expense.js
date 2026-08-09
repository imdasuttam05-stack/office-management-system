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
      maxlength: 150,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
      max: 1000000000,
    },

    gpayNo: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    payeeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    billNo: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectedReason: {
      type: String,
      default: "",
      maxlength: 500,
    },

    duplicateOverrideBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    duplicateOverrideAt: {
      type: Date,
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

expenseSchema.index({
  amount: 1,
  payeeName: 1,
  natureOfExpense: 1,
  date: 1,
});

export default mongoose.model(
  "Expense",
  expenseSchema
);
