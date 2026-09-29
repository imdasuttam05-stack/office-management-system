import { sendMail } from "./mailService.js";

export async function sendEmployeeEmail({ to, subject, html, text, attachments = [] }) {
  if (!to) throw new Error("Employee email address is missing.");

  return sendMail({
    to,
    subject,
    html,
    text,
    attachments,
  });
}
