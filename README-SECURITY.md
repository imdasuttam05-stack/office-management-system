# Office Management System — Security-1

This package includes the security-hardened office management application and a separately deployed Python/Tesseract OCR service.

Main protections:
- Secure OTP hashing and attempt limits
- Short-lived JWT access tokens and rotating HttpOnly refresh tokens
- Exact CORS allowlist and Helmet security headers
- API, authentication and OCR rate limits
- Backend role-based authorization and expense ownership checks
- Soft delete, audit logging and duplicate override permission checks
- Node-proxied OCR (the browser never calls the Python service directly)
- OCR internal shared secret, image MIME and magic-byte validation
- 10 MB upload cap, OCR service health checks and actionable upstream error codes
- Memory-conscious Tesseract preprocessing
- Python OCR container runs as a non-root user

**Important:** OCR requires two Render services: the existing Node backend and a separate Docker web service deployed from the `python-ai` folder. Set the same `OCR_API_SECRET` in both services and set the Node service's `OCR_API_URL` to the Python service base URL. Follow `SECURITY-SETUP.md` before deployment.
