const RESEND_API_URL = "https://api.resend.com/emails";

export const sendOtpEmail = async (email, otp) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },

    body: JSON.stringify({
      from: "Office Management System <onboarding@resend.dev>",
      to: [email],
      subject: "Your Office Management Login OTP",

      text: `Your Office Management System login OTP is ${otp}. This OTP will expire in 5 minutes.`,

      html: `
        <div style="
          font-family:Arial,sans-serif;
          max-width:600px;
          margin:auto;
          padding:30px;
          border:1px solid #e5e7eb;
          border-radius:12px;
        ">

          <h2>Office Management System</h2>

          <p>Your login verification OTP is:</p>

          <div style="
            font-size:32px;
            font-weight:bold;
            letter-spacing:8px;
            padding:20px;
            background:#f3f7fb;
            text-align:center;
            border-radius:8px;
          ">
            ${otp}
          </div>

          <p>
            This OTP will expire in <b>5 minutes</b>.
          </p>

          <p>
            If you did not request this OTP, you can safely ignore this email.
          </p>

        </div>
      `,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Resend API Error:", data);

    throw new Error(
      data?.message || "Failed to send OTP email"
    );
  }

  console.log("OTP email sent:", data);

  return data;
};
