import Otp from "../models/Otp.js";
import User from "../models/User.js";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtpEmail } from "../services/emailService.js";
import jwt from "jsonwebtoken";

// ==========================================
// SEND OTP
// ==========================================
export const sendOtp = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const otp = generateOtp();

    // Delete previous OTP
    await Otp.deleteMany({ email });

    // Create new OTP
    await Otp.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Send OTP email
    await sendOtpEmail(email, otp);

    console.log(`OTP sent successfully to ${email}`);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Send OTP Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send OTP",
    });
  }
};

// ==========================================
// VERIFY OTP
// ==========================================
export const verifyOtp = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();

    console.log("========== VERIFY OTP ==========");
    console.log("Email:", email);
    console.log("OTP:", otp);

    // ------------------------------------------
    // Validate input
    // ------------------------------------------
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be 6 digits",
      });
    }

    // ------------------------------------------
    // Check JWT_SECRET
    // ------------------------------------------
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is NOT configured!");

      return res.status(500).json({
        success: false,
        message: "Server authentication configuration is missing",
      });
    }

    // ------------------------------------------
    // Find OTP
    // ------------------------------------------
    const otpRecord = await Otp.findOne({
      email,
      otp,
    });

    if (!otpRecord) {
      console.log("Invalid OTP");

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    console.log("OTP found in database");

    // ------------------------------------------
    // Check expiry
    // ------------------------------------------
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({
        _id: otpRecord._id,
      });

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    // ------------------------------------------
    // Find or create user
    // ------------------------------------------
    let user = await User.findOne({ email });

    if (!user) {
      console.log("Creating new user:", email);

      user = await User.create({
        email,
        role: "employee",
        isActive: true,
      });
    }

    console.log("User:", user.email);

    // ------------------------------------------
    // Delete used OTP
    // ------------------------------------------
    await Otp.deleteOne({
      _id: otpRecord._id,
    });

    // ------------------------------------------
    // Create JWT
    // ------------------------------------------
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    console.log("JWT created successfully");

    // ------------------------------------------
    // Response
    // ------------------------------------------
    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("========== VERIFY OTP ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Unable to verify OTP",
    });
  }
};
