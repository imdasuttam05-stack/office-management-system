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
  overtimeHours: { type: Number, default: 0, min: 0 },
  note: String
}, { timestamps: true });

schema.index({ employeeId: 1, date: 1 }, { unique: true });
export default mongoose.model("Attendance", schema);
