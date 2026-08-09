from flask import Flask, request, jsonify
from flask_cors import CORS
from ocr import extract_text
import os
import tempfile

app = Flask(__name__)
CORS(app)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "ok",
        "service": "Office Management OCR API",
        "ocr": "Tesseract"
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "ocr": "tesseract"
    })


@app.route("/ocr", methods=["POST"])
def ocr():
    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file uploaded"
        }), 400

    file = request.files["file"]

    if not file or file.filename == "":
        return jsonify({
            "success": False,
            "error": "No file selected"
        }), 400

    allowed_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".bmp",
        ".tiff",
        ".tif"
    }

    filename = file.filename.lower()
    extension = os.path.splitext(filename)[1]

    if extension not in allowed_extensions:
        return jsonify({
            "success": False,
            "error": "Unsupported image format"
        }), 400

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:

            file.save(temp_file.name)
            temp_path = temp_file.name

        result = extract_text(temp_path)

        return jsonify({
            "success": True,
            "text": result.get("text", ""),
            "lines": result.get("lines", [])
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
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
        "error": "File too large. Maximum size is 10 MB."
    }), 413


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))

    app.run(
        host="0.0.0.0",
        port=port
    )
