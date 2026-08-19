import express from "express";
import auth from "../middleware/auth.js";
import requirePermission from "../middleware/permission.js";
import RefreshToken from "../models/RefreshToken.js";
import AuditLog from "../models/AuditLog.js";
import { writeAuditLog } from "../services/auditService.js";

const router = express.Router();

router.use(auth);

// GET /api/security/sessions
router.get(
  "/sessions",
  requirePermission("security.sessions"),
  async (req, res) => {
    try {
      const sessions = await RefreshToken.find({
        userId: req.user._id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
        .select(
          "sessionId userAgent ip createdAt lastUsedAt lastUsedIp expiresAt"
        )
        .sort({ lastUsedAt: -1 })
        .lean();

      const unique = new Map();
      for (const session of sessions) {
        if (!unique.has(session.sessionId)) {
          unique.set(session.sessionId, session);
        }
      }

      return res.json({
        success: true,
        sessions: [...unique.values()],
      });
    } catch (error) {
      console.error("LIST SESSIONS ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load active sessions.",
      });
    }
  }
);

// DELETE /api/security/sessions/:sessionId
router.delete(
  "/sessions/:sessionId",
  requirePermission("security.sessions"),
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId || sessionId.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Invalid session id.",
        });
      }

      const result = await RefreshToken.updateMany(
        {
          userId: req.user._id,
          sessionId,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
            revokedReason: "revoked_by_user",
          },
        }
      );

      await writeAuditLog({
        req,
        actorUser: req.user,
        action: "SESSION_REVOKED",
        entity: "RefreshToken",
        metadata: {
          sessionId,
          modified: result.modifiedCount,
        },
      });

      return res.json({
        success: true,
        message: "Session revoked successfully.",
      });
    } catch (error) {
      console.error("REVOKE SESSION ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to revoke session.",
      });
    }
  }
);

// GET /api/security/audit-logs?limit=50&page=1
router.get(
  "/audit-logs",
  requirePermission("security.audit"),
  async (req, res) => {
    try {
      const rawLimit = Number(req.query.limit || 50);
      const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50));
      const rawPage = Number(req.query.page || 1);
      const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        AuditLog.find({})
          .populate("actorUser", "name email role isMainAdmin")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments({}),
      ]);

      return res.json({
        success: true,
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("LIST AUDIT LOGS ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load audit logs.",
      });
    }
  }
);

export default router;
