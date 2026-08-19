import AuditLog from "../models/AuditLog.js";
import { getClientIp } from "../utils/security.js";

function sanitizeMetadata(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  try {
    const copy = JSON.parse(JSON.stringify(value));

    const blockedKeys = new Set([
      "password",
      "passwordHash",
      "currentPassword",
      "newPassword",
      "otp",
      "otpHash",
      "token",
      "accessToken",
      "refreshToken",
      "refresh_token",
      "authorization",
      "cookie",
    ]);

    const walk = (obj) => {
      if (!obj || typeof obj !== "object") return;

      for (const key of Object.keys(obj)) {
        if (blockedKeys.has(key)) {
          delete obj[key];
        } else if (obj[key] && typeof obj[key] === "object") {
          walk(obj[key]);
        }
      }
    };

    walk(copy);
    return copy;
  } catch {
    return {};
  }
}

export async function writeAuditLog({
  req = null,
  actorUser = null,
  action,
  entity = "",
  entityId = null,
  metadata = {},
}) {
  try {
    await AuditLog.create({
      actorUser: actorUser?._id || actorUser || null,
      action,
      entity,
      entityId: entityId || null,
      metadata: sanitizeMetadata(metadata),
      ip: req ? getClientIp(req).slice(0, 100) : "",
      userAgent: req
        ? String(req.headers["user-agent"] || "").slice(0, 500)
        : "",
    });
  } catch (error) {
    // Audit logging must never turn a successful business operation into a 500.
    console.error("AUDIT LOG ERROR:", error?.message || error);
  }
}
