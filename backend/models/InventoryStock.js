import mongoose from "mongoose";

const inventoryStockSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    location: { type: String, required: true, trim: true, maxlength: 120, index: true },
    itemName: { type: String, required: true, trim: true, maxlength: 180, index: true },
    itemType: { type: String, enum: ["RAW_MATERIAL", "GRADE", "FINISHED_GOODS"], default: "RAW_MATERIAL", index: true },
    hsn: { type: String, trim: true, default: "", maxlength: 30 },
    unit: { type: String, required: true, trim: true, maxlength: 30 },
    batchNo: { type: String, trim: true, default: "", maxlength: 80, index: true },
    barcode: { type: String, trim: true, default: "", maxlength: 120, index: true },
    mfgDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    qty: { type: Number, default: 0, min: 0 },
    stockValue: { type: Number, default: 0, min: 0 },
    averageRate: { type: Number, default: 0, min: 0 },
    lastPurchaseRate: { type: Number, default: 0, min: 0 },
    lastPurchaseDate: { type: Date, default: null },
  },
  { timestamps: true }
);

inventoryStockSchema.index({ companyId: 1, location: 1, itemType: 1, itemName: 1, batchNo: 1, barcode: 1 }, { unique: true });

export default mongoose.model("InventoryStock", inventoryStockSchema);
