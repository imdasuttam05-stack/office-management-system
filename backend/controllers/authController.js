import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Otp from "../models/Otp.js";
import RefreshToken from "../models/RefreshToken.js";

import { sendOtpEmail } from "../services/emailService.js";
import { writeAuditLog } from "../services/auditService.js";

import {
  clearRefreshCookie,
  createOpaqueToken,
  createSessionId,
  getClientIp,
  hashOtp,
  setRefreshCookie,
  sha256,
} from "../utils/security.js";

import { getDefaultPermissionsForUser } from "../config/permissions.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

const BCRYPT_ROUNDS = Math.max(
  10,
  Number(process.env.BCRYPT_ROUNDS || 12)
);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMobile(value) {
  return String(value || "")
    .replace(/[^0-9+]/g, "")
    .trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMobile(mobile) {
  const digits = String(mobile || "").replace(/^\+/, "");
  return /^\d{10,15}$/.test(digits);
}

function isStrongEnoughPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128
  );
}

function effectiveRole(user) {
  return user?.isMainAdmin ? "MAIN_ADMIN" : user?.role || "Employee";
}

function userResponse(user) {
  return {
    id: String(user._id),
    name: user.name || "User",
    email: user.email || "",
    mobile: user.mobile || "",
    role: user.role || "Employee",
    effectiveRole: effectiveRole(user),
    isMainAdmin: Boolean(user.isMainAdmin),
    permissions: getDefaultPermissionsForUser(user),
    companyId: user.companyId ? String(user.companyId) : null,
    branchId: user.branchId ? String(user.branchId) : null,
    warehouseIds: Array.isArray(user.warehouseIds)
      ? user.warehouseIds.map(String)
      : [],
    department: user.department || "",
    employeeId: user.employeeId ? String(user.employeeId) : null,
    isVerified: Boolean(user.isVerified),
    isActive: Boolean(user.isActive),
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt || null,
  };
}

function signAccessToken(user, sessionId) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      userId: String(user._id),
      sessionId,
      tokenVersion: Number(user.tokenVersion || 0),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
      issuer: process.env.JWT_ISSUER || "office-management-api",
      audience: process.env.JWT_AUDIENCE || "office-management-web",
      jwtid: crypto.randomUUID(),
    }
  );
}

async function issueRefreshToken(req, res, user, sessionId = createSessionId()) {
  const rawToken = createOpaqueToken();
  const ttlDays = Math.max(1, Number(process.env.REFRESH_TOKEN_DAYS || 7));

  await RefreshToken.create({
    tokenHash: sha256(rawToken),
    sessionId,
    userId: user._id,
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
    ip: getClientIp(req).slice(0, 100),
    lastUsedAt: new Date(),
    lastUsedIp: getClientIp(req).slice(0, 100),
  });

  setRefreshCookie(res, rawToken);
  return sessionId;
}

async function revokeRefreshToken(rawToken, reason = "logout") {
  if (!rawToken) return;

  await RefreshToken.updateOne(
    { tokenHash: sha256(rawToken), revokedAt: null },
    {
      $set: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    }
  );
}

async function revokeAllUserSessions(userId, reason = "security_change") {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    {
      $set: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    }
  );
}

async function incrementFailedLogin(user) {
  const attempts = Number(user.failedLoginAttempts || 0) + 1;
  user.failedLoginAttempts = attempts;

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    user.lockedUntil = new Date(
      Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000
    );
    user.failedLoginAttempts = 0;
  }

  await user.save();
}

async function clearLoginLock(user) {
  if (user.failedLoginAttempts || user.lockedUntil) {
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }
}

