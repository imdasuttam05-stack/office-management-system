import express from "express";
import multer from "multer";

import auth from "../middleware/auth.js";
import { processOcr } from "../controllers/ocrController.js";

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
        new Error("Unsupported image format. Please upload JPG, PNG, WEBP, BMP or TIFF."),
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
        message: "Image is too large. Maximum size is 10 MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Image upload failed.",
    });
  });
}

// The browser sends multipart/form-data with the image in the "file" field.
// Authentication runs before the upload is accepted; processOcr then proxies
// the validated image to the private Python/Tesseract OCR service.
router.post("/", auth, handleImageUpload, processOcr);

export default router;
