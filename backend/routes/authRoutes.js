import express from "express";
import {
  sendOtp,
  verifyOtp,
  refreshAccessToken,
  logout,
  getMe,
} from "../controllers/authController.js";
import auth from "../middleware/auth.js";
import {
  sendOtpLimiter,
  verifyOtpLimiter,
  refreshLimiter,
} from "../middleware/rateLimit.js";

const router = express.Router();

router.post(
  "/send-otp",
  sendOtpLimiter,
  sendOtp
);

router.post(
  "/verify-otp",
  verifyOtpLimiter,
  verifyOtp
);

router.post(
  "/refresh",
  refreshLimiter,
  refreshAccessToken
);

router.post(
  "/logout",
  logout
);

router.get(
  "/me",
  auth,
  getMe
);

export default router;
