import mongoose from "mongoose";

const processSchema = new mongoose.Schema({
  type: { type: String, enum: ["Grading", "Packing"], required: true },
  date: { type: Date, default: Date.now },
  inputQty: { type: Number, default: 0 },
  outputQty: { type: Number, default: 0 },
  wastageQty: { type: Number, default: 0 },
  grade: { type: String, trim: true, default: "" },
  packingSize: { type: String, trim: true, default: "" },
  remarks: { type: String, trim: true, default: "" },
}, { _id: true });

const jobOrderSchema = new mongoose.Schema({
  jobNo: { type: String, unique: true, index: true },
  date: { type: Date, default: Date.now, index: true },
  customerName: { type: String, trim: true, default: "" },
  product: { type: String, trim: true, default: "" },
  inputQty: { type: Number, default: 0 },
  unit: { type: String, default: "KG" },
  location: { type: String, default: "" },
  status: { type: String, enum: ["Pending", "Running", "Completed", "Cancelled"], default: "Pending" },
  notes: { type: String, default: "" },
  processes: { type: [processSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

export default mongoose.model("JobOrder", jobOrderSchema);
