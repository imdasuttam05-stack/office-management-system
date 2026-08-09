const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

function hasValidMagicBytes(
  buffer,
  mime
) {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  if (
    mime === "image/jpeg"
  ) {
    return (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (
    mime === "image/png"
  ) {
    return Buffer.from(
      "89504e470d0a1a0a",
      "hex"
    ).equals(
      buffer.subarray(0, 8)
    );
  }

  if (
    mime === "image/webp"
  ) {
    return (
      buffer.subarray(0, 4).toString() ===
        "RIFF" &&
      buffer.subarray(8, 12).toString() ===
        "WEBP"
    );
  }

  if (
    mime === "image/bmp"
  ) {
    return (
      buffer.subarray(0, 2).toString() ===
      "BM"
    );
  }

  if (
    mime === "image/tiff"
  ) {
    const header =
      buffer.subarray(0, 4).toString("hex");

    return (
      header === "49492a00" ||
      header === "4d4d002a"
    );
  }

  return false;
}

export const processOcr = async (
  req,
  res
) => {
  try {
    if (!process.env.OCR_API_URL) {
      return res.status(503).json({
        success: false,
        message:
          "OCR service is not configured.",
      });
    }

    if (!process.env.OCR_API_SECRET) {
      return res.status(503).json({
        success: false,
        message:
          "OCR security configuration is missing.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload an image.",
      });
    }

    if (
      !ALLOWED_MIME_TYPES.has(
        req.file.mimetype
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Unsupported image format.",
      });
    }

    if (
      !hasValidMagicBytes(
        req.file.buffer,
        req.file.mimetype
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The uploaded file is not a valid image.",
      });
    }

    const formData =
      new FormData();

    const blob =
      new Blob(
        [req.file.buffer],
        {
          type: req.file.mimetype,
        }
      );

    formData.append(
      "file",
      blob,
      req.file.originalname
        .slice(0, 150)
    );

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        90000
      );

    let response;

    try {
      response =
        await fetch(
          process.env.OCR_API_URL.replace(
            /\/$/,
            ""
          ) + "/ocr",
          {
            method: "POST",
            headers: {
              "X-OCR-SECRET":
                process.env.OCR_API_SECRET,
            },
            body: formData,
            signal:
              controller.signal,
          }
        );
    } finally {
      clearTimeout(timeout);
    }

    let data = {};

    try {
      data =
        await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error(
        "OCR SERVICE ERROR STATUS:",
        response.status
      );

      return res.status(502).json({
        success: false,
        message:
          "OCR service could not process the image.",
      });
    }

    return res.status(200).json({
      success: true,
      text:
        typeof data.text === "string"
          ? data.text.slice(0, 20000)
          : "",
      lines:
        Array.isArray(data.lines)
          ? data.lines.slice(0, 500)
          : [],
      confidence:
        Number.isFinite(
          Number(data.confidence)
        )
          ? Number(data.confidence)
          : null,
      fields:
        data.fields &&
        typeof data.fields ===
          "object"
          ? data.fields
          : {},
    });
  } catch (error) {
    console.error(
      "OCR PROXY ERROR:",
      error.message
    );

    return res.status(502).json({
      success: false,
      message:
        "OCR processing failed. Please try again.",
    });
  }
};
