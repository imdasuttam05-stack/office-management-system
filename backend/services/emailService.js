import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOtpEmail = async (email, otp) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { data, error } = await resend.emails.send({
    from: "Office Management System <onboarding@resend.dev>",
    to: [email],
    subject: "Your Office Management Login OTP",

    text: `Your OTP is ${otp}. This OTP will expire in 5 minutes.`,

    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Office Management System</h2>

        <p>Your login verification OTP is:</p>

        <div style="
          font-size:32px;
          font-weight:bold;
          letter-spacing:8px;
          padding:20px;
          background:#f3f7fb;
          text-align:center;
        ">
          ${otp}
        </div>

        <p>This OTP will expire in <b>5 minutes</b>.</p>

        <p>If you did not request this OTP, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend Email Error:", error);
    throw new Error(error.message || "Failed to send email");
  }

  console.log("OTP email sent:", data?.id);
};
