import express from "express";
import multer from "multer";
import auth from "../middleware/auth.js";
import requireRole from "../middleware/role.js";
import { ocrLimiter } from "../middleware/rateLimit.js";
import { processOcr } from "../controllers/ocrController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:
      10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/bmp",
      "image/tiff",
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only JPG, PNG, WEBP, BMP and TIFF images are allowed."
        )
      );
    }

    cb(null, true);
  },
});

router.post(
  "/",
  auth,
  requireRole(
    "Admin",
    "Manager",
    "Employee"
  ),
  ocrLimiter,
  upload.single("file"),
  processOcr
);

export default router;
