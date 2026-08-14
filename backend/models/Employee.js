import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema({
  employeeCode: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  mobile: String,
  department: String,
  designation: String,
  joiningDate: { type: Date, required: true },
  basicSalary: { type: Number, default: 0, min: 0 },
  allowances: { type: Map, of: Number, default: {} },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true });

export default mongoose.model("Employee", employeeSchema);
