import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  startTime: { type: String, required: true, default: "09:00" },
  endTime: { type: String, required: true, default: "18:00" },
  breakMinutes: { type: Number, default: 60, min: 0 },
  graceMinutes: { type: Number, default: 10, min: 0 },
  overtimeAfterMinutes: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true });

export default mongoose.model("Shift", schema);
