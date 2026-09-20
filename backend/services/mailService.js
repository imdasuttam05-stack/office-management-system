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

async function sendViaSmtp({ to, subject, html, text, attachments }) {
  if (!smtpConfigured()) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER and SMTP_PASS in Render."
    );
  }

  const transporter = createSmtpTransport();
  const info = await transporter.sendMail({
    from: smtpFrom(),
    to,
    subject,
    html,
    text: text || "",
    attachments: attachments || [],
  });

  return {
    provider: "smtp",
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
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
