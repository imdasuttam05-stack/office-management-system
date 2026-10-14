import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  startTime: { type: String, required: true, default: "09:00" },
  endTime: { type: String, required: true, default: "18:00" },
  breakMinutes: { type: Number, default: 60, min: 0 },
  graceMinutes: { type: Number, default: 10, min: 0 },
  overtimeAfterMinutes: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true });

schema.index({ companyId: 1, name: 1 }, { unique: true });
schema.plugin(companyScopePlugin, { financialYear: false });

export default mongoose.model("Shift", schema);
