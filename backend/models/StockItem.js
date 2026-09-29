import mongoose from "mongoose";

const stockItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  code: { type: String, trim: true, default: "", index: true },
  stockGroup: { type: String, trim: true, default: "" },
  unit: { type: String, trim: true, default: "PCS" },
  openingQty: { type: Number, default: 0 },
  openingRate: { type: Number, default: 0 },
  currentQty: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

stockItemSchema.index({ name: 1 }, { unique: true });
export default mongoose.model("StockItem", stockItemSchema);
