import express from "express";

import {
  sendOtp,
  verifyOtp,
} from "../controllers/authController.js";

const router = express.Router();

// Send OTP
// POST /api/auth/send-otp
router.post("/send-otp", sendOtp);

// Verify OTP
// POST /api/auth/verify-otp
router.post("/verify-otp", verifyOtp);

export default router;
