import Otp from "../models/Otp.js";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import AuditLog from "../models/AuditLog.js";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtpEmail } from "../services/emailService.js";
import {
  createOpaqueToken,
  getClientIp,
  hashOtp,
  safeEqualStrings,
  sha256,
  setRefreshCookie,
  clearRefreshCookie,
  isAllowedOrigin,
} from "../utils/security.js";
import jwt from "jsonwebtoken";

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCESS_TOKEN_EXPIRES =
  process.env.JWT_EXPIRES_IN || "15m";

const REFRESH_DAYS =
  Number(process.env.REFRESH_TOKEN_DAYS || 7);

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function allowedLoginEmails() {
  return (
    process.env.ALLOWED_LOGIN_EMAILS || ""
  )
    .split(",")
    .map((item) =>
      item.trim().toLowerCase()
    )
    .filter(Boolean);
}

function isBootstrapEmail(email) {
  return (
    normalizeEmail(
      process.env.BOOTSTRAP_ADMIN_EMAIL
    ) === email
  );
}

function canCreateUser(email) {
  return (
    isBootstrapEmail(email) ||
    allowedLoginEmails().includes(email) ||
    process.env.AUTO_REGISTER_EMPLOYEES ===
      "true"
  );
}

async function audit(req, action, userId = null, metadata = {}) {
  try {
    await AuditLog.create({
      actorUser: userId,
      action,
      entity: "Auth",
      metadata,
      ip: getClientIp(req),
      userAgent:
        req.headers["user-agent"] || "",
    });
  } catch {
    // Audit failure must not expose internal details to the client.
  }
}

function issueAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES,
    }
  );
}

async function createRefreshSession(req, res, user) {
  const rawToken =
    createOpaqueToken();

  const expiresAt =
    new Date(
      Date.now() +
        REFRESH_DAYS *
          24 *
          60 *
          60 *
          1000
    );

  await RefreshToken.create({
    tokenHash: sha256(rawToken),
    userId: user._id,
    expiresAt,
    ip: getClientIp(req),
    userAgent:
      req.headers["user-agent"] || "",
  });

  setRefreshCookie(
    res,
    rawToken
  );
}

function userPayload(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    isActive: user.isActive,
  };
}

export const sendOtp = async (req, res) => {
  try {
    const email =
      normalizeEmail(req.body?.email);

    if (
      !email ||
      !EMAIL_REGEX.test(email) ||
      email.length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    let user =
      await User.findOne({ email });

    if (!user && !canCreateUser(email)) {
      return res.status(403).json({
        success: false,
        message:
          "This email is not authorized for this office system.",
      });
    }

    if (user && !user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is inactive. Contact an administrator.",
      });
    }

    const existing =
      await Otp.findOne({ email });

    if (
      existing &&
      existing.resendAvailableAt >
        new Date()
    ) {
      return res.status(429).json({
        success: false,
        message:
          "Please wait before requesting another OTP.",
      });
    }

    await Otp.deleteMany({ email });

    const otp =
      generateOtp();

    const now =
      new Date();

    await Otp.create({
      email,
      otpHash: hashOtp(otp),
      expiresAt:
        new Date(
          now.getTime() +
            5 * 60 * 1000
        ),
      resendAvailableAt:
        new Date(
          now.getTime() +
            60 * 1000
        ),
      attempts: 0,
    });

    try {
      await sendOtpEmail(
        email,
        otp
      );
    } catch (error) {
      await Otp.deleteMany({ email });
      throw error;
    }

    await audit(
      req,
      "OTP_REQUESTED",
      user?._id || null
    );

    return res.status(200).json({
      success: true,
      message:
        "OTP sent successfully. Please check your email.",
    });
  } catch (error) {
    console.error(
      "SEND OTP ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to send OTP right now.",
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const email =
      normalizeEmail(req.body?.email);

    const otp =
      String(req.body?.otp || "")
        .trim();

    if (
      !EMAIL_REGEX.test(email) ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or OTP.",
      });
    }

    const otpRecord =
      await Otp.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired OTP.",
      });
    }

    if (
      otpRecord.expiresAt <=
      new Date()
    ) {
      await Otp.deleteOne({
        _id: otpRecord._id,
      });

      return res.status(400).json({
        success: false,
        message:
          "OTP has expired. Please request a new OTP.",
      });
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({
        _id: otpRecord._id,
      });

      return res.status(429).json({
        success: false,
        message:
          "Too many OTP attempts. Please request a new OTP.",
      });
    }

    const validOtp =
      safeEqualStrings(
        hashOtp(otp),
        otpRecord.otpHash
      );

    if (!validOtp) {
      otpRecord.attempts += 1;

      if (
        otpRecord.attempts >= 5
      ) {
        await Otp.deleteOne({
          _id: otpRecord._id,
        });
      } else {
        await otpRecord.save();
      }

      await audit(
        req,
        "OTP_FAILED"
      );

      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired OTP.",
      });
    }

    let user =
      await User.findOne({ email });

    if (!user) {
      if (!canCreateUser(email)) {
        await Otp.deleteOne({
          _id: otpRecord._id,
        });

        return res.status(403).json({
          success: false,
          message:
            "This email is not authorized for this office system.",
        });
      }

      user = await User.create({
        email,
        role: isBootstrapEmail(email)
          ? "Admin"
          : "Employee",
        isActive: true,
        isVerified: true,
        lastLogin: new Date(),
      });
    } else {
      if (!user.isActive) {
        await Otp.deleteOne({
          _id: otpRecord._id,
        });

        return res.status(403).json({
          success: false,
          message:
            "Your account is inactive. Contact an administrator.",
        });
      }

      const roles = [
        "Admin",
        "Manager",
        "Employee",
      ];

      if (!roles.includes(user.role)) {
        return res.status(500).json({
          success: false,
          message:
            "User role configuration is invalid.",
        });
      }

      user.isVerified = true;
      user.lastLogin = new Date();

      // IMPORTANT: Never reactivate a disabled account during login.
      await user.save();
    }

    await Otp.deleteOne({
      _id: otpRecord._id,
    });

    await RefreshToken.deleteMany({
      userId: user._id,
      expiresAt: {
        $lte: new Date(),
      },
    });

    const token =
      issueAccessToken(user);

    await createRefreshSession(
      req,
      res,
      user
    );

    await audit(
      req,
      "LOGIN_SUCCESS",
      user._id
    );

    return res.status(200).json({
      success: true,
      message:
        "Login successful.",
      token,
      expiresIn:
        ACCESS_TOKEN_EXPIRES,
      user:
        userPayload(user),
    });
  } catch (error) {
    console.error(
      "VERIFY OTP ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify OTP right now.",
    });
  }
};

