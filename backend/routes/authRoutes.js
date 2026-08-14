import express from "express";
import {
  login,
  sendPasswordResetOtp,
  resetPassword,
  changeMyPassword,
  refreshAccessToken,
  logout,
  getMe,
} from "../controllers/authController.js";
import auth from "../middleware/auth.js";
import {
  loginLimiter,
  sendOtpLimiter,
  verifyOtpLimiter,
  refreshLimiter,
} from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/login", loginLimiter, login);
router.post("/forgot-password/send-otp", sendOtpLimiter, sendPasswordResetOtp);
router.post("/forgot-password/reset", verifyOtpLimiter, resetPassword);
router.post("/refresh", refreshLimiter, refreshAccessToken);
router.post("/logout", logout);
router.get("/me", auth, getMe);
router.post("/change-password", auth, changeMyPassword);

export default router;
