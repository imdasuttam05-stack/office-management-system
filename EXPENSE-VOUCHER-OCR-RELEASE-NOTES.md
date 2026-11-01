# Expense Voucher OCR Update

- Uses the configured Python/Tesseract OCR service and compares common page orientations for sideways voucher photos.
- Maps detected date, total amount, expense nature, UPI/payment reference, payee, bill/voucher number, and particulars text into the existing Expense form where OCR confidence and labels support a safe extraction.
- Clears an unrecognized default-today date after scanning so a voucher cannot be saved with today's date by accident. The raw OCR text remains available for manual checking.
- Duplicate checks now include exact UPI reference, bill/invoice number with payee and amount, and similar payee + amount entries within a +/- 3 calendar-day window.
- Only Admin/Manager (or main admin) can approve a duplicate by choosing **Yes — Allow Entry**. Other users can choose **No — Do Not Save** and must contact an Admin/Manager for review.
- OCR output and handwritten values must still be reviewed before saving; unclear handwriting is left blank rather than guessed.

## Deployment

Deploy the updated Node backend and frontend from this ZIP. The existing Python OCR Render service should also be redeployed because `python-ai/ocr.py` changed. Keep `OCR_API_URL` on the Node backend and set the same `OCR_API_SECRET` on both services; keep `OCR_LANG=eng+ben` on the Python service.
