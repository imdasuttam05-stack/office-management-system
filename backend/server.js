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

import { ensureBootstrapAdmin } from "./services/bootstrapAdmin.js";

import {
  apiLimiter,
} from "./middleware/rateLimit.js";

import connectDB from "./config/db.js";

const app = express();

const PORT =
  Number(process.env.PORT) || 10000;

/* =========================================================
   OPTIONAL USER ROUTES
========================================================= */

let userRoutes = null;

try {
  const userModule =
    await import("./routes/userRoutes.js");

  userRoutes =
    userModule.default || null;

  console.log(
    "User routes loaded successfully."
  );
} catch (error) {
  console.warn(
    "WARNING: userRoutes.js not found. User Management API is disabled."
  );

  console.warn(
    error?.message || error
  );
}

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = (
  process.env.CLIENT_URL || ""
)
  .split(",")
  .map((item) =>
    item.trim()
  )
  .filter(Boolean);

/* =========================================================
   DATABASE
========================================================= */

await connectDB();

/* =========================================================
   BOOTSTRAP ADMIN
========================================================= */

await ensureBootstrapAdmin();

/* =========================================================
   APP SETTINGS
========================================================= */

app.set(
  "trust proxy",
  1
);

app.disable(
  "x-powered-by"
);

/* =========================================================
   SECURITY
========================================================= */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin(origin, callback) {

      // Allow Postman / server-to-server
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      // Allow configured frontend URLs
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

/* =========================================================
   BODY PARSERS
========================================================= */

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

/* =========================================================
   LOGGER
========================================================= */

if (
  process.env.NODE_ENV !==
  "test"
) {
  app.use(
    morgan("combined")
  );
}

/* =========================================================
   ROOT
========================================================= */

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

/* =========================================================
   HEALTH
========================================================= */

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

      userRoutes:
        Boolean(userRoutes),

      hrRoutes: true,
    });
  }
);

/* =========================================================
   API RATE LIMIT
========================================================= */

app.use(
  "/api",
  apiLimiter
);

/* =========================================================
   AUTH
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   EXPENSE
========================================================= */

app.use(
  "/api/expenses",
  expenseRoutes
);

/* =========================================================
   USERS
========================================================= */

if (userRoutes) {

  app.use(
    "/api/users",
    userRoutes
  );

} else {

  app.use(
    "/api/users",
    (req, res) => {

      res.status(503).json({
        success: false,

        message:
          "User Management API is not deployed yet. Please deploy backend/routes/userRoutes.js.",
      });

    }
  );
}

/* =========================================================
   HR / PAYROLL
========================================================= */

app.use(
  "/api/payroll",
  hrRoutes
);

/* =========================================================
   OCR
========================================================= */

app.use(
  "/api/ocr",
  ocrRoutes
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({
      success: false,

      message:
        "API route not found.",

      path:
        req.originalUrl,

      method:
        req.method,
    });

  }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      err?.stack ||
        err?.message ||
        err
    );

    const isUploadError =
      err?.name ===
        "MulterError" ||
      String(
        err?.message || ""
      ).includes(
        "Only JPG"
      );

    /* File too large */

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

    /* Invalid upload */

    if (isUploadError) {

      return res.status(400).json({
        success: false,

        message:
          "Invalid image upload.",
      });

    }

    /* CORS error */

    if (
      String(
        err?.message || ""
      ).includes(
        "CORS origin not allowed"
      )
    ) {

      return res.status(403).json({
        success: false,

        message:
          "CORS origin not allowed.",
      });

    }

    return res.status(
      err?.statusCode || 500
    ).json({

      success: false,

      message:
        process.env.NODE_ENV ===
        "production"
          ? "Internal server error."
          : err?.message ||
            "Internal server error.",
    });

  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Office Management Backend running on port ${PORT}`
    );

    console.log(
      `User Management: ${
        userRoutes
          ? "ENABLED"
          : "DISABLED"
      }`
    );

    console.log(
      "HR / Payroll: ENABLED"
    );

  }
);
