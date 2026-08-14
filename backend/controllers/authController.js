import crypto from "crypto";
import bcrypt from "bcrypt";
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

/* =========================================================
   AUTH CONFIG
========================================================= */

const OTP_TTL_MS =
  5 * 60 * 1000;

const OTP_RESEND_COOLDOWN_MS =
  60 * 1000;

const MAX_OTP_ATTEMPTS = 5;

const BCRYPT_ROUNDS = Math.max(
  10,
  Number(
    process.env.BCRYPT_ROUNDS || 12
  )
);

/* =========================================================
   NORMALIZERS
========================================================= */

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeMobile(value) {
  return String(value || "")
    .replace(/[^0-9+]/g, "")
    .trim();
}

/* =========================================================
   VALIDATORS
========================================================= */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function isValidMobile(mobile) {
  const digits = String(mobile || "")
    .replace(/^\+/, "");

  return /^\d{10,15}$/.test(
    digits
  );
}

function isStrongEnoughPassword(
  password
) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128
  );
}

/* =========================================================
   USER RESPONSE
   Never send passwordHash to frontend
========================================================= */

function userResponse(user) {
  return {
    id: String(user._id),

    name:
      user.name || "User",

    email:
      user.email || "",

    mobile:
      user.mobile || "",

    role:
      user.role || "Employee",

    isVerified:
      Boolean(user.isVerified),

    isActive:
      Boolean(user.isActive),

    lastLogin:
      user.lastLogin || null,

    createdAt:
      user.createdAt || null,
  };
}

/* =========================================================
   JWT
========================================================= */

function signAccessToken(user) {
  if (
    !process.env.JWT_SECRET
  ) {
    throw new Error(
      "JWT_SECRET is not configured."
    );
  }

  return jwt.sign(
    {
      userId:
        String(user._id),

      role:
        user.role,

      email:
        user.email,

      mobile:
        user.mobile,
    },

    process.env.JWT_SECRET,

    {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        "15m",
    }
  );
}

/* =========================================================
   REFRESH TOKEN
========================================================= */

async function issueRefreshToken(
  req,
  res,
  user
) {
  const rawToken =
    createOpaqueToken();

  const ttlDays = Math.max(
    1,
    Number(
      process.env.REFRESH_TOKEN_DAYS ||
        7
    )
  );

  await RefreshToken.create({
    tokenHash:
      sha256(rawToken),

    userId:
      user._id,

    expiresAt:
      new Date(
        Date.now() +
          ttlDays *
            24 *
            60 *
            60 *
            1000
      ),

    userAgent:
      String(
        req.headers[
          "user-agent"
        ] || ""
      ).slice(0, 500),

    ip:
      getClientIp(req).slice(
        0,
        100
      ),
  });

  setRefreshCookie(
    res,
    rawToken
  );
}

async function revokeRefreshToken(
  rawToken
) {
  if (!rawToken) {
    return;
  }

  await RefreshToken.updateOne(
    {
      tokenHash:
        sha256(rawToken),

      revokedAt: null,
    },

    {
      $set: {
        revokedAt:
          new Date(),
      },
    }
  );
}

/* =========================================================
   LOGIN
   Mobile + Password
   No OTP required for normal login
========================================================= */

export const login = async (
  req,
  res
) => {
  try {
    const mobile =
      normalizeMobile(
        req.body?.mobile
      );

    const password = String(
      req.body?.password || ""
    );

    /* Validate input */
    if (
      !isValidMobile(mobile) ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter your mobile number and password.",
      });
    }

    /* Find user */
    const user =
      await User.findOne({
        mobile,
      }).select(
        "+passwordHash"
      );

    /* User not found */
    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid mobile number or password.",
      });
    }

    /* Account disabled */
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is inactive. Please contact the administrator.",
      });
    }

    /*
     * Old user may not have passwordHash.
     * Do NOT let bcrypt.compare throw 500.
     */
    if (
      !user.passwordHash
    ) {
      return res.status(401).json({
        success: false,
        message:
          "This account does not have a password yet. Please use Forgot Password to set a password.",
      });
    }

    /* Compare password */
    let matched = false;

    try {
      matched =
        await bcrypt.compare(
          password,
          user.passwordHash
        );
    } catch (bcryptError) {
      console.error(
        "BCRYPT LOGIN ERROR:",
        bcryptError?.message ||
          bcryptError
      );

      return res.status(401).json({
        success: false,
        message:
          "Unable to verify password. Please reset your password.",
      });
    }

    /* Wrong password */
    if (!matched) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid mobile number or password.",
      });
    }

    /* Update login */
    user.lastLogin =
      new Date();

    user.isVerified =
      true;

    await user.save();

    /* Access token */
    const token =
      signAccessToken(user);

    /* Refresh token */
    await issueRefreshToken(
      req,
      res,
      user
    );

    return res.status(200).json({
      success: true,
      message:
        "Login successful.",

      token,

      user:
        userResponse(user),
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error?.stack ||
        error?.message ||
        error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to login. Please try again.",
    });
  }
};

