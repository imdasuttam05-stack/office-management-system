import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 160 },
  mailingName: { type: String, trim: true, default: "", maxlength: 160 },
  address: { type: String, trim: true, default: "", maxlength: 1200 },
  country: { type: String, trim: true, default: "India", maxlength: 80 },
  state: { type: String, trim: true, default: "", maxlength: 100 },
  pincode: { type: String, trim: true, default: "", maxlength: 12 },
  phone: { type: String, trim: true, default: "", maxlength: 30 },
  mobile: { type: String, trim: true, default: "", maxlength: 30 },
  email: { type: String, trim: true, lowercase: true, default: "", maxlength: 160 },
  gstin: { type: String, trim: true, uppercase: true, default: "", maxlength: 20 },
  pan: { type: String, trim: true, uppercase: true, default: "", maxlength: 20 },
  currencySymbol: { type: String, trim: true, default: "₹", maxlength: 8 },
  financialYearFrom: { type: String, trim: true, default: "" },
  booksBeginFrom: { type: String, trim: true, default: "" },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
}, { timestamps: true });

export default mongoose.models.Company || mongoose.model("Company", companySchema);
