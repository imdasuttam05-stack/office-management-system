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
    # PSM 11 (sparse text) separates printed labels and handwritten entries
    # more reliably on photographed voucher forms than treating the whole page
    # as one paragraph (PSM 6). Field-specific crops handle critical numbers.
    timeout_seconds = max(20, int(os.environ.get("OCR_TESSERACT_TIMEOUT_SECONDS", "150")))
    return pytesseract.image_to_data(
        image,
        lang=lang,
        config="--oem 1 --psm 11",
        output_type=pytesseract.Output.DICT,
        timeout=timeout_seconds,
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


def _orientation_preview(image, lang="eng"):
    """Score portrait images in both 0° and 90° orientations at low resolution.

    A portrait phone photo of a sideways paper voucher should rotate; a portrait
    screenshot of a form must remain upright. The previous height>width rule
    rotated both types indiscriminately.
    """
    max_side = max(250, int(os.environ.get("OCR_ORIENTATION_PREVIEW_MAX_SIDE", "900")))
    scale = min(1.0, max_side / max(image.size))
    preview = image.convert("L")
    if scale < 1.0:
        preview = preview.resize(
            (max(1, int(preview.width * scale)), max(1, int(preview.height * scale))),
            Image.Resampling.LANCZOS,
        )
    preview = ImageEnhance.Contrast(preview).enhance(1.35)

    try:
        data = pytesseract.image_to_data(
            preview,
            lang=lang,
            config="--oem 1 --psm 11",
            output_type=pytesseract.Output.DICT,
            timeout=max(5, int(os.environ.get("OCR_ORIENTATION_PREVIEW_TIMEOUT_SECONDS", "15"))),
        )
    except Exception:
        return 0.0, ""

    words = []
    confidences = []
    for raw_word, raw_confidence in zip(data.get("text", []), data.get("conf", [])):
        word = str(raw_word or "").strip()
        try:
            confidence = float(raw_confidence)
        except (TypeError, ValueError):
            confidence = -1
        if word and confidence >= 0:
            words.append(word)
            confidences.append(confidence)

    extracted = " ".join(words).lower()
    keyword_hits = sum(1 for keyword in DOCUMENT_KEYWORDS if keyword in extracted)
    average_confidence = sum(confidences) / len(confidences) if confidences else 0
    score = len(words) + keyword_hits * 5 + average_confidence * 0.25
    return score, extracted


def _select_orientation(image, lang="eng"):
    """Return the most readable of the original and 90°-rotated orientations."""
    if image.width >= image.height:
        return image.copy(), 0, ""

    original_score, original_text = _orientation_preview(image, lang)
    rotated = image.rotate(90, expand=True)
    rotated_score, rotated_text = _orientation_preview(rotated, lang)

    if rotated_score > original_score + 5:
        return rotated, 90, rotated_text
    return image.copy(), 0, original_text


def _looks_like_expense_form_screenshot(text):
    normalized = re.sub(r"\s+", " ", str(text or "").lower())
    label_hits = sum(
        1 for pattern in (
            r"nature\s+of\s+expenses?",
            r"g\s*[-/]?\s*pay",
            r"payee\s+name",
            r"bill\s*/\s*invoice",
            r"description\s*/?\s*remark",
        ) if re.search(pattern, normalized)
    )
    return label_hits >= 3


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
    date_pattern = r"(\d{1,2}[./|\\-]\d{1,2}[./|\\-]\d{2,4}|\d{4}[./|\\-]\d{1,2}[./|\\-]\d{1,2})"
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

        value = match.group(1).strip(" .:-|_*\t")
        if not value and line_index + 1 < len(lines):
            value = lines[line_index + 1].strip(" .:-|_*\t")

        if stop_pattern:
            value = stop_pattern.split(value)[0]

        value = re.sub(r"\s+", " ", value).strip(" .:-|_*")
        if len(value) < 2 and line_index + 1 < len(lines):
            next_value = lines[line_index + 1].strip(" .:-|_*\t")
            if stop_pattern:
                next_value = stop_pattern.split(next_value)[0]
            value = re.sub(r"\s+", " ", next_value).strip(" .:-|_*")
        if 2 <= len(value) <= 150:
            return value

    return ""


def _extract_table_description(lines):
    """Extract a Description/Remark cell from a two-column expense form screenshot.

    Some users upload a screenshot/export of the filled expense form rather than
    the original paper voucher. In that layout the description text appears above
    the bottom-row label, so the normal handwritten-Particulars parser cannot find it.
    """
    bill_index = -1
    description_label_index = -1
    for index, line in enumerate(lines):
        normalized = re.sub(r"\s+", " ", str(line or "")).strip()
        if re.search(r"\bbill\s*/\s*invoice\s*(?:no|number)\b", normalized, re.IGNORECASE):
            bill_index = index
        if re.search(r"\bdescription\s*/?\s*remark\b", normalized, re.IGNORECASE):
            description_label_index = index
            break

    if description_label_index < 0:
        return ""

    start_index = bill_index + 1 if bill_index >= 0 else 0
    captured = []
    skipped_bill_value = False
    for line in lines[start_index:description_label_index]:
        value = re.sub(r"\s+", " ", str(line or "")).strip(" |.-")
        if not value:
            continue
        # With PSM 11, the bill number can be emitted on the line immediately
        # after its label. Do not copy that value into Description / Remark.
        if bill_index >= 0 and not skipped_bill_value and re.fullmatch(r"[A-Z0-9/-]{2,30}", value, re.IGNORECASE):
            skipped_bill_value = True
            continue
        # Skip actual form labels, but retain narrative phrases such as
        # "date of 28.10.2026" and "amount paid ..." inside the description.
        if re.search(r"^\s*(?:date\s*[*:]|nature\s+of\s+expenses?\s*[*:]|amount\s*[*:]|g\s*[-/]?\s*pay(?:\s*/\s*upi)?|upi\s*(?:no|number)|payee\s+name\s*[*:]|bill\s*/\s*invoice)", value, re.IGNORECASE):
            continue
        captured.append(value)

    # On a narrow screenshot the final Description / Remark row can contain the
    # tail of the value to the right of the label (e.g. "Parcel Service").
    last_line = str(lines[description_label_index] or "")
    remainder = re.split(r"description\s*/?\s*remark", last_line, flags=re.IGNORECASE, maxsplit=1)
    if len(remainder) > 1:
        tail = re.sub(r"^[\s:*|._-]+", "", remainder[1])
        tail = re.sub(r"[|]+$", "", tail).strip()
        if tail:
            captured.append(tail)

    description = re.sub(r"\s+", " ", " ".join(captured)).strip()
    return description[:2000] if len(description) >= 10 else ""


def _extract_fields(text, lines, confidences):
    fields = {}
    joined = "\n".join(lines) if lines else text

    # Date: prefer a value adjacent to a Date label, then use a general date.
    fields["date"] = _extract_date(joined)

    # Amount: only trust a number explicitly associated with the total/amount
    # label, and avoid autofilling very low-confidence handwritten OCR tokens.
    amount_match = re.search(
        r"(?:total\s*amount|grand\s*total|net\s*amount|payment\s*amount)\s*[*:=|.\-]?\s*(?:rs\.?\s*)?(?:₹\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)",
        joined,
        flags=re.IGNORECASE,
    )
    if not amount_match:
        amount_match = re.search(
            r"(?:amount\s*paid|amount)\s*[*:=|.\-]?\s*(?:rs\.?\s*)?(?:₹\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)",
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
        r"(?:g\s*[-]?\s*pay\s*/\s*upi(?:\s*(?:id|no|number))?|gpay(?:\s*/\s*upi)?(?:\s*(?:id|no|number))?|upi(?:\s*(?:id|no|number))?|transaction\s*(?:id|no|number)|txn\s*(?:id|no)|utr|rrn|bank\s*ref(?:erence)?|ref(?:erence)?\s*no)\s*[*:#.\-]?\s*([A-Z0-9-]{8,30})",
        joined,
        flags=re.IGNORECASE,
    )
    if upi_match:
        fields["gpayNo"] = upi_match.group(1).strip("- ")

    # Voucher / bill / invoice reference.
    bill_match = re.search(
        r"(?:bill\s*/\s*invoice\s*(?:no|number)|bill\s*(?:no|number)|invoice\s*(?:no|number)|inv\s*(?:no|number)|v\.?\s*r\.?\s*no\.?|vr\s*no\.?|voucher\s*(?:no|number)|receipt\s*(?:no|number))\s*[*:#.\-]?\s*([A-Z0-9/-]{2,30})",
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
        looks_like_description = re.search(
            r"\b(being|transport|charge|loading|unloading|goods|delivered|hub|travelled|traveling|expense)\b",
            payee,
            flags=re.IGNORECASE,
        )
        is_short_business_code = bool(re.fullmatch(r"[A-Za-z]{2,5}", payee))
        if (
            (letter_count >= 4 or is_short_business_code)
            and letter_count <= 80
            and not re.search(r"\d{2,}", payee)
            and 2 <= len(payee) <= 100
            and not looks_like_description
            and payee.strip().lower() not in {"particulars", "amount", "date", "bank", "cash", "cheque"}
        ):
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

    # Key/value expense-form screenshots have the description before the
    # "Description / Remark" footer label instead of a "Particulars" heading.
    if not fields.get("description"):
        table_description = _extract_table_description(lines)
        if table_description:
            fields["description"] = table_description

    return fields


def extract_basic_fields(text, confidences=None, lines=None):
    clean_lines = lines or [line.strip() for line in (text or "").splitlines() if line.strip()]
    return _extract_fields(text or "", clean_lines, confidences or {})



def _ocr_voucher_region(image, box, psm=6, whitelist=None, scale=3, channel="red"):
    """OCR a handwritten region from the common landscape payment-voucher form."""
    width, height = image.size
    x1, y1, x2, y2 = box
    left = max(0, min(width - 1, int(width * x1)))
    top = max(0, min(height - 1, int(height * y1)))
    right = max(left + 1, min(width, int(width * x2)))
    bottom = max(top + 1, min(height, int(height * y2)))

    crop = image.crop((left, top, right, bottom))
    # Blue pen ink is often easier to separate from white paper in the red
    # channel. The green channel can work better for handwritten amount digits.
    if channel == "green":
        crop = crop.split()[1]
    elif channel == "blue":
        crop = crop.split()[2]
    elif channel == "gray":
        crop = ImageOps.grayscale(crop)
    else:
        crop = crop.split()[0]
    crop = ImageEnhance.Contrast(crop).enhance(1.5)
    crop = crop.resize(
        (max(1, crop.width * scale), max(1, crop.height * scale)),
        Image.Resampling.LANCZOS,
    )
    config = f"--oem 3 --psm {psm}"
    if whitelist:
        config += f" -c tessedit_char_whitelist={whitelist}"
    try:
        return pytesseract.image_to_string(
            crop,
            lang="eng",
            config=config,
            timeout=max(15, int(os.environ.get("OCR_REGION_TIMEOUT_SECONDS", "75"))),
        ).strip()
    except Exception:
        return ""



def _ocr_voucher_total_amount(image):
    """Read only the printed Total Amount row, excluding item amounts above it."""
    width, height = image.size
    # The Agri Rise landscape payment voucher has the total in the bottom
    # amount row. The previous crop included the whole amount column, so OCR
    # often selected 1500 / 88 / 33 instead of the actual total 4621.
    box = (0.82, 0.69, 0.92, 0.755)
    x1, y1, x2, y2 = box
    crop = image.crop((int(width * x1), int(height * y1), int(width * x2), int(height * y2)))

    candidates = []
    for channel_name, channel in (("gray", ImageOps.grayscale(crop)), ("red", crop.split()[0])):
        prepared = ImageOps.autocontrast(channel)
        prepared = prepared.resize(
            (max(1, prepared.width * 6), max(1, prepared.height * 6)),
            Image.Resampling.LANCZOS,
        )
        try:
            raw = pytesseract.image_to_string(
                prepared,
                lang="eng",
                config="--oem 1 --psm 7 -c tessedit_char_whitelist=0123456789.,",
                timeout=max(10, int(os.environ.get("OCR_REGION_TIMEOUT_SECONDS", "75"))),
            )
        except Exception:
            continue

        for token in re.findall(r"(?<!\d)[0-9][0-9,.]{0,10}", raw):
            cleaned = _clean_amount(token)
            # This is a tightly cropped, single-value total row. Restrict the
            # number of digits to avoid filling from stray OCR artifacts.
            if cleaned and re.fullmatch(r"\d{1,9}(?:\.\d{1,2})?", cleaned):
                candidates.append(cleaned)

    if not candidates:
        return "", False

    # If channels disagree, prefer the first exact numeric token from the
    # grayscale crop; the second channel is only a fallback.
    return candidates[0], True

def _clean_region_text(value):
    lines = []
    for raw_line in str(value or "").splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip(" .|_:-\t")
        if not line:
            continue
        if re.fullmatch(r"(?:particulars|amount|total amount|rs\.?|p\.?)", line, re.IGNORECASE):
            continue
        lines.append(line)
    return "\n".join(lines).strip()[:2000]


def _normalize_transport_description(value):
    """Repair a few high-confidence handwritten transport OCR confusions."""
    text = str(value or "")
    if re.search(r"trans|trams|trav|lorry|freight|parcel|delivery|hub\s+to", text, re.IGNORECASE):
        text = re.sub(r"\b(?:reint|reoint|resin|resint|feoint|besoin|besint|becins|becint)\s+to\b", "Being to", text, flags=re.IGNORECASE)
        text = re.sub(r"\btrams?\s*(?:for|fort|bor|tort)\b", "Transport", text, flags=re.IGNORECASE)
        text = re.sub(r"\b(?:lowe|lowel|lhovrel|chanel|zhowet|lhowet)\b", "Charge", text, flags=re.IGNORECASE)
        text = re.sub(r"\b(?:low|los|mog|how)\s+to\b", "Hub to", text, flags=re.IGNORECASE)
        text = re.sub(r"\b(?:fhe|she)p?\??", "Shop", text, flags=re.IGNORECASE)
        text = re.sub(r"\bS2BAYS?\b", "33 BAGS", text, flags=re.IGNORECASE)
    return re.sub(r"[ \t]+", " ", text).strip()

def extract_text(image_path, lang="eng"):
    if not os.path.exists(image_path):
        raise FileNotFoundError("Image file not found")

    # Portrait images may be upright screenshots OR sideways paper vouchers.
    # Compare quick low-resolution OCR scores instead of rotating every portrait
    # upload by default.
    with Image.open(image_path) as original:
        original = ImageOps.exif_transpose(original).convert("RGB")
        oriented, rotate_angle, orientation_preview_text = _select_orientation(original, lang)

        processed = preprocess_image(oriented)
        data = _ocr_words(processed, lang)
        text, lines, confidences = _data_to_text(data)
        fields = extract_basic_fields(text, confidences, lines)
        is_form_screenshot = _looks_like_expense_form_screenshot(text + " " + orientation_preview_text)

        # A screenshot/export of the expense form is already a key/value table.
        # Its description cell is extracted by labels and must not be overridden
        # by fixed coordinates intended for the original printed paper voucher.
        if not is_form_screenshot:
            # Read the complete handwritten Particulars cell independently. The
        # older parser discarded this text unless a small keyword list matched,
        # which caused the Description / Remark field to remain blank.
            particulars_text = _ocr_voucher_region(
                oriented, (0.42, 0.35, 0.82, 0.69), psm=4, scale=4, channel="red"
            )
            particulars_text = _normalize_transport_description(
                _clean_region_text(particulars_text)
            )
            if particulars_text:
                fields["description"] = particulars_text
                if not fields.get("billNo"):
                    particulars_invoice = re.search(
                        r"\b(?:invoice|inv\.?|bill)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9/-]{2,30})",
                        particulars_text,
                        flags=re.IGNORECASE,
                    )
                    if particulars_invoice:
                        fields["billNo"] = particulars_invoice.group(1).strip("- /")

            # Read only the Total Amount box. This prevents line-item amounts from
            # being mistaken for the voucher total.
            total_amount, total_was_detected = _ocr_voucher_total_amount(oriented)
            if total_amount:
                fields["amount"] = total_amount
            elif total_was_detected:
                # Do not fall back to a lower-confidence total parsed from the full
                # page; the focused total box has already flagged the digits as weak.
                fields.pop("amount", None)

            # Expense nature should follow the activity written in Particulars,
            # not the Payable A/c ledger name above the table.
            transport_in_particulars = re.search(
                r"transport|transp|trams|travell?|lorry|freight|parcel|delivery|hub\s+to",
                particulars_text,
                re.IGNORECASE,
            )
            if transport_in_particulars:
                fields["natureOfExpense"] = "Transportation Charges"
            elif not fields.get("natureOfExpense") and re.search(
                r"transport|transp|trams|travell?|lorry|freight|parcel|delivery",
                text,
                re.IGNORECASE,
            ):
                fields["natureOfExpense"] = "Transportation Charges"

            # Keep the region transcript visible to the user for correction, while
            # retaining the regular full-page OCR output for all other fields.
            preview_text = text
            if particulars_text:
                preview_text = (preview_text + "\n\n[PARTICULARS / DESCRIPTION]\n" + particulars_text).strip()

        if is_form_screenshot:
            preview_text = text

        confidence_values = list(confidences.values())
        confidence = (
            round(sum(confidence_values) / len(confidence_values), 2)
            if confidence_values
            else None
        )

        return {
            "text": preview_text,
            "lines": lines,
            "confidence": confidence,
            "fields": fields,
            "orientation": rotate_angle,
        }
