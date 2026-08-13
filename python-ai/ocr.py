
import os
import re
import pytesseract
from PIL import Image, ImageOps, ImageEnhance, ImageFilter


def preprocess_image(image):
    image = ImageOps.exif_transpose(image)
    image = image.convert("L")
    image = ImageEnhance.Contrast(image).enhance(1.8)
    image = image.filter(ImageFilter.SHARPEN)

    width, height = image.size
    if width < 1600:
        scale = 1600 / max(width, 1)
        image = image.resize(
            (int(width * scale), int(height * scale)),
            Image.Resampling.LANCZOS,
        )

    return image


def extract_text(image_path, lang="eng"):
    if not os.path.exists(image_path):
        raise FileNotFoundError("Image file not found")

    with Image.open(image_path) as image:
        processed_image = preprocess_image(image)
        config = "--oem 3 --psm 6"

        text = pytesseract.image_to_string(
            processed_image,
            lang=lang,
            config=config,
        ).strip()

        data = pytesseract.image_to_data(
            processed_image,
            lang=lang,
            config=config,
            output_type=pytesseract.Output.DICT,
        )

    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    confidences = []
    for raw in data.get("conf", []):
        try:
            value = float(raw)
            if value >= 0:
                confidences.append(value)
        except (TypeError, ValueError):
            pass

    confidence = (
        round(sum(confidences) / len(confidences), 2)
        if confidences
        else None
    )

    return {
        "text": text,
        "lines": lines,
        "confidence": confidence,
        "fields": extract_basic_fields(text),
    }


def extract_basic_fields(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    fields = {}

    amount_patterns = [
        r"(?:grand\s+total|net\s+amount|total|amount)\s*[:=₹$]?\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
        r"₹\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
    ]

    for pattern in amount_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            fields["amount"] = match.group(1).replace(",", "")
            break

    date_match = re.search(
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b",
        text,
    )
    if date_match:
        fields["date"] = date_match.group(1)

    bill_match = re.search(
        r"(?:bill|invoice|inv(?:oice)?)[\s#:.-]*([A-Z0-9/-]{3,})",
        text,
        flags=re.IGNORECASE,
    )
    if bill_match:
        fields["billNo"] = bill_match.group(1)

    if lines:
        ignored = re.compile(
            r"^(invoice|tax invoice|bill|receipt|gst|date|total|amount|thank you)\b",
            re.IGNORECASE,
        )
        for line in lines:
            if 3 <= len(line) <= 80 and not ignored.search(line) and not line.isdigit():
                fields["payeeName"] = line
                break

    return fields
