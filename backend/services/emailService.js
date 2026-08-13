import { Resend } from "resend";

export const sendOtpEmail = async (email, otp) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(apiKey);

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Office Management System <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject: "Your Office Management Login OTP",
    text:
      `Your login verification OTP is ${otp}. ` +
      "It expires in 5 minutes. " +
      "If you did not request this OTP, ignore this email.",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px">
        <h2>Office Management System</h2>
        <p>Your login verification OTP is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:20px;background:#f3f7fb;text-align:center;border-radius:8px">
          ${otp}
        </div>
        <p>This OTP expires in <b>5 minutes</b>.</p>
        <p>If you did not request this OTP, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend Email Error:", error.message);
    throw new Error("Failed to send OTP email.");
  }

  return data;
};
