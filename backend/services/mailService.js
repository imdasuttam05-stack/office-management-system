import nodemailer from "nodemailer";
import { Resend } from "resend";

function clean(value) {
  return String(value ?? "").trim();
}

function smtpConfigured() {
  return Boolean(
    clean(process.env.SMTP_HOST) &&
      clean(process.env.SMTP_USER) &&
      clean(process.env.SMTP_PASS)
  );
}

function mailProvider() {
  const explicit = clean(process.env.MAIL_PROVIDER || process.env.EMAIL_PROVIDER).toLowerCase();
  if (explicit) return explicit;
  return smtpConfigured() ? "smtp" : "resend";
}

function createSmtpTransport() {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? (port === 465)).toLowerCase() === "true";

  return nodemailer.createTransport({
    host: clean(process.env.SMTP_HOST),
    port,
    secure,
    auth: {
      user: clean(process.env.SMTP_USER),
      pass: clean(process.env.SMTP_PASS),
    },
    tls: {
      rejectUnauthorized:
        String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED ?? "true").toLowerCase() !== "false",
    },
  });
}

function smtpFrom() {
  return (
    clean(process.env.SMTP_FROM) ||
    `${clean(process.env.SMTP_FROM_NAME || "Office Management System")} <${clean(process.env.SMTP_USER)}>`
  );
}

function normalizeMailError(error, provider = "email") {
  const code = clean(error?.code || error?.responseCode || "").toUpperCase();
  const response = clean(error?.response || "");
  const message = clean(error?.message || error || "Unknown email error");

  if (code === "EAUTH" || code === "AUTH" || /authentication failed|invalid.*(password|credentials)|username.*password/i.test(message)) {
    const e = new Error(
      "SMTP authentication failed. Check SMTP_USER and SMTP_PASS. For Gmail, SMTP_PASS must be a 16-character Google App Password, not your normal Gmail password."
    );
    e.code = "SMTP_AUTH_FAILED";
    return e;
  }
  if (code === "ENOTFOUND") {
    const e = new Error(`SMTP host not found: ${clean(process.env.SMTP_HOST)}. Check SMTP_HOST.`);
    e.code = "SMTP_HOST_NOT_FOUND";
    return e;
  }
  if (code === "ECONNREFUSED") {
    const e = new Error(`SMTP connection refused by ${clean(process.env.SMTP_HOST)}:${clean(process.env.SMTP_PORT || "465")}. Check SMTP_PORT/SMTP_SECURE.`);
    e.code = "SMTP_CONNECTION_REFUSED";
    return e;
  }
  if (code === "ETIMEDOUT" || /timeout/i.test(message)) {
    const e = new Error(`SMTP connection timed out to ${clean(process.env.SMTP_HOST)}:${clean(process.env.SMTP_PORT || "465")}. Check SMTP_HOST, SMTP_PORT and Render network settings.`);
    e.code = "SMTP_TIMEOUT";
    return e;
  }
  if (code === "EENVELOPE" || /recipient|address.*rejected|mailbox.*unavailable/i.test(message)) {
    const e = new Error(`Email recipient was rejected: ${response || message}`);
    e.code = "SMTP_RECIPIENT_REJECTED";
    return e;
  }
  if (code === "EMESSAGE" || /from.*rejected|sender.*rejected/i.test(message)) {
    const e = new Error(`SMTP sender was rejected. Check SMTP_FROM. Details: ${message}`);
    e.code = "SMTP_SENDER_REJECTED";
    return e;
  }

  const e = new Error(`${provider.toUpperCase()} email failed: ${response ? `${message} (${response})` : message}`);
  e.code = code || "EMAIL_SEND_FAILED";
  return e;
}

async function sendViaSmtp({ to, subject, html, text, attachments }) {
  if (!smtpConfigured()) {
    const e = new Error(
      "SMTP is not configured. Add MAIL_PROVIDER=smtp and set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS and SMTP_FROM in Render."
    );
    e.code = "SMTP_NOT_CONFIGURED";
    throw e;
  }

  const transporter = createSmtpTransport();
  try {
    // Verify SMTP authentication/connection first, so a clear failure reason
    // can be returned to the app instead of a generic send error.
    await transporter.verify();

    const info = await transporter.sendMail({
      from: smtpFrom(),
      to,
      subject,
      html,
      text: text || "",
      attachments: attachments || [],
    });

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (!accepted.length && rejected.length) {
      const e = new Error(`SMTP rejected recipient(s): ${rejected.join(", ")}`);
      e.code = "SMTP_RECIPIENT_REJECTED";
      throw e;
    }

    return { provider: "smtp", messageId: info.messageId, accepted, rejected };
  } catch (error) {
    throw normalizeMailError(error, "smtp");
  } finally {
    try { transporter.close(); } catch (_) {}
  }
}

async function sendViaResend({ to, subject, html, text, attachments }) {
  const apiKey = clean(process.env.RESEND_API_KEY);
  if (!apiKey) {
    throw new Error(
      "Neither SMTP nor Resend is configured. Set SMTP_* variables for SMTP or RESEND_API_KEY/RESEND_FROM_EMAIL for Resend."
    );
  }

  const resend = new Resend(apiKey);
  const from =
    clean(process.env.RESEND_FROM_EMAIL) ||
    "Office Management System <onboarding@resend.dev>";

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: text || "",
  };

  // Resend may be used later once a domain is verified. Keep attachments
  // supported without making them mandatory for the current SMTP flow.
  if (Array.isArray(attachments) && attachments.length) {
    payload.attachments = attachments;
  }

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(error.message || "Failed to send email through Resend.");
  }

  return { provider: "resend", ...(data || {}) };
}

export async function sendMail({ to, subject, html, text = "", attachments = [] }) {
  const recipient = Array.isArray(to) ? to : [to];
  if (!recipient.some((item) => clean(item))) {
    throw new Error("Email recipient is missing.");
  }

  const provider = mailProvider();

  if (provider === "smtp" || provider === "smtp-gmail" || provider === "gmail") {
    return sendViaSmtp({ to: recipient, subject, html, text, attachments });
  }

  if (provider === "resend") {
    return sendViaResend({ to: recipient, subject, html, text, attachments });
  }

  throw new Error(
    `Unsupported MAIL_PROVIDER "${provider}". Use "smtp" or "resend".`
  );
}

export function getConfiguredMailProvider() {
  return mailProvider();
}