export const login = async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const password = String(req.body?.password || "");

    if (!isValidMobile(mobile) || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter your mobile number and password.",
      });
    }

    const user = await User.findOne({ mobile }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid mobile number or password.",
      });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() <= Date.now()) {
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
      await user.save();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await writeAuditLog({
        req,
        action: "LOGIN_BLOCKED_ACCOUNT_LOCKED",
        entity: "User",
        entityId: user._id,
        metadata: { mobile },
      });

      return res.status(423).json({
        success: false,
        message: "Too many failed attempts. Your account is temporarily locked. Please try again later.",
      });
    }

    if (!user.isActive) {
      await writeAuditLog({
        req,
        action: "LOGIN_BLOCKED_INACTIVE",
        entity: "User",
        entityId: user._id,
      });

      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact the administrator.",
      });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: "This account does not have a password yet. Please use Forgot Password to set a password.",
      });
    }

    const matched = await bcrypt.compare(password, user.passwordHash);

    if (!matched) {
      await incrementFailedLogin(user);

      await writeAuditLog({
        req,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: user._id,
        metadata: { reason: "invalid_password" },
      });

      return res.status(401).json({
        success: false,
        message: "Invalid mobile number or password.",
      });
    }

    await revokeRefreshToken(
      req.cookies?.refresh_token,
      "replaced_by_login"
    );

    await clearLoginLock(user);
    user.lastLogin = new Date();
    user.lastLoginIp = getClientIp(req).slice(0, 100);
    user.lastLoginUserAgent = String(req.headers["user-agent"] || "").slice(0, 500);
    user.isVerified = true;
    await user.save();

    const sessionId = createSessionId();
    const token = signAccessToken(user, sessionId);

    await issueRefreshToken(req, res, user, sessionId);

    await writeAuditLog({
      req,
      actorUser: user,
      action: "LOGIN_SUCCESS",
      entity: "User",
      entityId: user._id,
      metadata: {
        sessionId,
        effectiveRole: effectiveRole(user),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: userResponse(user),
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error?.stack || error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to login. Please try again.",
    });
  }
};

export const sendPasswordResetOtp = async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);

    if (!isValidMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid mobile number.",
      });
    }

    const user = await User.findOne({ mobile, isActive: true }).select(
      "email name mobile"
    );

    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If this mobile number is registered, an OTP has been sent to the registered email.",
      });
    }

    const latestOtp = await Otp.findOne({
      email: user.email,
      purpose: "password_reset",
      consumedAt: null,
    }).sort({ createdAt: -1 });

    if (
      latestOtp &&
      Date.now() - new Date(latestOtp.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait 60 seconds before requesting another OTP.",
      });
    }

    await Otp.deleteMany({
      email: user.email,
      purpose: "password_reset",
      consumedAt: null,
    });

    const otp = String(crypto.randomInt(100000, 1000000));

    await Otp.create({
      email: user.email,
      purpose: "password_reset",
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
    });

    await sendOtpEmail(user.email, otp, {
      purpose: "password_reset",
      name: user.name,
    });

    const maskedEmail = String(user.email).replace(
      /^(.{2}).*(@.*)$/,
      "$1***$2"
    );

    await writeAuditLog({
      req,
      action: "PASSWORD_RESET_OTP_SENT",
      entity: "User",
      entityId: user._id,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent to your registered email address.",
      maskedEmail,
    });
  } catch (error) {
    console.error("PASSWORD RESET OTP ERROR:", error?.stack || error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to send OTP. Please try again.",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const otp = String(req.body?.otp || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if (
      !isValidMobile(mobile) ||
      !/^\d{6}$/.test(otp) ||
      !isStrongEnoughPassword(newPassword)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid mobile number, 6-digit OTP, and password of at least 8 characters.",
      });
    }

    const user = await User.findOne({ mobile, isActive: true }).select(
      "+passwordHash email name mobile tokenVersion"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid reset request.",
      });
    }

    const record = await Otp.findOne({
      email: user.email,
      purpose: "password_reset",
      consumedAt: null,
    }).select("+otpHash").sort({ createdAt: -1 });

    if (!record || !record.expiresAt || record.expiresAt.getTime() <= Date.now()) {
      return res.status(401).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    if (Number(record.attempts || 0) >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect OTP attempts. Please request a new OTP.",
      });
    }

    const suppliedOtpHash = hashOtp(otp);

    if (String(record.otpHash) !== String(suppliedOtpHash)) {
      record.attempts = Number(record.attempts || 0) + 1;
      await record.save();

      return res.status(401).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.passwordChangedAt = new Date();
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.isVerified = true;
    await user.save();

    record.consumedAt = new Date();
    await record.save();

    await revokeAllUserSessions(user._id, "password_reset");

    await writeAuditLog({
      req,
      actorUser: user,
      action: "PASSWORD_RESET_SUCCESS",
      entity: "User",
      entityId: user._id,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now login with your mobile number and new password.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error?.stack || error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset password. Please try again.",
    });
  }
};

