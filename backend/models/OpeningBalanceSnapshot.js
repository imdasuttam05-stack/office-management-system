import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const schema = new mongoose.Schema({
  sourceFinancialYear: { type: String, required: true },
  carriedAt: { type: Date, default: Date.now },
  ledgers: { type: [mongoose.Schema.Types.Mixed], default: [] },
  stock: { type: [mongoose.Schema.Types.Mixed], default: [] },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
schema.index({ companyId: 1, financialYear: 1 }, { unique: true });
schema.plugin(companyScopePlugin, { financialYear: true });
export default mongoose.models.OpeningBalanceSnapshot || mongoose.model("OpeningBalanceSnapshot", schema);
