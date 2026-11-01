# Expense OCR timeout fix

## Updated files
- `backend/controllers/ocrController.js`
- `frontend/src/pages/Expense.jsx`
- `python-ai/app.py`
- `python-ai/ocr.py`
- `python-ai/Dockerfile`

## Changes
- Set `OMP_THREAD_LIMIT=1` in the OCR Docker service. This prevents Tesseract from oversubscribing CPU threads on small Render instances.
- Added bounded Tesseract subprocess timeouts to the full-page OCR and both focused voucher-region OCR passes.
- Increased Node-to-Python OCR request timeout to 180 seconds; health checks use a separate 90-second timeout.
- Forwarded upstream Tesseract timeout as a clear HTTP 504 response.
- Expense scan checks `/api/ocr/health` first to wake a sleeping OCR service before uploading the image.
- Large camera photos are resized to a maximum 2000px side and JPEG quality 86 only when they exceed 2000px or 6 MB. Smaller voucher images remain unchanged.
- Scan button displays connection, preparation, and reading stages.

## Render deployment
Redeploy all three services because code changed in each layer:
1. `office-management-ocr` (Dockerfile, Flask, Tesseract changes)
2. `office-management-system` Node backend (proxy timeout and 504 mapping)
3. Vercel frontend (health warm-up and large image compression)

No new environment variables are required. Keep `OCR_API_URL` and identical `OCR_API_SECRET` values on the Node and Python services.
