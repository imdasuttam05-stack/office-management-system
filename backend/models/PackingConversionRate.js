import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const periodSchema = new mongoose.Schema({
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date, required: true },
  rateBasis: { type: String, enum: ["PCS", "KG"], required: true },
  rate: { type: Number, required: true, min: 0 },
}, { _id: true });

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItemMaster", required: true },
  itemName: { type: String, required: true, trim: true, maxlength: 180 },
  rateBasis: { type: String, enum: ["PCS", "KG"], required: true, default: "PCS" },
  rate: { type: Number, required: true, min: 0 },
  periods: { type: [periodSchema], default: [] },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

schema.index({ companyId: 1, itemId: 1 }, { unique: true });
schema.plugin(companyScopePlugin, { financialYear: false });

export default mongoose.model("PackingConversionRate", schema);
