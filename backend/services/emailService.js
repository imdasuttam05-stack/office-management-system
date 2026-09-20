import { sendMail } from "./mailService.js";

export const sendOtpEmail = async (email, otp) => {
  const safeOtp = String(otp || "").trim();

  return sendMail({
    to: email,
    subject: "Your Office Management Login OTP",
    text:
      `Your login verification OTP is ${safeOtp}. ` +
      "It expires in 5 minutes. " +
      "If you did not request this OTP, ignore this email.",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px;color:#172033">
        <h2 style="margin-top:0">Office Management System</h2>
        <p>Your login verification OTP is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:20px;background:#f3f7fb;text-align:center;border-radius:8px">
          ${safeOtp}
        </div>
        <p>This OTP expires in <b>5 minutes</b>.</p>
        <p>If you did not request this OTP, you can safely ignore this email.</p>
      </div>
    `,
  });
};
