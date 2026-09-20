import mongoose from "mongoose";

const dayRule = new mongoose.Schema({
  type: { type: String, enum: ["Working", "Half Day", "Week Off"], default: "Working" },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
  shiftIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Shift" }],
  overtimeAllowed: { type: Boolean, default: true },
  // Target paid/work duration for overtime and cutting calculations.
  // null = derive from the selected shift duration (minus break).
  requiredWorkMinutes: { type: Number, min: 0, default: null }
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
  defaultShiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },

  // Date-specific override. A matching date takes precedence over
  // Saturday/weekday rules for that calendar date only.
  dateOverrides: [{
    date: { type: String, required: true }, // YYYY-MM-DD
    type: { type: String, enum: ["Working", "Half Day", "Week Off"], default: "Working" },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
    shiftIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Shift" }],
    overtimeAllowed: { type: Boolean, default: true },
    requiredWorkMinutes: { type: Number, min: 0, default: null },
    note: { type: String, default: "" }
  }]
}, { timestamps: true });

export default mongoose.model("AttendanceSetting", schema);
