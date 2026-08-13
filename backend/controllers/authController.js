import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import RefreshToken from "../models/RefreshToken.js";
import { sendOtpEmail } from "../services/emailService.js";
import {
  clearRefreshCookie,
  createOpaqueToken,
  getClientIp,
  hashOtp,
  setRefreshCookie,
  sha256,
} from "../utils/security.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAllowedLoginEmails() {
  return String(process.env.ALLOWED_LOGIN_EMAILS || "")
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

function isBootstrapAdmin(email) {
  return (
    normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL) === email &&
    Boolean(email)
  );
}

function canCreateNewUser(email) {
  return (
    isBootstrapAdmin(email) ||
    getAllowedLoginEmails().includes(email) ||
    String(process.env.AUTO_REGISTER_EMPLOYEES || "").toLowerCase() === "true"
  );
}

function userResponse(user) {
  return {
    id: String(user._id),
    name: user.name || "User",
    email: user.email,
    role: user.role,
    isVerified: Boolean(user.isVerified),
    isActive: Boolean(user.isActive),
    lastLogin: user.lastLogin || null,
  };
}

function signAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      userId: String(user._id),
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    }
  );
}

async function issueRefreshToken(req, res, user) {
  const rawToken = createOpaqueToken();
  const ttlDays = Math.max(
    1,
    Number(process.env.REFRESH_TOKEN_DAYS || 7)
  );

  await RefreshToken.create({
    tokenHash: sha256(rawToken),
    userId: user._id,
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
    ip: getClientIp(req).slice(0, 100),
  });

  setRefreshCookie(res, rawToken);
  return rawToken;
}

async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;

  await RefreshToken.updateOne(
    {
      tokenHash: sha256(rawToken),
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    }
  );
}

export const sendOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    let user = await User.findOne({ email });

    if (user && !user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact an administrator.",
      });
    }

    if (!user && !canCreateNewUser(email)) {
      return res.status(403).json({
        success: false,
        message: "This email is not authorized to access the system.",
      });
    }

    const latestOtp = await Otp.findOne({
      email,
      consumedAt: null,
    }).sort({ createdAt: -1 });

    if (
      latestOtp &&
      Date.now() - new Date(latestOtp.createdAt).getTime() <
        OTP_RESEND_COOLDOWN_MS
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait 60 seconds before requesting another OTP.",
      });
    }

    if (!user) {
      user = await User.create({
        name: isBootstrapAdmin(email) ? "Administrator" : "User",
        email,
        role: isBootstrapAdmin(email) ? "Admin" : "Employee",
        isVerified: false,
        isActive: true,
      });
    }

    await Otp.deleteMany({
      email,
      consumedAt: null,
    });

    const otp = String(crypto.randomInt(100000, 1000000));

    await Otp.create({
      email,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await sendOtpEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
    });
  } catch (error) {
    console.error("SEND OTP ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to send OTP. Please try again.",
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();

    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email and 6-digit OTP.",
      });
    }

    const record = await Otp.findOne({
      email,
      consumedAt: null,
    }).sort({ createdAt: -1 });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      return res.status(401).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect OTP attempts. Please request a new OTP.",
      });
    }

    const isCorrect =
      String(record.otpHash) === String(hashOtp(otp));

    if (!isCorrect) {
      record.attempts += 1;
      await record.save();

      return res.status(401).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    record.consumedAt = new Date();
    await record.save();

    const user = await User.findOne({ email });

    if (!user || !user.isActive) {
      clearRefreshCookie(res);
      return res.status(403).json({
        success: false,
        message: "Your account is inactive or unavailable.",
      });
    }

    user.isVerified = true;
    user.lastLogin = new Date();
    await user.save();

    const token = signAccessToken(user);
    await issueRefreshToken(req, res, user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: userResponse(user),
    });
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP. Please try again.",
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
      await revokeRefreshToken(rawToken);
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: "User account is unavailable.",
      });
    }

    await revokeRefreshToken(rawToken);

    const token = signAccessToken(user);
    await issueRefreshToken(req, res, user);

    return res.status(200).json({
      success: true,
      token,
      user: userResponse(user),
    });
  } catch (error) {
    console.error("REFRESH TOKEN ERROR:", error.message);

    clearRefreshCookie(res);

    return res.status(401).json({
      success: false,
      message: "Unable to refresh session.",
    });
  }
};

export const logout = async (req, res) => {
  try {
    await revokeRefreshToken(req.cookies?.refresh_token);
  } catch (error) {
    console.error("LOGOUT TOKEN ERROR:", error.message);
  }

  clearRefreshCookie(res);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};

export const getMe = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    return res.status(200).json({
      success: true,
      user: userResponse(req.user),
    });
  } catch (error) {
    console.error("GET ME ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load user profile.",
    });
  }
};
