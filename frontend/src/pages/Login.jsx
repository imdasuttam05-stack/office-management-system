import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sendOtp = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await axios.post(
        `${API_URL}/api/auth/send-otp`,
        {
          email: email.trim(),
        }
      );

      if (response.data.success) {
        setOtpSent(true);
        setMessage(
          "OTP sent successfully. Please check your email."
        );
      }
    } catch (error) {
      console.error("OTP Error:", error);

      setError(
        error.response?.data?.message ||
          "Unable to send OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      console.log("Verifying OTP:", email);

      const response = await axios.post(
        `${API_URL}/api/auth/verify-otp`,
        {
          email: email.trim(),
          otp: otp.trim(),
        }
      );

      console.log("Verify OTP Response:", response.data);

      if (response.data.success) {
        if (response.data.token) {
          localStorage.setItem(
            "token",
            response.data.token
          );
        }

        if (response.data.user) {
          localStorage.setItem(
            "user",
            JSON.stringify(response.data.user)
          );
        }

        setMessage("Login successful.");

        // Dashboard page
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Verify OTP Error:", error);

      setError(
        error.response?.data?.message ||
          "Invalid OTP. Please try again."
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
            <label htmlFor="email">
              Email Address
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
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
            <label htmlFor="otp">
              Enter OTP
            </label>

            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6 digit OTP"
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value.replace(/\D/g, "")
                )
              }
            />

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
                setMessage("");
                setError("");
              }}
              disabled={loading}
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

        {error && (
          <p
            className="login-message"
            style={{
              color: "#b42318",
              background: "#fef3f2",
            }}
          >
            {error}
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
