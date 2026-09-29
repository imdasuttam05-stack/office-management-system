import mongoose from "mongoose";

const schema = new mongoose.Schema({
  key: { type: String, unique: true, index: true },
  seq: { type: Number, default: 0 },
});

export default mongoose.model("InventoryCounter", schema);
