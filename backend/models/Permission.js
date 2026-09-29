import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 150,
    },

    module: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    isSystemPermission: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, strict: true }
);

const Permission =
  mongoose.models.Permission ||
  mongoose.model("Permission", permissionSchema);

export default Permission;
