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

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Generate OTP
    const otp = generateOtp();

    // Delete previous OTPs for this email
    await Otp.deleteMany({ email });

    // Create new OTP
    await Otp.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Send OTP email
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

    // ------------------------------------------
    // Validate input
    // ------------------------------------------
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // ------------------------------------------
    // Validate OTP format
    // ------------------------------------------
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
      console.log("INVALID OTP");

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    console.log("OTP FOUND IN DATABASE");

    // ------------------------------------------
    // Check OTP expiry
    // ------------------------------------------
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

    // ------------------------------------------
    // Find existing user
    // ------------------------------------------
    let user = await User.findOne({ email });

    // ------------------------------------------
    // Create new user
    // ------------------------------------------
    if (!user) {
      console.log("USER NOT FOUND");
      console.log("CREATING NEW USER:", email);

      user = await User.create({
        email,
        role: "Employee",
        isActive: true,
        isVerified: true,
        lastLogin: new Date(),
      });

      console.log("NEW USER CREATED");
      console.log("User ID:", user._id.toString());
      console.log("Role:", user.role);
    } else {
      // ------------------------------------------
      // Existing user
      // ------------------------------------------
      console.log("EXISTING USER FOUND");
      console.log("User ID:", user._id.toString());
      console.log("Current Role:", user.role);

      // ------------------------------------------
      // Fix old/invalid role values
      // ------------------------------------------
      const validRoles = [
        "Admin",
        "Manager",
        "Employee",
      ];

      if (!validRoles.includes(user.role)) {
        console.log(
          "Invalid/old role detected:",
          user.role,
          "-> changing to Employee"
        );

        user.role = "Employee";
      }

      // ------------------------------------------
      // Update login information
      // ------------------------------------------
      user.isVerified = true;
      user.lastLogin = new Date();

      // Make sure account is active
      user.isActive = true;

      await user.save();

      console.log("EXISTING USER UPDATED");
      console.log("Role:", user.role);
    }

    // ------------------------------------------
    // Make sure role is valid before JWT
    // ------------------------------------------
    if (
      !["Admin", "Manager", "Employee"].includes(
        user.role
      )
    ) {
      console.error("INVALID USER ROLE:", user.role);

      return res.status(500).json({
        success: false,
        message: "User role configuration is invalid",
      });
    }

    // ------------------------------------------
    // Delete used OTP
    // ------------------------------------------
    await Otp.deleteOne({
      _id: otpRecord._id,
    });

    console.log("OTP DELETED");

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

    console.log("JWT CREATED SUCCESSFULLY");

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