export const changeMyPassword = async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !isStrongEnoughPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Current password and a new password of at least 8 characters are required.",
      });
    }

    const user = await User.findById(req.user._id).select("+passwordHash tokenVersion");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        success: false,
        message: "Your account does not have a password yet. Please use Forgot Password.",
      });
    }

    const matched = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!matched) {
      await writeAuditLog({
        req,
        actorUser: user,
        action: "PASSWORD_CHANGE_FAILED",
        entity: "User",
        entityId: user._id,
      });

      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.passwordChangedAt = new Date();
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();

    await revokeAllUserSessions(user._id, "password_changed");
    clearRefreshCookie(res);

    await writeAuditLog({
      req,
      actorUser: user,
      action: "PASSWORD_CHANGED",
      entity: "User",
      entityId: user._id,
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error?.stack || error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to change password.",
    });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const rawToken = req.cookies?.refresh_token;

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token missing.",
      });
    }

    const tokenRecord = await RefreshToken.findOne({
      tokenHash: sha256(rawToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenRecord) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message: "Refresh token expired or invalid.",
      });
    }

    const user = await User.findById(tokenRecord.userId);

    if (!user || !user.isActive) {
      await revokeRefreshToken(rawToken, "user_unavailable");
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message: "User account is unavailable.",
      });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await revokeRefreshToken(rawToken, "account_locked");
      clearRefreshCookie(res);

      return res.status(423).json({
        success: false,
        message: "Your account is temporarily locked.",
      });
    }

    await revokeRefreshToken(rawToken, "rotated");

    const sessionId = tokenRecord.sessionId || createSessionId();
    const token = signAccessToken(user, sessionId);

    await issueRefreshToken(req, res, user, sessionId);

    await writeAuditLog({
      req,
      actorUser: user,
      action: "SESSION_REFRESHED",
      entity: "User",
      entityId: user._id,
      metadata: { sessionId },
    });

    return res.status(200).json({
      success: true,
      token,
      user: userResponse(user),
    });
  } catch (error) {
    console.error("REFRESH TOKEN ERROR:", error?.stack || error?.message || error);
    clearRefreshCookie(res);

    return res.status(401).json({
      success: false,
      message: "Unable to refresh session.",
    });
  }
};

export const logout = async (req, res) => {
  try {
    const rawToken = req.cookies?.refresh_token;
    const tokenRecord = rawToken
      ? await RefreshToken.findOne({
          tokenHash: sha256(rawToken),
          revokedAt: null,
        }).select("sessionId userId")
      : null;

    if (rawToken) {
      await revokeRefreshToken(rawToken, "logout");
    }

    if (req.user) {
      await writeAuditLog({
        req,
        actorUser: req.user,
        action: "LOGOUT",
        entity: "User",
        entityId: req.user._id,
        metadata: {
          sessionId: tokenRecord?.sessionId || req.auth?.sessionId || null,
        },
      });
    }
  } catch (error) {
    console.error("LOGOUT TOKEN ERROR:", error?.message || error);
  }

  clearRefreshCookie(res);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: userResponse(user),
    });
  } catch (error) {
    console.error("GET ME ERROR:", error?.stack || error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to load user profile.",
    });
  }
};
