import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOtpEmail = async (email, otp) => {
  await transporter.sendMail({
    from: `"Office Management System" <${process.env.EMAIL_USER}>`,

    to: email,

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
};
