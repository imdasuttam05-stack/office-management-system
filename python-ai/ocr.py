import os
import re
import pytesseract
from PIL import Image, ImageOps, ImageEnhance, ImageFilter


DOCUMENT_KEYWORDS = (
    "voucher", "payment", "particulars", "amount", "total", "pay to",
    "payable", "invoice", "receipt", "expense", "date", "cash", "bank",
    "agri", "rise", "bill", "upi", "gpay", "transport",
)


def preprocess_image(image):
    """Prepare a bounded-size image for one OCR pass."""
    image = ImageOps.exif_transpose(image)
    image = image.convert("L")

    width, height = image.size
    longest_side = max(width, height)
    target_side = 1600
    if longest_side != target_side:
        scale = target_side / max(longest_side, 1)
        image = image.resize(
            (max(1, int(width * scale)), max(1, int(height * scale))),
            Image.Resampling.LANCZOS,
        )

    image = ImageEnhance.Contrast(image).enhance(1.7)
    image = image.filter(ImageFilter.SHARPEN)
    return image


def _ocr_words(image, lang):
    # PSM 6 is more reliable for handwritten payment-voucher tables.
    # Orientation is selected once from the page/photo aspect ratio below.
    return pytesseract.image_to_data(
        image,
        lang=lang,
        config="--oem 3 --psm 6",
        output_type=pytesseract.Output.DICT,
    )


def _data_to_text(data):
    grouped = {}
    confidences = {}

    for index, raw_word in enumerate(data.get("text", [])):
        word = str(raw_word or "").strip()
        if not word:
            continue

        key = (
            data.get("block_num", [0])[index],
            data.get("par_num", [0])[index],
            data.get("line_num", [0])[index],
        )
        grouped.setdefault(key, []).append(word)

        try:
            confidence = float(data.get("conf", [-1])[index])
        except (TypeError, ValueError):
            confidence = -1

        if confidence >= 0:
            confidences[re.sub(r"[^a-z0-9]", "", word.lower())] = confidence

    lines = [" ".join(words).strip() for words in grouped.values() if words]
    return "\n".join(lines), lines, confidences


def _orientation_score(text, confidences):
    normalized = re.sub(r"\s+", " ", (text or "").lower())
    keyword_score = sum(1 for keyword in DOCUMENT_KEYWORDS if keyword in normalized)
    confidence_values = list(confidences.values())
    average_confidence = (
        sum(confidence_values) / len(confidence_values)
        if confidence_values
        else 0
    )
    return average_confidence + keyword_score * 7 + min(len(normalized) / 250, 8)


def _clean_amount(value):
    raw = str(value or "").replace(",", "").replace("₹", "").strip()
    raw = re.sub(r"[^0-9.]", "", raw)
    if not raw or raw.count(".") > 1:
        return ""
    try:
        amount = float(raw)
    except ValueError:
        return ""
    if amount <= 0 or amount > 1_000_000_000:
        return ""
    return str(int(amount)) if amount.is_integer() else f"{amount:.2f}".rstrip("0").rstrip(".")


def _extract_date(text):
    date_pattern = r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})"
    labeled = re.search(
        rf"(?:date|dated)\s*[:#.-]?\s*{date_pattern}",
        text,
        flags=re.IGNORECASE,
    )
    if labeled:
        return labeled.group(1)
    generic = re.search(rf"\b{date_pattern}\b", text)
    return generic.group(1) if generic else ""


def _extract_labeled_value(lines, labels, stop_words=()):
    label_pattern = re.compile(
        r"(?:^|\b)(?:" + "|".join(labels) + r")\s*[:#.-]?\s*(.*)$",
        flags=re.IGNORECASE,
    )
    stop_pattern = re.compile(r"\b(?:" + "|".join(stop_words) + r")\b", re.IGNORECASE) if stop_words else None

    for line_index, line in enumerate(lines):
        match = label_pattern.search(line)
        if not match:
            continue

        value = match.group(1).strip(" .:-|_\t")
        if not value and line_index + 1 < len(lines):
            value = lines[line_index + 1].strip(" .:-|_\t")

        if stop_pattern:
            value = stop_pattern.split(value)[0]

        value = re.sub(r"\s+", " ", value).strip(" .:-|_")
        if len(value) < 2 and line_index + 1 < len(lines):
            next_value = lines[line_index + 1].strip(" .:-|_\t")
            if stop_pattern:
                next_value = stop_pattern.split(next_value)[0]
            value = re.sub(r"\s+", " ", next_value).strip(" .:-|_")
        if 2 <= len(value) <= 150:
            return value

    return ""


