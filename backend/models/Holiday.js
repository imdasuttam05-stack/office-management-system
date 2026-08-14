import mongoose from "mongoose";

const schema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ["Public", "Company", "Optional"], default: "Public" }
}, { timestamps: true });

export default mongoose.model("Holiday", schema);
