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

  // ==============================
  // SEND OTP
  // ==============================
  const sendOtp = async (e) => {
    if (e) {
      e.preventDefault();
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      console.log("SEND OTP:", email);

      const response = await axios.post(
        `${API_URL}/api/auth/send-otp`,
        {
          email: email.trim().toLowerCase(),
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("SEND OTP RESPONSE:", response.data);

      if (response.data?.success) {
        setOtpSent(true);
        setMessage(
          "OTP sent successfully. Please check your email."
        );
      } else {
        setError(
          response.data?.message ||
            "Unable to send OTP."
        );
      }
    } catch (err) {
      console.error("SEND OTP ERROR:", err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to send OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // VERIFY OTP
  // ==============================
  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    console.log("================================");
    console.log("VERIFY BUTTON CLICKED");
    console.log("EMAIL:", email);
    console.log("OTP:", otp);
    console.log("API:", `${API_URL}/api/auth/verify-otp`);
    console.log("================================");

    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("Verifying OTP...");

      const response = await axios.post(
        `${API_URL}/api/auth/verify-otp`,
        {
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "VERIFY OTP RESPONSE:",
        response.data
      );

      if (response.data?.success) {
        // Save JWT
        if (response.data.token) {
          localStorage.setItem(
            "token",
            response.data.token
          );
        }

        // Save user
        if (response.data.user) {
          localStorage.setItem(
            "user",
            JSON.stringify(response.data.user)
          );
        }

        setMessage("Login successful.");

        console.log(
          "LOGIN SUCCESS - REDIRECTING TO DASHBOARD"
        );

        navigate("/dashboard");
      } else {
        setError(
          response.data?.message ||
            "OTP verification failed."
        );
      }
    } catch (err) {
      console.error(
        "VERIFY OTP ERROR:",
        err
      );

      console.error(
        "VERIFY OTP RESPONSE:",
        err.response?.data
      );

      setError(
        err.response?.data?.message ||
          err.message ||
          "Invalid OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // CHANGE EMAIL
  // ==============================
  const changeEmail = () => {
    setOtpSent(false);
    setOtp("");
    setMessage("");
    setError("");
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
          <form onSubmit={sendOtp}>

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
              autoComplete="email"
            />

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Sending..."
                : "Send OTP"}
            </button>

          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>

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
              autoComplete="one-time-code"
              onChange={(e) => {
                const value =
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6);

                setOtp(value);
              }}
            />

            <button
              type="submit"
              disabled={
                loading ||
                otp.length !== 6
              }
            >
              {loading
                ? "Verifying..."
                : "Verify OTP"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={changeEmail}
              disabled={loading}
            >
              Change Email
            </button>

          </form>
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
