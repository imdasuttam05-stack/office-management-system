const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

const OCR_REQUEST_TIMEOUT_MS = 105000;
const MAX_RETURNED_TEXT_LENGTH = 20000;
const MAX_RETURNED_LINES = 500;

function getOcrConfig() {
  const rawUrl = String(process.env.OCR_API_URL || "").trim();
  const secret = String(process.env.OCR_API_SECRET || "").trim();

  if (!rawUrl || !secret) {
    return {
      error: {
        status: 503,
        code: "OCR_CONFIG_MISSING",
        message:
          "OCR is not configured on the Node backend. Set OCR_API_URL and OCR_API_SECRET in the Render backend environment. Use the Python OCR service's base URL and the same OCR_API_SECRET on both services.",
      },
    };
  }

  try {
    const url = new URL(rawUrl);
    if (!["https:", "http:"].includes(url.protocol)) {
      throw new Error("Unsupported URL protocol");
    }

    if (
      process.env.NODE_ENV === "production" &&
      url.protocol !== "https:"
    ) {
      throw new Error("Production OCR URL must use HTTPS");
    }

    // Accept either the service base URL or a URL ending in /ocr. This avoids
    // accidentally generating /ocr/ocr when the Render URL was entered with
    // the endpoint suffix.
    url.search = "";
    url.hash = "";
    const basePath = url.pathname.replace(/\/+$/, "");
    const ocrUrl = new URL(url.toString());
    if (!basePath.endsWith("/ocr")) {
      ocrUrl.pathname = `${basePath}/ocr`;
    }

    const healthUrl = new URL(ocrUrl.toString());
    healthUrl.pathname = healthUrl.pathname.replace(/\/ocr$/, "/health");

    return {
      url: ocrUrl.toString(),
      healthUrl: healthUrl.toString(),
      secret,
    };
  } catch (error) {
    return {
      error: {
        status: 503,
        code: "OCR_URL_INVALID",
        message:
          "OCR_API_URL is invalid. Set it to the HTTPS base URL of the Python OCR Render service (do not include /health).",
      },
    };
  }
}

