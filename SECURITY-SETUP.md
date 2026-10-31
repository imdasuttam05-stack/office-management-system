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
# Add these after the separate Python OCR service has been deployed.
# OCR_API_URL = Python OCR service base URL (not the Node backend URL)
# OCR_API_SECRET = exactly the same secret configured on the Python OCR service
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

## 4. Create and configure the separate Render Python OCR service

The Node backend does not run Tesseract itself. OCR uses a **separate Python web service** from the `python-ai` folder. Deploy it once on Render:

1. In Render, choose **New + → Web Service** and connect this same GitHub repository.
2. Set the service name to `office-management-python-ocr` (or another name you prefer).
3. Choose **Docker** as the runtime/environment.
4. Set **Root Directory** to `python-ai`.
5. Set the Dockerfile path to `Dockerfile` (relative to the `python-ai` root directory).
6. Set the health check path to `/health`.
7. Create the service and wait for its Docker deployment to finish.
8. In the Python OCR service's Environment settings, add:

```env
OCR_API_SECRET=THE_LONG_RANDOM_SECRET
OCR_LANG=eng+ben
```

Use the same long random secret in the Node backend service. Do not use the words shown above as the actual secret. The Python service installs both English and Bengali Tesseract language data in its Docker image.

After deployment, open the Python service URL followed by `/health`, for example:

```text
https://YOUR-PYTHON-OCR-SERVICE.onrender.com/health
```

It must return JSON with `"status": "healthy"` and the configured languages. If it returns `503` / `not_ready`, check the Python service's Render deploy/runtime logs, `OCR_API_SECRET`, and Tesseract language installation.

## 5. Configure the Render Node backend variables

In the existing Node backend service, set:

```env
OCR_API_URL=https://YOUR-PYTHON-OCR-SERVICE.onrender.com
OCR_API_SECRET=THE_EXACT_SAME_LONG_RANDOM_SECRET
```

`OCR_API_URL` must be the Python service's base URL. Do not put the Node API URL here. The updated backend accepts either the base URL or a URL ending in `/ocr`, but the base URL is recommended. `OCR_API_SECRET` must match the Python service value exactly.

Save the Environment changes and redeploy the Node backend. Do not add `OCR_API_SECRET` to Vercel or frontend code.

The Node service must also retain its existing application variables, including `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, and the other values required by this project.

## 6. Vercel variables

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

Do not set `VITE_PYTHON_API_URL`. The browser calls only the authenticated Node API; Node calls the private-by-secret Python OCR service.

## 7. Deployment and verification order

1. Deploy the Python OCR Render service using the `python-ai` root directory and Docker runtime.
2. Set `OCR_API_SECRET` and `OCR_LANG=eng+ben` on the Python OCR service.
3. Confirm `https://YOUR-PYTHON-OCR-SERVICE.onrender.com/health` returns `status: healthy`.
4. Copy the Python OCR service base URL into the Node service's `OCR_API_URL`.
5. Set exactly the same `OCR_API_SECRET` on Node and Python.
6. Redeploy the Node backend.
7. Log in to the web app, then open `https://office-management-system-ikx8.onrender.com/api/ocr/health` with the logged-in Bearer token. It should return HTTP 200 and `status: healthy`.
8. Test Upload/Scan from the Expense page.
9. Redeploy Vercel only if frontend source has changed.

### OCR error codes

The Node OCR endpoint now returns a specific `code` in its JSON response:

- `OCR_CONFIG_MISSING`: `OCR_API_URL` or `OCR_API_SECRET` is missing from the Node Render service.
- `OCR_URL_INVALID` / `OCR_URL_PATH_INVALID`: the configured Python OCR URL is invalid or points to a wrong path.
- `OCR_SECRET_MISMATCH`: Node and Python `OCR_API_SECRET` values do not match.
- `OCR_SERVICE_UNREACHABLE`: the Python OCR Render service is stopped, not deployed, or cannot be reached.
- `OCR_SERVICE_NOT_READY`: the Python service responds but Tesseract or its configured languages are not ready.
- `OCR_SERVICE_TIMEOUT`: OCR did not finish before the proxy timeout.

A ZIP/code update cannot set Render dashboard Environment variables. The two service URLs and matching secret must be set in Render as described above.

## 8. Security behavior

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
