import mongoose from "mongoose";

const purchaseLineSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true, maxlength: 180 },
    hsn: { type: String, trim: true, default: "", maxlength: 30 },
    unit: { type: String, required: true, trim: true, maxlength: 30 },
    batchNo: { type: String, trim: true, default: "", maxlength: 80 },
    barcode: { type: String, trim: true, default: "", maxlength: 120 },
    mfgDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    qty: { type: Number, required: true, min: 0.000001 },
    purchaseRate: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    gstType: { type: String, enum: ["NONE", "CGST_SGST", "IGST"], default: "NONE" },
    cgst: { type: Number, default: 0, min: 0 },
    sgst: { type: Number, default: 0, min: 0 },
    igst: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    landedCost: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const rawMaterialPurchaseSchema = new mongoose.Schema(
  {
    purchaseNo: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    location: { type: String, required: true, trim: true, maxlength: 120, index: true },
    supplierName: { type: String, required: true, trim: true, maxlength: 180, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierMaster", default: null, index: true },
    supplierLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: "Ledger", default: null, index: true },
    supplierGSTIN: { type: String, trim: true, default: "", maxlength: 30 },
    supplierInvoiceNo: { type: String, trim: true, default: "", maxlength: 100 },
    supplierInvoiceDate: { type: Date, default: null },
    transportCost: { type: Number, default: 0, min: 0 },
    otherCost: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
    totalCGST: { type: Number, default: 0, min: 0 },
    totalSGST: { type: Number, default: 0, min: 0 },
    totalIGST: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
    remarks: { type: String, trim: true, default: "", maxlength: 2000 },
    status: { type: String, enum: ["POSTED", "CANCELLED"], default: "POSTED", index: true },
    lines: { type: [purchaseLineSchema], validate: (v) => Array.isArray(v) && v.length > 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

rawMaterialPurchaseSchema.index({ companyId: 1, date: -1 });
rawMaterialPurchaseSchema.index({ location: 1, date: -1 });
rawMaterialPurchaseSchema.index({ supplierName: 1, date: -1 });

export default mongoose.model("RawMaterialPurchase", rawMaterialPurchaseSchema);
