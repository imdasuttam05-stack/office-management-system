# Office Management System — Security-1

This package is the security-hardened version of the uploaded project.

Main protections:
- Secure OTP hashing and attempt limits
- Short-lived JWT access tokens
- Rotating HttpOnly refresh tokens
- Exact CORS allowlist
- Helmet security headers
- API and authentication rate limits
- Backend role-based authorization
- Expense ownership checks
- Soft delete and audit logging
- Duplicate override permission checks
- Node-proxied OCR
- OCR internal secret
- Image MIME and magic-byte validation
- Memory-conscious Tesseract preprocessing
- Non-root Python Docker container

See `SECURITY-SETUP.md` before deploying.
