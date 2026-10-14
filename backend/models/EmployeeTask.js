import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const employeeTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    priority: { type: String, enum: ["Low", "Medium", "High", "Urgent"], default: "Medium" },
    status: { type: String, enum: ["Pending", "Running", "Complete", "Cancelled"], default: "Pending" },
    dueDate: { type: Date, default: null },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

employeeTaskSchema.plugin(companyScopePlugin, { financialYear: true });

export default mongoose.model("EmployeeTask", employeeTaskSchema);
