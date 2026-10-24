import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const lineSchema = new mongoose.Schema({
  ledger: { type: mongoose.Schema.Types.ObjectId, ref: "Ledger", required: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  narration: { type: String, trim: true, default: "" },
}, { _id: false });

const billAllocationSchema = new mongoose.Schema({
  invoiceType: { type: String, enum: ["SALE", "PURCHASE"], required: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  invoiceNo: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  // Reversal allocations are signed negative when calculating bill outstanding.
  isReversal: { type: Boolean, default: false },
  reversesVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", default: null },
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
  billAllocations: { type: [billAllocationSchema], default: [] },
  reversesVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

voucherSchema.index({ companyId: 1, financialYear: 1, voucherNo: 1 }, { unique: true });
voucherSchema.index({ companyId: 1, financialYear: 1, sourceType: 1, sourceId: 1 }, {
  unique: true,
  partialFilterExpression: { sourceType: "REVERSAL", sourceId: { $type: "objectId" } },
  name: "uniq_accounting_reversal_source",
});
voucherSchema.plugin(companyScopePlugin, { financialYear: true });
export default mongoose.model("Voucher", voucherSchema);
