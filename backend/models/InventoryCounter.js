import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";

const schema = new mongoose.Schema({
  key: { type: String, index: true },
  seq: { type: Number, default: 0 },
});

schema.index({ companyId: 1, key: 1 }, { unique: true });
schema.plugin(companyScopePlugin, { financialYear: false });
export default mongoose.model("InventoryCounter", schema);
