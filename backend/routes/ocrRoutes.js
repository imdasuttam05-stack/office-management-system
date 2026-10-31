import express from "express";
import multer from "multer";

import auth from "../middleware/auth.js";
import { ocrLimiter } from "../middleware/rateLimit.js";
import {
  checkOcrHealth,
  processOcr,
} from "../controllers/ocrController.js";

const router = express.Router();

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return callback(
        new Error(
          "Unsupported image format. Please upload JPG, PNG, WEBP, BMP or TIFF."
        )
      );
    }

    return callback(null, true);
  },
});

function handleImageUpload(req, res, next) {
  imageUpload.single("file")(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        code: "OCR_FILE_TOO_LARGE",
        message: "Image is too large. Maximum size is 10 MB.",
      });
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        code: "OCR_INVALID_UPLOAD_FIELD",
        message: "Upload the image in the 'file' field.",
      });
    }

    return res.status(400).json({
      success: false,
      code: "OCR_INVALID_UPLOAD",
      message: error.message || "Image upload failed.",
    });
  });
}

// The browser calls this authenticated endpoint to verify that the private
// Python/Tesseract service is configured and ready on Render.
router.get("/health", auth, ocrLimiter, checkOcrHealth);

// The browser sends multipart/form-data using the field name "file".
// The image is validated here and proxied to the private Python OCR service.
router.post(
  "/",
  auth,
  ocrLimiter,
  handleImageUpload,
  processOcr
);

export default router;
