import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    purpose: {
      type: String,
      enum: ["password_reset"],
      default: "password_reset",
      index: true,
    },

    otpHash: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    consumedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);

export default Otp;
