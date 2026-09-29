import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null },
  nature: { type: String, enum: ["Asset", "Liability", "Income", "Expense", "Capital"], required: true },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

groupSchema.index({ name: 1, parent: 1 }, { unique: true });
export default mongoose.model("Group", groupSchema);
