import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    sessionId: {
      type: String,
      required: true,
      index: true,
      maxlength: 100,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedReason: {
      type: String,
      default: "",
      maxlength: 120,
    },

    userAgent: {
      type: String,
      default: "",
      maxlength: 500,
    },

    ip: {
      type: String,
      default: "",
      maxlength: 100,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    lastUsedIp: {
      type: String,
      default: "",
      maxlength: 100,
    },
  },
  { timestamps: true, strict: true }
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });
refreshTokenSchema.index({ sessionId: 1, revokedAt: 1 });

const RefreshToken =
  mongoose.models.RefreshToken ||
  mongoose.model("RefreshToken", refreshTokenSchema);

export default RefreshToken;
