import mongoose from "mongoose";

const salaryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: ["fixed", "variable"],
      default: "fixed",
    },
  },
  { _id: true }
);

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    year: {
      type: Number,
      required: true,
      index: true,
    },

    workingDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    presentDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidLeaveDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    holidayDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    weeklyOffDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    absentDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    lwpDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    overtimeHours: {
      type: Number,
      default: 0,
      min: 0,
    },

    additions: {
      type: [salaryItemSchema],
      default: [],
    },

    deductions: {
      type: [salaryItemSchema],
      default: [],
    },

    basicSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    grossSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDeductions: {
      type: Number,
      default: 0,
      min: 0,
    },

    netSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["Draft", "Processed", "Paid"],
      default: "Draft",
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

payrollSchema.index(
  {
    employeeId: 1,
    month: 1,
    year: 1,
  },
  {
    unique: true,
  }
);

const Payroll =
  mongoose.models.Payroll ||
  mongoose.model("Payroll", payrollSchema);

export default Payroll;