def _extract_fields(text, lines, confidences):
    fields = {}
    joined = "\n".join(lines) if lines else text

    # Date: prefer a value adjacent to a Date label, then use a general date.
    fields["date"] = _extract_date(joined)

    # Amount: only trust a number explicitly associated with the total/amount
    # label, and avoid autofilling very low-confidence handwritten OCR tokens.
    amount_match = re.search(
        r"(?:total\s*amount|grand\s*total|net\s*amount|payment\s*amount)\s*[:=|.-]?\s*(?:rs\.?\s*)?(?:₹\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)",
        joined,
        flags=re.IGNORECASE,
    )
    if not amount_match:
        amount_match = re.search(
            r"(?:amount\s*paid|amount)\s*[:=|.-]?\s*(?:rs\.?\s*)?(?:₹\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)",
            joined,
            flags=re.IGNORECASE,
        )

    if amount_match:
        raw_amount = amount_match.group(1)
        normalized_token = re.sub(r"[^a-z0-9]", "", raw_amount.lower())
        amount_confidence = confidences.get(normalized_token, 100)
        if amount_confidence >= 35:
            fields["amount"] = _clean_amount(raw_amount)

    # Payment reference: do not guess a UPI number when the voucher does not
    # contain an explicit UPI / transaction-reference label.
    upi_match = re.search(
        r"(?:g\s*[-]?\s*pay|gpay|upi(?:\s*(?:id|no|number))?|transaction\s*(?:id|no|number)|txn\s*(?:id|no)|utr|rrn|bank\s*ref(?:erence)?|ref(?:erence)?\s*no)\s*[:#.-]?\s*([A-Z0-9-]{8,30})",
        joined,
        flags=re.IGNORECASE,
    )
    if upi_match:
        fields["gpayNo"] = upi_match.group(1).strip("- ")

    # Voucher / bill / invoice reference.
    bill_match = re.search(
        r"(?:bill\s*(?:no|number)|invoice\s*(?:no|number)|inv\s*(?:no|number)|v\.?\s*r\.?\s*no|voucher\s*(?:no|number)|receipt\s*(?:no|number))\s*[:#.-]?\s*([A-Z0-9/-]{2,30})",
        joined,
        flags=re.IGNORECASE,
    )
    if bill_match:
        fields["billNo"] = bill_match.group(1).strip("- /")

    # Expense nature: explicit label first, then Payable A/c (common on
    # payment vouchers), then cautious keyword mapping from the particulars.
    nature = _extract_labeled_value(
        lines,
        [r"nature\s+of\s+expenses?", r"expense\s+type", r"expense\s+category", r"category"],
        stop_words=[r"amount", r"payee", r"date", r"bill"],
    )
    if not nature:
        nature = _extract_labeled_value(
            lines,
            [r"payable\s*a\s*/?\s*l?c", r"payable\s*account"],
            stop_words=[r"pay\s*to", r"particulars", r"amount"],
        )
    if not nature:
        lower_text = joined.lower()
        nature_keywords = [
            (r"transport|transportation|lorry|vehicle|loading|unloading|freight", "Transportation Charges"),
            (r"fuel|petrol|diesel", "Fuel Expenses"),
            (r"stationery|paper|printing|xerox", "Stationery / Printing"),
            (r"repair|maintenance|servicing", "Repair & Maintenance"),
            (r"food|meal|refreshment|tea", "Food / Refreshment"),
            (r"travel|hotel|lodging", "Travel Expenses"),
            (r"office expense|office expenses", "Office Expenses"),
        ]
        for pattern, label in nature_keywords:
            if re.search(pattern, lower_text, flags=re.IGNORECASE):
                nature = label
                break
    if nature and len(nature) <= 150 and len(re.findall(r"[A-Za-z\u0980-\u09FF]", nature)) >= 4 and not re.search(r"\d{3,}", nature):
        fields["natureOfExpense"] = nature

    # Payee is only read from the PAY TO area, not inferred from the company
    # header, to reduce the risk of filling the wrong person/vendor.
    payee = _extract_labeled_value(
        lines,
        [r"pay\s*to", r"paid\s*to", r"payee\s*name"],
        stop_words=[r"particulars", r"amount", r"date", r"cash", r"cheque", r"bank"],
    )
    if payee:
        payee = re.sub(r"\b(?:particulars|amount|rs\.?|p\.)\b.*$", "", payee, flags=re.IGNORECASE).strip()
        letter_count = len(re.findall(r"[A-Za-z\u0980-\u09FF]", payee))
        # Do not fill names from short, noisy handwriting fragments.
        if 4 <= letter_count <= 80 and not re.search(r"\d{2,}", payee) and 2 <= len(payee) <= 150:
            fields["payeeName"] = payee

    # Keep only the handwritten particulars area as the suggested remark.
    description_lines = []
    in_particulars = False
    for line in lines:
        lower = line.lower()
        if "particulars" in lower:
            in_particulars = True
            remainder = re.split(r"particulars", line, flags=re.IGNORECASE, maxsplit=1)[-1]
            remainder = re.sub(r"\b(?:amount|rs\.?|p\.)\b.*$", "", remainder, flags=re.IGNORECASE).strip(" :.-|")
            if remainder:
                description_lines.append(remainder)
            continue
        if in_particulars:
            if re.search(r"total\s*amount|payment\s+sum|prepared\s+by|checked\s+by|authori[sz]ed\s+by|g\s*[-/]?\s*pay|\bupi\b|transaction\s*(?:id|no)|\butr\b", lower):
                break
            cleaned = re.sub(r"\s+", " ", line).strip(" |.-")
            if cleaned and not re.fullmatch(r"(?:rs\.?|p\.?|amount|particulars)", cleaned, flags=re.IGNORECASE):
                description_lines.append(cleaned)

    description = " ".join(description_lines)
    description = re.sub(r"\s+", " ", description).strip()
    readable_description_terms = (
        "being", "transport", "charge", "hub", "unloading", "loading",
        "travel", "repair", "maintenance", "fuel", "diesel", "petrol",
        "stationery", "office", "food", "meal", "freight", "taxi",
        "vehicle", "lorry", "goods", "cartage", "delivery", "labour",
        "labor", "packing", "courier", "internet", "mobile", "telephone",
        "electricity", "water", "rent", "purchase", "service", "payment",
    )
    if description and any(term in description.lower() for term in readable_description_terms):
        fields["description"] = description[:2000]

    return fields


def extract_basic_fields(text, confidences=None, lines=None):
    clean_lines = lines or [line.strip() for line in (text or "").splitlines() if line.strip()]
    return _extract_fields(text or "", clean_lines, confidences or {})


def extract_text(image_path, lang="eng+ben"):
    if not os.path.exists(image_path):
        raise FileNotFoundError("Image file not found")

    # Expense payment vouchers are commonly landscape forms photographed
    # sideways. Rotate portrait captures once, then run Tesseract exactly once.
    with Image.open(image_path) as original:
        original = ImageOps.exif_transpose(original)
        width, height = original.size
        rotate_angle = 90 if height > width else 0
        oriented = original.rotate(rotate_angle, expand=True) if rotate_angle else original.copy()
        processed = preprocess_image(oriented)
        data = _ocr_words(processed, lang)
        text, lines, confidences = _data_to_text(data)

        confidence_values = list(confidences.values())
        confidence = (
            round(sum(confidence_values) / len(confidence_values), 2)
            if confidence_values
            else None
        )

        return {
            "text": text,
            "lines": lines,
            "confidence": confidence,
            "fields": extract_basic_fields(text, confidences, lines),
            "orientation": rotate_angle,
        }

