import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 80,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    permissions: {
      type: [String],
      default: [],
    },

    level: {
      type: Number,
      default: 100,
      min: 0,
      max: 10000,
      index: true,
    },

    isSystemRole: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, strict: true }
);

const Role =
  mongoose.models.Role ||
  mongoose.model("Role", roleSchema);

export default Role;
