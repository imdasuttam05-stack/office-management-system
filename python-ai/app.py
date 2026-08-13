from flask import Flask, request, jsonify
from flask_cors import CORS
from ocr import extract_text
import os
import tempfile

app = Flask(__name__)
CORS(app, resources={r"/health": {"origins": "*"}})

MAX_FILE_SIZE = 10 * 1024 * 1024
OCR_API_SECRET = os.environ.get("OCR_API_SECRET", "").strip()

app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".tiff",
    ".tif",
}


def is_authorized():
    if not OCR_API_SECRET:
        return False
    return request.headers.get("X-OCR-SECRET", "") == OCR_API_SECRET


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "ok",
        "service": "Office Management OCR API",
        "ocr": "Tesseract",
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "ocr": "tesseract",
    })


@app.route("/ocr", methods=["POST"])
def ocr():
    if not is_authorized():
        return jsonify({
            "success": False,
            "error": "Unauthorized",
        }), 401

    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file uploaded",
        }), 400

    file = request.files["file"]

    if not file or file.filename == "":
        return jsonify({
            "success": False,
            "error": "No file selected",
        }), 400

    extension = os.path.splitext(file.filename.lower())[1]

    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({
            "success": False,
            "error": "Unsupported image format",
        }), 400

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension,
        ) as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name

        result = extract_text(
            temp_path,
            lang=os.environ.get("OCR_LANG", "eng"),
        )

        return jsonify({
            "success": True,
            "text": result.get("text", "")[:20000],
            "lines": result.get("lines", [])[:500],
            "confidence": result.get("confidence"),
            "fields": result.get("fields", {}),
        })

    except Exception:
        return jsonify({
            "success": False,
            "error": "OCR processing failed.",
        }), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({
        "success": False,
        "error": "File too large. Maximum size is 10 MB.",
    }), 413


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
    
