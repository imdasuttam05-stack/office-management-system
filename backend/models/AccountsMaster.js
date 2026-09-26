import mongoose from "mongoose";

const accountsMasterSchema = new mongoose.Schema({
  masterType: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  alias: String,
  code: String,
  under: String,
  nature: String,
  openingBalance: { type: Number, default: 0 },
  openingType: { type: String, enum: ["Dr","Cr"], default: "Dr" },
  gstApplicable: { type: Boolean, default: false },
  gstin: String,
  pan: String,
  address: String,
  state: String,
  district: String,
  pin: String,
  mobile: String,
  email: String,
  creditLimit: { type: Number, default: 0 },
  creditDays: { type: Number, default: 0 },
  partyType: String,
  ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: "AccountsMaster", default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "AccountsMaster", default: null },
  locationName: String,
  itemType: String,
  hsn: String,
  unit: String,
  gstRate: { type: Number, default: 0 },
  purchaseRate: { type: Number, default: 0 },
  salesRate: { type: Number, default: 0 },
  openingQty: { type: Number, default: 0 },
  openingValue: { type: Number, default: 0 },
  stockLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: "AccountsMaster", default: null },
  gstStateCode: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });

accountsMasterSchema.index({ masterType: 1, name: 1 });

export default mongoose.models.AccountsMaster ||
  mongoose.model("AccountsMaster", accountsMasterSchema);
