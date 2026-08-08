import { useState } from "react";
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";

function Login() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const sendOtp = async () => {
    if (!email.trim()) {
      setMessage("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const response = await axios.post(
        `${API_URL}/api/auth/send-otp`,
        {
          email: email.trim(),
        }
      );

      if (response.data.success) {
        setOtpSent(true);
        setMessage("OTP sent successfully. Please check your email.");
      }
    } catch (error) {
      console.error(error);

      setMessage(
        error.response?.data?.message ||
          "Unable to send OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-logo">
          OM
        </div>

        <h1>Office Management</h1>

        <p className="subtitle">
          Secure business management system
        </p>

        {!otpSent ? (
          <>
            <label>Email Address</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              onClick={sendOtp}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <label>Enter OTP</label>

            <input
              type="text"
              maxLength="6"
              placeholder="Enter 6 digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />

            <button>
              Verify OTP
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
                setMessage("");
              }}
            >
              Change Email
            </button>
          </>
        )}

        {message && (
          <p className="login-message">
            {message}
          </p>
        )}

        <div className="login-footer">
          Secure • Cloud Based • Professional
        </div>

      </div>
    </div>
  );
}

export default Login;
