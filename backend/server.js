import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import ocrRoutes from "./routes/ocrRoutes.js";
import hrRoutes from "./routes/hrRoutes.js";
import securityRoutes from "./routes/securityRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import accountingRoutes from "./routes/accountingRoutes.js";
import accountsMasterRoutes from "./routes/accountsMasterRoutes.js";

import {
  ensureBootstrapAdmin,
  ensureSecurityCatalog,
} from "./services/bootstrapAdmin.js";

import { apiLimiter } from "./middleware/rateLimit.js";
import connectDB from "./config/db.js";

const app = express();
const PORT = Number(process.env.PORT) || 10000;

let userRoutes = null;
try {
  const userModule = await import("./routes/userRoutes.js");
  userRoutes = userModule.default || null;
  console.log("User routes loaded successfully.");
} catch (error) {
  console.warn("WARNING: userRoutes.js not found. User Management API is disabled.");
  console.warn(error?.message || error);
}

const envOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((item) => {
    let value = String(item || "").trim();
    const markdownMatch = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (markdownMatch) value = markdownMatch[2];
    return value.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  })
  .filter((value) => value.startsWith("http://") || value.startsWith("https://"));

const fallbackOrigins = [
  "https://office-management-system-lilac.vercel.app",
];

const allowedOrigins = [
  ...new Set([
    ...envOrigins,
    ...fallbackOrigins,
    "https://office-management-system-8u8zryaln-imdasuttam05-stacks-projects.vercel.app",
  ]),
];

function isAllowedVercelProjectOrigin(origin) {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && host.endsWith(".vercel.app") && host.startsWith("office-management-system-");
  } catch {
    return false;
  }
}

console.log("Allowed CORS origins:", allowedOrigins);

await connectDB();
await ensureSecurityCatalog();
await ensureBootstrapAdmin();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = String(origin).trim().replace(/\/+$/, "");
    if (allowedOrigins.includes(normalizedOrigin) || isAllowedVercelProjectOrigin(normalizedOrigin)) {
      return callback(null, true);
    }
    console.warn("Blocked CORS origin:", origin);
    return callback(new Error("CORS origin not allowed."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "test") app.use(morgan("combined"));

app.get("/", (req, res) => res.status(200).json({
  success: true,
  message: "Office Management API is running",
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  timestamp: new Date().toISOString(),
}));

app.get("/api/health", (req, res) => res.status(200).json({
  success: true,
  service: "office-management-backend",
  timestamp: new Date().toISOString(),
  userRoutes: Boolean(userRoutes),
  hrRoutes: true,
  accountsMasterRoutes: true,
}));

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/accounts-masters", accountsMasterRoutes);

if (userRoutes) {
  app.use("/api/users", userRoutes);
} else {
  app.use("/api/users", (req, res) => res.status(503).json({
    success: false,
    message: "User Management API is not deployed yet. Please deploy backend/routes/userRoutes.js.",
  }));
}

app.use("/api/payroll", hrRoutes);
app.use("/api/ocr", ocrRoutes);

app.use((req, res) => res.status(404).json({
  success: false,
  message: "API route not found.",
  path: req.originalUrl,
  method: req.method,
}));

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err?.stack || err?.message || err);

  const isUploadError = err?.name === "MulterError" || String(err?.message || "").includes("Only JPG");

  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ success: false, message: "Image is too large. Maximum size is 10 MB." });
  if (isUploadError) return res.status(400).json({ success: false, message: "Invalid image upload." });
  if (String(err?.message || "").includes("CORS origin not allowed")) return res.status(403).json({ success: false, message: "CORS origin not allowed." });

  return res.status(err?.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error." : err?.message || "Internal server error.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Office Management Backend running on port ${PORT}`);
  console.log(`User Management: ${userRoutes ? "ENABLED" : "DISABLED"}`);
  console.log("HR / Payroll: ENABLED");
  console.log("Accounts Master: ENABLED");
});
