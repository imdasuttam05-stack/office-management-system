import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import connectDB from "./config/db.js";

const app = express();

// ==========================================
// DATABASE
// ==========================================

await connectDB();

// ==========================================
// BASIC CONFIG
// ==========================================

const PORT = process.env.PORT || 10000;
const CLIENT_URL = process.env.CLIENT_URL || "*";

// ==========================================
// SECURITY
// ==========================================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// ==========================================
// CORS
// ==========================================

app.use(
  cors({
    origin: CLIENT_URL === "*" ? true : CLIENT_URL,
    credentials: true,
  })
);

// ==========================================
// BODY PARSER
// ==========================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// ==========================================
// COOKIE
// ==========================================

app.use(cookieParser());

// ==========================================
// LOGGER
// ==========================================

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

// ==========================================
// ROOT
// ==========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Office Management API is running",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// HEALTH
// ==========================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "office-management-backend",
    database: "MongoDB Atlas",
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// API VERSION
// ==========================================

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    name: "Office Management System API",
    version: "1.0.0",
  });
});

// ==========================================
// AUTHENTICATION
// ==========================================

// POST /api/auth/send-otp
app.use("/api/auth", authRoutes);

// ==========================================
// FUTURE MODULES
// ==========================================

// Users
// app.use("/api/users", userRoutes);

// Dashboard
// app.use("/api/dashboard", dashboardRoutes);

// Expenses
// app.use("/api/expenses", expenseRoutes);

// Payments
// app.use("/api/payments", paymentRoutes);

// Reminders
// app.use("/api/reminders", reminderRoutes);

// OCR
// app.use("/api/ocr", ocrRoutes);

// Reports
// app.use("/api/reports", reportRoutes);

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log("Office Management Backend Started");
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("======================================");
  console.log("Auth API: /api/auth");
  console.log("Send OTP: POST /api/auth/send-otp");
  console.log("======================================");
});
