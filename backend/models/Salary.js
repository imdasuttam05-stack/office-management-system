import mongoose from "mongoose";

const schema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  workingDays: Number,
  presentDays: Number,
  halfDays: Number,
  paidLeaveDays: Number,
  unpaidLeaveDays: Number,
  absentDays: Number,
  holidayDays: Number,
  weekOffDays: Number,
  basicSalary: Number,
  attendancePay: Number,
  allowances: Number,
  overtimeAmount: Number,
  bonus: Number,
  deductions: Number,
  grossSalary: Number,
  netSalary: Number,
  status: { type: String, enum: ["Draft", "Processed", "Paid"], default: "Processed" }
}, { timestamps: true });

schema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
export default mongoose.model("Salary", schema);
