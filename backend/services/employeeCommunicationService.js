import { Resend } from "resend";

export async function sendEmployeeEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  if (!to) throw new Error("Employee email address is missing.");

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || "Office Management System <onboarding@resend.dev>";
  const { data, error } = await resend.emails.send({ from, to: [to], subject, html, text: text || "" });
  if (error) {
    console.error("Employee email error:", error.message);
    throw new Error(error.message || "Failed to send employee email.");
  }
  return data;
}
