import re
import cv2
import numpy as np
import easyocr


reader = easyocr.Reader(
    ["en"],
    gpu=False
)


def clean_text(text):
    text = text.replace("\n", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def find_amount(text):
    patterns = [
        r"(?:total|amount|amt|paid)[^\d]{0,15}₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
        r"₹\s*([0-9,]+(?:\.[0-9]{1,2})?)",
        r"\b([0-9,]+\.[0-9]{2})\b"
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:
            value = match.group(1)
            value = value.replace(",", "")

            try:
                return float(value)
            except:
                pass

    return ""


def find_upi(text):
    patterns = [
        r"(?:upi|gpay|google pay)[\s:/-]*([A-Za-z0-9._-]+@[A-Za-z0-9._-]+)",
        r"\b([A-Za-z0-9._-]+@[A-Za-z0-9._-]+)\b"
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:
            return match.group(1)

    return ""


def find_date(text):
    patterns = [
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
        r"\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b"
    ]

    for pattern in patterns:
        match = re.search(pattern, text)

        if match:
            return match.group(1)

    return ""


def find_bill_no(text):
    patterns = [
        r"(?:invoice|bill|bill no|invoice no)[\s:#-]*([A-Za-z0-9/-]+)"
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:
            return match.group(1)

    return ""


def find_payee(text):
    patterns = [
        r"(?:paid to|payee|merchant|name)[\s:.-]+([A-Za-z][A-Za-z .&'-]{2,50})"
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:
            return match.group(1).strip()

    return ""


def extract_expense_data(image_bytes):

    image_array = np.frombuffer(
        image_bytes,
        np.uint8
    )

    image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    if image is None:
        raise ValueError("Invalid image")

    # Improve image for OCR
    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    gray = cv2.resize(
        gray,
        None,
        fx=1.5,
        fy=1.5,
        interpolation=cv2.INTER_CUBIC
    )

    results = reader.readtext(
        gray,
        detail=1
    )

    detected_text = []

    for item in results:
        if len(item) >= 2:
            detected_text.append(
                item[1]
            )

    raw_text = "\n".join(
        detected_text
    )

    text = clean_text(raw_text)

    amount = find_amount(text)
    upi = find_upi(text)
    date = find_date(text)
    bill_no = find_bill_no(text)
    payee = find_payee(text)

    return {
        "date": date,
        "natureOfExpense": "",
        "amount": amount,
        "gpayNo": upi,
        "payeeName": payee,
        "billNo": bill_no,
        "description": "",
        "rawText": raw_text
    }
