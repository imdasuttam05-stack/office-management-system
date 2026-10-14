import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const schema = new mongoose.Schema({
  date: { type: Date, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ["Public", "Company", "Optional"], default: "Public" }
}, { timestamps: true });

schema.index({ companyId: 1, date: 1 }, { unique: true });
schema.plugin(companyScopePlugin, { financialYear: false });

export default mongoose.model("Holiday", schema);
