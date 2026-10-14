import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const ledgerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
  openingBalance: { type: Number, default: 0 },
  openingType: { type: String, enum: ["Dr", "Cr"], default: "Dr" },
  gstApplicable: { type: Boolean, default: false },
  gstin: { type: String, trim: true, default: "" },
  pan: { type: String, trim: true, default: "" },
  address: { type: String, trim: true, default: "" },
  state: { type: String, trim: true, default: "" },
  district: { type: String, trim: true, default: "" },
  pin: { type: String, trim: true, default: "" },
  phone: { type: String, trim: true, default: "" },
  email: { type: String, trim: true, default: "" },
  creditLimit: { type: Number, default: 0 },
  creditDays: { type: Number, default: 0 },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "AccountsMaster", default: null },
  gstStateCode: { type: String, trim: true, default: "" },
  bankDetailsProvided: { type: Boolean, default: false },
  bankAccountName: { type: String, trim: true, default: "" },
  bankName: { type: String, trim: true, default: "" },
  bankBranch: { type: String, trim: true, default: "" },
  bankAccountNumber: { type: String, trim: true, default: "" },
  bankIfsc: { type: String, trim: true, uppercase: true, default: "" },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

ledgerSchema.index({ companyId: 1, name: 1, group: 1 }, { unique: true });
ledgerSchema.plugin(companyScopePlugin, { financialYear: false });
export default mongoose.model("Ledger", ledgerSchema);