/* =========================================================
   FORGOT PASSWORD - SEND OTP
   Mobile -> Registered Email
========================================================= */

export const sendPasswordResetOtp =
  async (
    req,
    res
  ) => {
    try {
      const mobile =
        normalizeMobile(
          req.body?.mobile
        );

      if (
        !isValidMobile(
          mobile
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid mobile number.",
        });
      }

      /*
       * Find active user
       */
      const user =
        await User.findOne({
          mobile,
          isActive: true,
        }).select(
          "email name mobile"
        );

      /*
       * Do not reveal whether
       * mobile exists or not.
       */
      if (!user) {
        return res.status(200).json({
          success: true,
          message:
            "If this mobile number is registered, an OTP has been sent to the registered email.",
        });
      }

      /*
       * Check latest active OTP
       */
      const latestOtp =
        await Otp.findOne({
          email:
            user.email,

          purpose:
            "password_reset",

          consumedAt:
            null,
        }).sort({
          createdAt: -1,
        });

      /*
       * 60-second cooldown
       */
      if (
        latestOtp &&
        Date.now() -
          new Date(
            latestOtp.createdAt
          ).getTime() <
          OTP_RESEND_COOLDOWN_MS
      ) {
        return res.status(429).json({
          success: false,
          message:
            "Please wait 60 seconds before requesting another OTP.",
        });
      }

      /*
       * Delete previous
       * unused OTPs
       */
      await Otp.deleteMany({
        email:
          user.email,

        purpose:
          "password_reset",

        consumedAt:
          null,
      });

      /*
       * Secure 6 digit OTP
       */
      const otp =
        String(
          crypto.randomInt(
            100000,
            1000000
          )
        );

      /*
       * Store only hash
       */
      await Otp.create({
        email:
          user.email,

        purpose:
          "password_reset",

        otpHash:
          hashOtp(otp),

        expiresAt:
          new Date(
            Date.now() +
              OTP_TTL_MS
          ),

        attempts: 0,
      });

      /*
       * Send email
       */
      await sendOtpEmail(
        user.email,
        otp,
        {
          purpose:
            "password_reset",

          name:
            user.name,
        }
      );

      /*
       * Mask email
       */
      const maskedEmail =
        String(
          user.email
        ).replace(
          /^(.{2}).*(@.*)$/,
          "$1***$2"
        );

      return res.status(200).json({
        success: true,

        message:
          "OTP sent to your registered email address.",

        maskedEmail,
      });
    } catch (error) {
      console.error(
        "PASSWORD RESET OTP ERROR:",
        error?.stack ||
          error?.message ||
          error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to send reset OTP. Please try again.",
      });
    }
  };

/* =========================================================
   RESET PASSWORD
   Mobile + OTP + New Password
========================================================= */

export const resetPassword =
  async (
    req,
    res
  ) => {
    try {
      const mobile =
        normalizeMobile(
          req.body?.mobile
        );

      const otp =
        String(
          req.body?.otp || ""
        ).trim();

      const newPassword =
        String(
          req.body
            ?.newPassword || ""
        );

      /* Validate input */
      if (
        !isValidMobile(
          mobile
        ) ||
        !/^\d{6}$/.test(
          otp
        ) ||
        !isStrongEnoughPassword(
          newPassword
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Enter a valid mobile number, 6-digit OTP, and password of at least 8 characters.",
        });
      }

      /*
       * Find user
       */
      const user =
        await User.findOne({
          mobile,
          isActive: true,
        }).select(
          "+passwordHash email name mobile"
        );

      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid reset request.",
        });
      }

      /*
       * Get latest OTP
       */
      const record =
        await Otp.findOne({
          email:
            user.email,

          purpose:
            "password_reset",

          consumedAt:
            null,
        }).sort({
          createdAt: -1,
        });

      /*
       * No OTP / expired
       */
      if (
        !record ||
        !record.expiresAt ||
        record.expiresAt.getTime() <=
          Date.now()
      ) {
        return res.status(401).json({
          success: false,
          message:
            "OTP has expired. Please request a new OTP.",
        });
      }

      /*
       * Too many attempts
       */
      if (
        Number(
          record.attempts || 0
        ) >=
        MAX_OTP_ATTEMPTS
      ) {
        return res.status(429).json({
          success: false,
          message:
            "Too many incorrect OTP attempts. Please request a new OTP.",
        });
      }

      /*
       * Verify OTP
       */
      const suppliedOtpHash =
        hashOtp(otp);

      if (
        String(
          record.otpHash
        ) !==
        String(
          suppliedOtpHash
        )
      ) {
        record.attempts =
          Number(
            record.attempts || 0
          ) + 1;

        await record.save();

        return res.status(401).json({
          success: false,
          message:
            "Invalid OTP.",
        });
      }

      /*
       * Hash new password
       */
      const newPasswordHash =
        await bcrypt.hash(
          newPassword,
          BCRYPT_ROUNDS
        );

      user.passwordHash =
        newPasswordHash;

      user.passwordChangedAt =
        new Date();

      user.isVerified =
        true;

      await user.save();

      /*
       * Consume OTP
       */
      record.consumedAt =
        new Date();

      await record.save();

      /*
       * Revoke all existing
       * refresh sessions
       */
      await RefreshToken.updateMany(
        {
          userId:
            user._id,

          revokedAt:
            null,
        },
        {
          $set: {
            revokedAt:
              new Date(),
          },
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "Password reset successfully. You can now login with your mobile number and new password.",
      });
    } catch (error) {
      console.error(
        "RESET PASSWORD ERROR:",
        error?.stack ||
          error?.message ||
          error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to reset password. Please try again.",
      });
    }
  };

