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
import userRoutes from "./routes/userRoutes.js";
import { ensureBootstrapAdmin } from "./services/bootstrapAdmin.js";
import {
  apiLimiter,
} from "./middleware/rateLimit.js";
import connectDB from "./config/db.js";

const app = express();

const PORT =
  Number(process.env.PORT) || 10000;

const allowedOrigins = (
  process.env.CLIENT_URL || ""
)
  .split(",")
  .map((item) =>
    item.trim()
  )
  .filter(Boolean);

await connectDB();
await ensureBootstrapAdmin();

app.set(
  "trust proxy",
  1
);

app.disable(
  "x-powered-by"
);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      if (
        allowedOrigins.includes(
          origin
        )
      ) {
        return callback(
          null,
          true
        );
      }

      console.warn(
        "Blocked CORS origin:",
        origin
      );

      return callback(
        new Error(
          "CORS origin not allowed."
        )
      );
    },
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

app.use(
  cookieParser()
);

if (
  process.env.NODE_ENV !== "test"
) {
  app.use(
    morgan("combined")
  );
}

app.get(
  "/",
  (req, res) => {
    res.status(200).json({
      success: true,
      message:
        "Office Management API is running",
      environment:
        process.env.NODE_ENV ||
        "development",
      timestamp:
        new Date().toISOString(),
    });
  }
);

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      success: true,
      service:
        "office-management-backend",
      database:
        "MongoDB Atlas",
      timestamp:
        new Date().toISOString(),
    });
  }
);

app.use(
  "/api",
  apiLimiter
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/expenses",
  expenseRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/ocr",
  ocrRoutes
);

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      message:
        "API route not found.",
    });
  }
);

app.use(
  (err, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      err.message
    );

    const isUploadError =
      err?.name ===
        "MulterError" ||
      String(
        err?.message || ""
      ).includes(
        "Only JPG"
      );

    if (
      err?.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res.status(413).json({
        success: false,
        message:
          "Image is too large. Maximum size is 10 MB.",
      });
    }

    if (isUploadError) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid image upload.",
      });
    }

    return res.status(
      err.statusCode || 500
    ).json({
      success: false,
      message:
        process.env.NODE_ENV ===
        "production"
          ? "Internal server error."
          : err.message ||
            "Internal server error.",
    });
  }
);

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Office Management Backend running on port ${PORT}`
    );
  }
);
