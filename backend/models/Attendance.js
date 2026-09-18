import mongoose from "mongoose";

const schema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  date: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ["Present", "Absent", "Half Day", "Leave", "Holiday", "Week Off"],
    required: true
  },
  checkIn: String,
  checkOut: String,
  workLocation: { type: String, trim: true },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
  shiftName: { type: String, trim: true },
  overtimeHours: { type: Number, default: 0, min: 0 },
  overtimeApproved: { type: Boolean, default: false },
  overtimeApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  overtimeApprovedAt: { type: Date, default: null },
  cuttingMinutes: { type: Number, default: 0, min: 0 },
  cuttingApproved: { type: Boolean, default: false },
  cuttingApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  cuttingApprovedAt: { type: Date, default: null },
  note: String
}, { timestamps: true });

schema.index({ employeeId: 1, date: 1 }, { unique: true });
export default mongoose.model("Attendance", schema);
