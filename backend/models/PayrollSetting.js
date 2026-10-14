import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const payrollSettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", index: true },
    basicPercent: { type: Number, default: 60, min: 0, max: 100 },
    hraPercent: { type: Number, default: 20, min: 0, max: 100 },
    daPercent: { type: Number, default: 10, min: 0, max: 100 },
    conveyancePercent: { type: Number, default: 5, min: 0, max: 100 },
    otherAllowancePercent: { type: Number, default: 0, min: 0, max: 100 },
    gratuityPercent: { type: Number, default: 4.81, min: 0, max: 100 },
    pfPercent: { type: Number, default: 12, min: 0, max: 100 },
    esiPercent: { type: Number, default: 0.75, min: 0, max: 100 },
    employerPfPercent: { type: Number, default: 12, min: 0, max: 100 },
    employerEsiPercent: { type: Number, default: 3.25, min: 0, max: 100 },
    hraBase: { type: String, enum: ["gross", "basic", "basicDa"], default: "gross" },
    daBase: { type: String, enum: ["gross", "basic", "basicDa"], default: "gross" },
    conveyanceBase: { type: String, enum: ["gross", "basic", "basicDa"], default: "gross" },
    otherAllowanceBase: { type: String, enum: ["gross", "basic", "basicDa"], default: "gross" },
    gratuityBase: { type: String, enum: ["basic", "basicDa", "gross"], default: "basic" },
    pfBase: { type: String, enum: ["gross", "basic", "basicDa"], default: "gross" },
    pfCeilingEnabled: { type: Boolean, default: true },
    pfWageCeiling: { type: Number, default: 15000, min: 0 },
    esiBase: { type: String, enum: ["gross", "basic", "basicDa"], default: "gross" },
    esiCeilingEnabled: { type: Boolean, default: true },
    esiWageCeiling: { type: Number, default: 21000, min: 0 },
    // State-wise payroll overrides. If a state is not present, common rules above are used.
    stateRules: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

payrollSettingSchema.index({ companyId: 1, key: 1 }, { unique: true });
payrollSettingSchema.plugin(companyScopePlugin, { financialYear: false });

export default mongoose.model("PayrollSetting", payrollSettingSchema);
