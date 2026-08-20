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
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },

    consumedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1, consumedAt: 1, createdAt: -1 });

const Otp =
  mongoose.models.Otp ||
  mongoose.model("Otp", otpSchema);

export default Otp;