export const refreshAccessToken = async (
  req,
  res
) => {
  try {
    if (!isAllowedOrigin(req)) {
      return res.status(403).json({
        success: false,
        message: "Origin not allowed.",
      });
    }

    const rawToken =
      req.cookies?.refresh_token;

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        message:
          "Refresh session not found.",
      });
    }

    const oldHash =
      sha256(rawToken);

    const session =
      await RefreshToken.findOneAndUpdate(
        {
          tokenHash: oldHash,
          revokedAt: null,
          expiresAt: {
            $gt: new Date(),
          },
        },
        {
          $set: {
            revokedAt: new Date(),
          },
        },
        {
          new: true,
        }
      ).populate("userId");

    if (!session?.userId) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Refresh session is invalid or expired.",
      });
    }

    const user =
      session.userId;

    if (!user.isActive) {
      clearRefreshCookie(res);

      return res.status(403).json({
        success: false,
        message:
          "Your account is inactive.",
      });
    }

    const token =
      issueAccessToken(user);

    await createRefreshSession(
      req,
      res,
      user
    );

    return res.status(200).json({
      success: true,
      token,
      expiresIn:
        ACCESS_TOKEN_EXPIRES,
      user:
        userPayload(user),
    });
  } catch (error) {
    console.error(
      "REFRESH TOKEN ERROR:",
      error.message
    );

    clearRefreshCookie(res);

    return res.status(401).json({
      success: false,
      message:
        "Unable to refresh authentication.",
    });
  }
};

export const logout = async (
  req,
  res
) => {
  try {
    if (!isAllowedOrigin(req)) {
      return res.status(403).json({
        success: false,
        message: "Origin not allowed.",
      });
    }

    const rawToken =
      req.cookies?.refresh_token;

    if (rawToken) {
      await RefreshToken.updateMany(
        {
          tokenHash:
            sha256(rawToken),
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
          },
        }
      );
    }

    clearRefreshCookie(res);

    if (req.user?._id) {
      await audit(
        req,
        "LOGOUT",
        req.user._id
      );
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logged out.",
    });
  }
};

export const getMe = async (
  req,
  res
) => {
  return res.status(200).json({
    success: true,
    user: userPayload(req.user),
  });
};
