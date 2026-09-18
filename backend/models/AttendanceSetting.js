import mongoose from "mongoose";

const dayRule = new mongoose.Schema({
  type: { type: String, enum: ["Working", "Half Day", "Week Off"], default: "Working" },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
  overtimeAllowed: { type: Boolean, default: true }
}, { _id: false });

const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: "default" },
  saturday: { type: dayRule, default: () => ({ type: "Working" }) },
  days: {
    monday: { type: dayRule, default: () => ({ type: "Working" }) },
    tuesday: { type: dayRule, default: () => ({ type: "Working" }) },
    wednesday: { type: dayRule, default: () => ({ type: "Working" }) },
    thursday: { type: dayRule, default: () => ({ type: "Working" }) },
    friday: { type: dayRule, default: () => ({ type: "Working" }) },
    sunday: { type: dayRule, default: () => ({ type: "Week Off" }) }
  },
  defaultShiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null }
}, { timestamps: true });

export default mongoose.model("AttendanceSetting", schema);
