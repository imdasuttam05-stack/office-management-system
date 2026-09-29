import mongoose from "mongoose";

const schema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  leaveType: { type: String, enum: ["Casual", "Sick", "Earned", "Unpaid", "Other"], default: "Casual" },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  days: { type: Number, required: true },
  reason: String,
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" }
}, { timestamps: true });

export default mongoose.model("Leave", schema);
