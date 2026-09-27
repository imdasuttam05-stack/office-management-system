import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountsMaster', required: true },
  productName: String,
  qty: { type: Number, required: true, min: 0 },
  unit: String,
  rate: { type: Number, required: true, min: 0 },
  taxable: { type: Number, default: 0 },
  gstRate: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  packing: String,
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountsMaster', default: null },
  locationName: String,
}, { _id: false });

const schema = new mongoose.Schema({
  voucherType: { type: String, enum: ['PURCHASE','RAW_PURCHASE','SALE','PURCHASE_RETURN','SALE_RETURN','PI','EXPENSE'], required: true, index: true },
  voucherNo: { type: String, required: true, unique: true, index: true },
  date: { type: Date, default: Date.now, index: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountsMaster', default: null },
  partyName: String,
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountsMaster', default: null },
  supplierName: String,
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountsMaster', default: null },
  locationName: String,
  lines: { type: [lineSchema], default: [] },
  taxableTotal: { type: Number, default: 0 },
  cgstTotal: { type: Number, default: 0 },
  sgstTotal: { type: Number, default: 0 },
  igstTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  referenceVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountsTransaction', default: null },
  referenceVoucherNo: String,
  billNo: String,
  dueDate: Date,
  narration: String,
  status: { type: String, default: 'POSTED' },
  stockEffect: { type: String, enum: ['IN','OUT','NONE'], default: 'NONE' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

schema.index({ voucherType: 1, date: -1 });
export default mongoose.models.AccountsTransaction || mongoose.model('AccountsTransaction', schema);
