import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    action: {
      type: String,
      required: true,
      maxlength: 100,
      index: true,
    },

    entity: {
      type: String,
      default: "",
      maxlength: 80,
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ip: {
      type: String,
      default: "",
      maxlength: 100,
    },

    userAgent: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true, strict: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorUser: 1, createdAt: -1 });

const AuditLog =
  mongoose.models.AuditLog ||
  mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
