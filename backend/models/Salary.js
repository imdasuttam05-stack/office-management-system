import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

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
  overtimeHours: Number,
  overtimeApprovedHours: Number,
  overtimeAmount: Number,
  overtimeApprovedAmount: Number,
  cuttingMinutes: Number,
  cuttingApprovedMinutes: Number,
  cuttingAmount: Number,
  bonus: Number,
  deductions: Number,
  grossSalary: Number,
  netSalary: Number,
  status: { type: String, enum: ["Draft", "Processed", "Paid"], default: "Processed" }
}, { timestamps: true });

schema.index({ companyId: 1, financialYear: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });
schema.plugin(companyScopePlugin, { financialYear: true });

export default mongoose.model("Salary", schema);
