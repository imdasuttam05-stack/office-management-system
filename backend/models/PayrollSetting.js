import mongoose from "mongoose";

const payrollSettingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "default" },
    basicPercent: { type: Number, default: 50, min: 0, max: 100 },
    hraPercent: { type: Number, default: 20, min: 0, max: 100 },
    daPercent: { type: Number, default: 10, min: 0, max: 100 },
    conveyancePercent: { type: Number, default: 5, min: 0, max: 100 },
    pfPercent: { type: Number, default: 12, min: 0, max: 100 },
    esiPercent: { type: Number, default: 0.75, min: 0, max: 100 },
  },
  { timestamps: true }
);

export default mongoose.model("PayrollSetting", payrollSettingSchema);
