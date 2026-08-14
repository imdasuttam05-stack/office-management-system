import rateLimit from "express-rate-limit";

const jsonMessage = (message) => ({
  success: false,
  message,
});

// General API protection
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage(
    "Too many requests. Please try again later."
  ),
});

// Login protection
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage(
    "Too many login attempts. Please try again later."
  ),
});

// OTP sending
export const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage(
    "Too many OTP requests. Please try again later."
  ),
});

// OTP verification
export const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage(
    "Too many OTP verification attempts. Please try again later."
  ),
});

// Refresh token
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage(
    "Too many refresh requests. Please try again later."
  ),
});

// OCR
export const ocrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage(
    "Too many OCR requests. Please try again later."
  ),
});
