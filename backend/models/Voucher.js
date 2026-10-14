import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const lineSchema = new mongoose.Schema({
  ledger: { type: mongoose.Schema.Types.ObjectId, ref: "Ledger", required: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  narration: { type: String, trim: true, default: "" },
}, { _id: false });

const voucherSchema = new mongoose.Schema({
  voucherNo: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  type: { type: String, enum: ["Payment", "Receipt", "Contra", "Journal", "Sales", "Purchase", "Debit Note", "Credit Note"], required: true },
  partyLedger: { type: mongoose.Schema.Types.ObjectId, ref: "Ledger", default: null },
  referenceNo: { type: String, trim: true, default: "" },
  narration: { type: String, trim: true, default: "" },
  lines: { type: [lineSchema], validate: v => v.length >= 2 },
  totalDebit: { type: Number, required: true },
  totalCredit: { type: Number, required: true },
  sourceType: { type: String, default: "MANUAL", index: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

voucherSchema.index({ companyId: 1, financialYear: 1, voucherNo: 1 }, { unique: true });
voucherSchema.plugin(companyScopePlugin, { financialYear: true });
export default mongoose.model("Voucher", voucherSchema);
