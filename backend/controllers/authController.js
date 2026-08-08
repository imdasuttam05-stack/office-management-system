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

    // Save new OTP
    await Otp.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Send email
    await sendOtpEmail(email, otp);

    console.log("=================================");
    console.log("OTP SENT SUCCESSFULLY");
    console.log("Email:", email);
    console.log("=================================");

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("========== SEND OTP ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to send OTP",
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

    console.log("=================================");
    console.log("VERIFY OTP REQUEST");
    console.log("Email:", email);
    console.log("OTP:", otp);
    console.log("=================================");

    // --------------------------------------
    // Validate input
    // --------------------------------------
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // --------------------------------------
    // Validate OTP
    // --------------------------------------
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be 6 digits",
      });
    }

    // --------------------------------------
    // JWT secret
    // --------------------------------------
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is NOT configured!");

      return res.status(500).json({
        success: false,
        message: "Server authentication configuration is missing",
      });
    }

    // --------------------------------------
    // Find OTP
    // --------------------------------------
    const otpRecord = await Otp.findOne({
      email,
      otp,
    });

    if (!otpRecord) {
      console.log("INVALID OTP");

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    console.log("OTP FOUND IN DATABASE");

    // --------------------------------------
    // Check expiry
    // --------------------------------------
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({
        _id: otpRecord._id,
      });

      console.log("OTP EXPIRED");

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    // --------------------------------------
    // Find user
    // --------------------------------------
    let user = await User.findOne({ email });

    // --------------------------------------
    // Create user
    // --------------------------------------
    if (!user) {
      console.log("USER NOT FOUND");
      console.log("CREATING USER:", email);

      user = new User({
        email,
        role: "Employee",
        isActive: true,
        isVerified: true,
        lastLogin: new Date(),
      });

      await user.save();

      console.log("NEW USER CREATED");
      console.log("USER ID:", user._id.toString());
      console.log("ROLE:", user.role);
    }

    // --------------------------------------
    // Existing user
    // --------------------------------------
    else {
      console.log("EXISTING USER FOUND");
      console.log("USER ID:", user._id.toString());
      console.log("OLD ROLE:", user.role);

      // Normalize role
      const currentRole = String(user.role || "")
        .trim()
        .toLowerCase();

      if (currentRole === "admin") {
        user.role = "Admin";
      } else if (currentRole === "manager") {
        user.role = "Manager";
      } else if (currentRole === "employee") {
        user.role = "Employee";
      } else {
        user.role = "Employee";
      }

      user.isVerified = true;
      user.isActive = true;
      user.lastLogin = new Date();

      await user.save();

      console.log("USER UPDATED");
      console.log("NEW ROLE:", user.role);
    }

    // --------------------------------------
    // Final role validation
    // --------------------------------------
    const validRoles = [
      "Admin",
      "Manager",
      "Employee",
    ];

    if (!validRoles.includes(user.role)) {
      console.error("INVALID ROLE:", user.role);

      return res.status(500).json({
        success: false,
        message: "User role configuration is invalid",
      });
    }

    // --------------------------------------
    // Delete OTP
    // --------------------------------------
    await Otp.deleteOne({
      _id: otpRecord._id,
    });

    console.log("OTP DELETED");

    // --------------------------------------
    // Create JWT
    // --------------------------------------
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

    console.log("JWT CREATED SUCCESSFULLY");

    // --------------------------------------
    // Response
    // --------------------------------------
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
    console.error("=================================");
    console.error("VERIFY OTP ERROR");
    console.error(error);
    console.error("=================================");

    return res.status(500).json({
      success: false,
      message:
        error.message || "Unable to verify OTP",
    });
  }
};
