import os

import pytesseract
from PIL import Image, ImageOps, ImageEnhance, ImageFilter


def preprocess_image(image):
    """
    Lightweight image preprocessing.
    No OpenCV / EasyOCR / PyTorch required.
    """

    # Fix image rotation based on EXIF
    image = ImageOps.exif_transpose(image)

    # Convert to grayscale
    image = image.convert("L")

    # Increase contrast
    image = ImageEnhance.Contrast(image).enhance(1.8)

    # Slight sharpening
    image = image.filter(ImageFilter.SHARPEN)

    # Resize small images
    width, height = image.size

    if width < 1600:
        scale = 1600 / width

        new_width = int(width * scale)
        new_height = int(height * scale)

        image = image.resize(
            (new_width, new_height),
            Image.Resampling.LANCZOS
        )

    return image


def extract_text(image_path):
    """
    Extract text from an image using Tesseract OCR.
    """

    if not os.path.exists(image_path):
        raise FileNotFoundError("Image file not found")

    image = Image.open(image_path)

    try:
        processed_image = preprocess_image(image)

        # Tesseract configuration
        config = "--oem 3 --psm 6"

        text = pytesseract.image_to_string(
            processed_image,
            config=config
        )

        text = text.strip()

        lines = [
            line.strip()
            for line in text.splitlines()
            if line.strip()
        ]

        return {
            "text": text,
            "lines": lines
        }

    finally:
        image.close()
