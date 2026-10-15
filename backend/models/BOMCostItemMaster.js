import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  unit: { type: String, required: true, trim: true, maxlength: 20 },
  standardRate: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

schema.index({ companyId: 1, name: 1 }, { unique: true });
schema.plugin(companyScopePlugin, { financialYear: false });

export default mongoose.model("BOMCostItemMaster", schema);
