import crypto from "crypto";

export function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

export function createOpaqueToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function createSessionId() {
  return crypto.randomUUID();
}

export function hashOtp(otp) {
  return sha256(otp);
}

export function safeEqualStrings(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

export function refreshCookieOptions() {
  const production = process.env.NODE_ENV === "production";
  const crossSite = String(process.env.COOKIE_CROSS_SITE || "false") === "true";

  return {
    httpOnly: true,
    secure: production || crossSite,
    sameSite: crossSite ? "none" : "lax",
    path: "/api/auth",
    maxAge:
      Number(process.env.REFRESH_TOKEN_DAYS || 7) *
      24 *
      60 *
      60 *
      1000,
  };
}

export function setRefreshCookie(res, token) {
  res.cookie("refresh_token", token, refreshCookieOptions());
}

export function clearRefreshCookie(res) {
  const options = refreshCookieOptions();
  delete options.maxAge;
  res.clearCookie("refresh_token", options);
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "";
}

export function isAllowedOrigin(req) {
  const origin = req.headers.origin;

  if (!origin) return true;

  const allowed = (process.env.CLIENT_URL || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return allowed.includes(origin);
}

export function sanitizeText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, maxLength)
    .trim();
}
