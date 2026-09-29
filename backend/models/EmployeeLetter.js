import mongoose from "mongoose";

const employeeLetterSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    type: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    email: { type: String, default: "" },
    status: { type: String, enum: ["Draft", "Sent", "Failed"], default: "Draft" },
    sentAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("EmployeeLetter", employeeLetterSchema);
