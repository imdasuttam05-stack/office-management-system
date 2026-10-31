import hmac
import logging
import os
import tempfile
from pathlib import Path

import pytesseract
from flask import Flask, jsonify, request
from ocr import extract_text

app = Flask(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

OCR_API_SECRET = os.environ.get("OCR_API_SECRET", "").strip()
OCR_LANG = os.environ.get("OCR_LANG", "eng+ben").strip() or "eng"

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".tiff",
    ".tif",
}

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger("office-management-ocr")


def is_authorized():
    supplied_secret = request.headers.get("X-OCR-SECRET", "")
    return bool(OCR_API_SECRET) and hmac.compare_digest(
        supplied_secret,
        OCR_API_SECRET,
    )


def configured_languages():
    return [
        language.strip()
        for language in OCR_LANG.split("+")
        if language.strip()
    ]


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "ok",
        "service": "Office Management OCR API",
        "engine": "Tesseract",
        "health": "/health",
    })


@app.route("/health", methods=["GET"])
def health():
    try:
        version = str(pytesseract.get_tesseract_version())
        installed_languages = set(pytesseract.get_languages(config=""))
        requested_languages = configured_languages()
        missing_languages = [
            language
            for language in requested_languages
            if language not in installed_languages
        ]

        if not OCR_API_SECRET:
            return jsonify({
                "status": "not_ready",
                "engine": "Tesseract",
                "message": "OCR_API_SECRET is not configured on the Python OCR service.",
            }), 503

        if missing_languages:
            return jsonify({
                "status": "not_ready",
                "engine": "Tesseract",
                "version": version,
                "languages": sorted(installed_languages),
                "missingLanguages": missing_languages,
            }), 503

        return jsonify({
            "status": "healthy",
            "engine": "Tesseract",
            "version": version,
            "languages": requested_languages,
            "securityConfigured": True,
        }), 200
    except Exception:
        logger.exception("OCR health check failed")
        return jsonify({
            "status": "not_ready",
            "engine": "Tesseract",
            "message": "Tesseract is not ready. Check the OCR service installation and logs.",
        }), 503


@app.route("/ocr", methods=["POST"])
def ocr():
    if not is_authorized():
        return jsonify({
            "success": False,
            "error": "OCR service authentication failed. Check OCR_API_SECRET on both services.",
        }), 401

    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file uploaded. Use the 'file' upload field.",
        }), 400

    uploaded_file = request.files["file"]
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({
            "success": False,
            "error": "No file selected.",
        }), 400

    extension = Path(uploaded_file.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({
            "success": False,
            "error": "Unsupported image format. Upload JPG, PNG, WEBP, BMP or TIFF.",
        }), 400

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            delete=False,
            suffix=extension,
        ) as temp_file:
            uploaded_file.save(temp_file)
            temp_path = temp_file.name

        result = extract_text(temp_path, lang=OCR_LANG)

        return jsonify({
            "success": True,
            "text": str(result.get("text", ""))[:20000],
            "lines": result.get("lines", [])[:500],
            "confidence": result.get("confidence"),
            "fields": result.get("fields", {}),
        }), 200

    except Exception:
        logger.exception("OCR image processing failed")
        return jsonify({
            "success": False,
            "error": "OCR processing failed. Check that the uploaded image is readable and that Tesseract is healthy.",
        }), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                logger.warning("Could not remove temporary OCR image file")


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({
        "success": False,
        "error": "File too large. Maximum size is 10 MB.",
    }), 413


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port)
