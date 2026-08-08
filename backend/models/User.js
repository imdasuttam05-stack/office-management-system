import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "User",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    role: {
      type: String,

      // Automatically convert old lowercase values
      // to the correct role format.
      set: (value) => {
        if (!value) return "Employee";

        const role = String(value).trim().toLowerCase();

        if (role === "admin") {
          return "Admin";
        }

        if (role === "manager") {
          return "Manager";
        }

        if (role === "employee") {
          return "Employee";
        }

        return value;
      },

      enum: ["Admin", "Manager", "Employee"],

      default: "Employee",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);