/* =========================================================
   CHANGE MY PASSWORD
   Logged-in user
========================================================= */

export const changeMyPassword =
  async (
    req,
    res
  ) => {
    try {
      const currentPassword =
        String(
          req.body
            ?.currentPassword ||
            ""
        );

      const newPassword =
        String(
          req.body
            ?.newPassword || ""
        );

      if (
        !currentPassword ||
        !isStrongEnoughPassword(
          newPassword
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Current password and a new password of at least 8 characters are required.",
        });
      }

      const user =
        await User.findById(
          req.user._id
        ).select(
          "+passwordHash"
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      if (
        !user.passwordHash
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Your account does not have a password yet. Please use Forgot Password.",
        });
      }

      const matched =
        await bcrypt.compare(
          currentPassword,
          user.passwordHash
        );

      if (!matched) {
        return res.status(401).json({
          success: false,
          message:
            "Current password is incorrect.",
        });
      }

      user.passwordHash =
        await bcrypt.hash(
          newPassword,
          BCRYPT_ROUNDS
        );

      user.passwordChangedAt =
        new Date();

      await user.save();

      /*
       * Logout all other sessions
       */
      await RefreshToken.updateMany(
        {
          userId:
            user._id,

          revokedAt:
            null,
        },
        {
          $set: {
            revokedAt:
              new Date(),
          },
        }
      );

      clearRefreshCookie(
        res
      );

      return res.status(200).json({
        success: true,
        message:
          "Password changed successfully. Please login again.",
      });
    } catch (error) {
      console.error(
        "CHANGE PASSWORD ERROR:",
        error?.stack ||
          error?.message ||
          error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to change password.",
      });
    }
  };

/* =========================================================
   REFRESH ACCESS TOKEN
========================================================= */

export const refreshAccessToken =
  async (
    req,
    res
  ) => {
    try {
      const rawToken =
        req.cookies
          ?.refresh_token;

      if (!rawToken) {
        return res.status(401).json({
          success: false,
          message:
            "Refresh token missing.",
        });
      }

      const tokenRecord =
        await RefreshToken.findOne({
          tokenHash:
            sha256(
              rawToken
            ),

          revokedAt:
            null,

          expiresAt: {
            $gt:
              new Date(),
          },
        });

      if (!tokenRecord) {
        clearRefreshCookie(
          res
        );

        return res.status(401).json({
          success: false,
          message:
            "Refresh token expired or invalid.",
        });
      }

      const user =
        await User.findById(
          tokenRecord.userId
        );

      if (
        !user ||
        !user.isActive
      ) {
        await revokeRefreshToken(
          rawToken
        );

        clearRefreshCookie(
          res
        );

        return res.status(401).json({
          success: false,
          message:
            "User account is unavailable.",
        });
      }

      /*
       * Rotate refresh token
       */
      await revokeRefreshToken(
        rawToken
      );

      const token =
        signAccessToken(
          user
        );

      await issueRefreshToken(
        req,
        res,
        user
      );

      return res.status(200).json({
        success: true,

        token,

        user:
          userResponse(user),
      });
    } catch (error) {
      console.error(
        "REFRESH TOKEN ERROR:",
        error?.stack ||
          error?.message ||
          error
      );

      clearRefreshCookie(
        res
      );

      return res.status(401).json({
        success: false,
        message:
          "Unable to refresh session.",
      });
    }
  };

/* =========================================================
   LOGOUT
========================================================= */

export const logout =
  async (
    req,
    res
  ) => {
    try {
      await revokeRefreshToken(
        req.cookies
          ?.refresh_token
      );
    } catch (error) {
      console.error(
        "LOGOUT TOKEN ERROR:",
        error?.message ||
          error
      );
    }

    clearRefreshCookie(
      res
    );

    return res.status(200).json({
      success: true,
      message:
        "Logged out successfully.",
    });
  };

/* =========================================================
   GET CURRENT USER
========================================================= */

export const getMe =
  async (
    req,
    res
  ) => {
    try {
      const user =
        await User.findById(
          req.user._id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User account not found.",
        });
      }

      return res.status(200).json({
        success: true,
        user:
          userResponse(user),
      });
    } catch (error) {
      console.error(
        "GET ME ERROR:",
        error?.stack ||
          error?.message ||
          error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load user profile.",
      });
    }
  };