function hasValidMagicBytes(buffer, mime) {
  if (!buffer || buffer.length < 4) return false;

  if (mime === "image/jpeg") {
    return (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mime === "image/png") {
    return Buffer.from("89504e470d0a1a0a", "hex").equals(
      buffer.subarray(0, 8)
    );
  }

  if (mime === "image/webp") {
    return (
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP"
    );
  }

  if (mime === "image/bmp") {
    return buffer.subarray(0, 2).toString() === "BM";
  }

  if (mime === "image/tiff") {
    const header = buffer.subarray(0, 4).toString("hex");
    return header === "49492a00" || header === "4d4d002a";
  }

  return false;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    OCR_REQUEST_TIMEOUT_MS
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export const checkOcrHealth = async (req, res) => {
  const config = getOcrConfig();
  if (config.error) {
    return res.status(config.error.status).json({
      success: false,
      service: "python-ocr",
      status: "not_configured",
      code: config.error.code,
      message: config.error.message,
    });
  }

  try {
    const response = await fetchWithTimeout(config.healthUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await readJsonSafely(response);

    if (!response.ok || data.status !== "healthy") {
      console.error("OCR HEALTH CHECK FAILED:", response.status);
      return res.status(503).json({
        success: false,
        service: "python-ocr",
        status: "unavailable",
        code: "OCR_SERVICE_NOT_READY",
        message:
          "The Python OCR service is reachable but is not ready. Check its Render deployment logs and Tesseract installation.",
      });
    }

    return res.status(200).json({
      success: true,
      service: "python-ocr",
      status: "healthy",
      engine: data.engine || "Tesseract",
      languages: Array.isArray(data.languages) ? data.languages : [],
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error(
      "OCR HEALTH CHECK ERROR:",
      timedOut ? "request timed out" : error?.message || error
    );

    return res.status(timedOut ? 504 : 503).json({
      success: false,
      service: "python-ocr",
      status: "unavailable",
      code: timedOut ? "OCR_HEALTH_TIMEOUT" : "OCR_SERVICE_UNREACHABLE",
      message: timedOut
        ? "The Python OCR service health check timed out. Check the OCR Render service."
        : "The Python OCR service cannot be reached. Confirm that the separate Python OCR Render service is deployed and running, and that OCR_API_URL is correct.",
    });
  }
};

export const processOcr = async (req, res) => {
  const config = getOcrConfig();
  if (config.error) {
    return res.status(config.error.status).json({
      success: false,
      code: config.error.code,
      message: config.error.message,
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      code: "OCR_FILE_REQUIRED",
      message: "Please upload an image.",
    });
  }

  if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      code: "OCR_UNSUPPORTED_IMAGE",
      message: "Unsupported image format.",
    });
  }

  if (!hasValidMagicBytes(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      code: "OCR_INVALID_IMAGE_CONTENT",
      message: "The uploaded file is not a valid image.",
    });
  }

  try {
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], {
      type: req.file.mimetype,
    });
    const safeName = String(req.file.originalname || "upload")
      .replace(/[\\/\r\n\0]/g, "_")
      .slice(0, 150);

    formData.append("file", blob, safeName || "upload");

    const response = await fetchWithTimeout(config.url, {
      method: "POST",
      headers: {
        "X-OCR-SECRET": config.secret,
        Accept: "application/json",
      },
      body: formData,
    });

    const data = await readJsonSafely(response);

    if (!response.ok) {
      console.error("OCR SERVICE ERROR STATUS:", response.status);

      if (response.status === 401 || response.status === 403) {
        return res.status(503).json({
          success: false,
          code: "OCR_SECRET_MISMATCH",
          message:
            "OCR service authentication failed. Set exactly the same OCR_API_SECRET in the Node backend and Python OCR Render services, then redeploy both services.",
        });
      }

      if (response.status === 404) {
        return res.status(503).json({
          success: false,
          code: "OCR_URL_PATH_INVALID",
          message:
            "The configured OCR service URL does not point to the OCR endpoint. Set OCR_API_URL to the Python OCR service base URL, without /ocr or /health.",
        });
      }

      if (response.status === 413) {
        return res.status(413).json({
          success: false,
          code: "OCR_FILE_TOO_LARGE",
          message: "Image is too large. Maximum size is 10 MB.",
        });
      }

      if (response.status === 400) {
        return res.status(400).json({
          success: false,
          code: "OCR_IMAGE_REJECTED",
          message: data.error || data.message || "The OCR service rejected this image.",
        });
      }

      return res.status(503).json({
        success: false,
        code: "OCR_SERVICE_ERROR",
        message:
          "The Python OCR service returned an error. Check the OCR service logs on Render and try again.",
      });
    }

    if (data.success === false) {
      return res.status(502).json({
        success: false,
        code: "OCR_EMPTY_RESULT",
        message: data.error || data.message || "OCR could not process this image.",
      });
    }

    return res.status(200).json({
      success: true,
      text:
        typeof data.text === "string"
          ? data.text.slice(0, MAX_RETURNED_TEXT_LENGTH)
          : "",
      lines: Array.isArray(data.lines)
        ? data.lines.slice(0, MAX_RETURNED_LINES)
        : [],
      confidence: Number.isFinite(Number(data.confidence))
        ? Number(data.confidence)
        : null,
      fields:
        data.fields && typeof data.fields === "object"
          ? data.fields
          : {},
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error(
      "OCR PROXY ERROR:",
      timedOut ? "request timed out" : error?.message || error
    );

    return res.status(timedOut ? 504 : 503).json({
      success: false,
      code: timedOut ? "OCR_SERVICE_TIMEOUT" : "OCR_SERVICE_UNREACHABLE",
      message: timedOut
        ? "OCR processing took too long. The OCR Render service timed out; try a smaller or clearer image."
        : "The Python OCR service is unavailable. Confirm that it is deployed and running on Render, then check OCR_API_URL and the OCR service logs.",
    });
  }
};
