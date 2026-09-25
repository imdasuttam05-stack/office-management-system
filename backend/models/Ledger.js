import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
  openingBalance: { type: Number, default: 0 },
  openingType: { type: String, enum: ["Dr", "Cr"], default: "Dr" },
  gstin: { type: String, trim: true, default: "" },
  pan: { type: String, trim: true, default: "" },
  address: { type: String, trim: true, default: "" },
  phone: { type: String, trim: true, default: "" },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

ledgerSchema.index({ name: 1, group: 1 }, { unique: true });
export default mongoose.model("Ledger", ledgerSchema);
