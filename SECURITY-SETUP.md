# Security-1 Deployment Setup

This version changes the authentication and OCR architecture to:

React/Vercel
→ Node/Render API
→ MongoDB Atlas

and:

React
→ Node `/api/ocr`
→ authenticated Python OCR service
→ Tesseract

## 1. GitHub

Keep the repository private.

Never commit:
- `.env`
- MongoDB URI/password
- JWT secret
- Resend API key
- OCR API secret

If any secret was previously committed, rotate it before production deployment.

## 2. Render Node backend variables

Set these in the Node backend service:

```env
NODE_ENV=production
MONGODB_URI=YOUR_MONGODB_URI
JWT_SECRET=LONG_RANDOM_SECRET
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=7
CLIENT_URL=https://office-management-system-lilac.vercel.app
RESEND_API_KEY=YOUR_RESEND_KEY
RESEND_FROM_EMAIL=Office Management System <your-verified-sender@example.com>
BOOTSTRAP_ADMIN_EMAIL=your-admin-email@example.com
ALLOWED_LOGIN_EMAILS=
AUTO_REGISTER_EMPLOYEES=false
OCR_API_URL=https://YOUR-PYTHON-OCR-SERVICE.onrender.com
OCR_API_SECRET=ANOTHER_LONG_RANDOM_SECRET
```

Generate a JWT secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Generate an OCR secret similarly:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Existing users

Existing MongoDB users can continue to login if `isActive=true`.

New users are NOT automatically created unless:
- the email is `BOOTSTRAP_ADMIN_EMAIL`, or
- it is listed in `ALLOWED_LOGIN_EMAILS`, or
- `AUTO_REGISTER_EMPLOYEES=true` is explicitly enabled.

The bootstrap email becomes `Admin` only when a new account is created.

Do not enable automatic employee registration for a sensitive production office system unless you intentionally want public registration.

## 4. Render Python OCR variables

Set:

```env
OCR_API_SECRET=THE_SAME_SECRET_AS_NODE
OCR_LANG=eng+ben
```

The Python service should not receive MongoDB or JWT secrets.

## 5. Vercel variables

Set only:

```env
VITE_API_URL=https://office-management-system-ikx8.onrender.com
```

Do NOT put:
- MONGODB_URI
- JWT_SECRET
- OCR_API_SECRET
- RESEND_API_KEY

in Vercel.

Do not set `VITE_PYTHON_API_URL`. The browser no longer calls Python directly.

## 6. Important deployment order

1. Deploy Python OCR on Render.
2. Copy its Render URL into Node's `OCR_API_URL`.
3. Set the same `OCR_API_SECRET` on Node and Python.
4. Deploy Node backend.
5. Set Vercel `VITE_API_URL` to the Node backend URL.
6. Deploy Vercel.
7. Test login.
8. Test expense create.
9. Test duplicate detection.
10. Test Manager/Admin approve/reject.
11. Test Admin-only delete.
12. Test Upload/Scan.

## 7. Security behavior

- OTP is hashed in MongoDB.
- OTP is never logged.
- OTP expires after 5 minutes.
- Maximum 5 OTP verification attempts.
- OTP resend cooldown is 60 seconds.
- Login/OTP endpoints are rate-limited.
- Access JWT is short-lived.
- Refresh token is HttpOnly and rotated.
- Inactive users cannot login.
- Employee sees only their own expenses.
- Manager/Admin can manage approval workflow.
- Only Admin can delete, and deletion is soft-delete.
- Duplicate override is restricted to Manager/Admin.
- OCR requires authenticated Node access plus an internal secret.
- OCR validates file type and image magic bytes.
- Python OCR never returns internal exception details.
- OCR image dimensions are capped to reduce memory abuse.
- Python container runs as a non-root user.
