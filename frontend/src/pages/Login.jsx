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

  // =========================
  // SEND OTP
  // =========================
  const sendOtp = async (e) => {
    if (e) e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      console.log("Sending OTP to:", email.trim());

      const response = await axios.post(
        `${API_URL}/api/auth/send-otp`,
        {
          email: email.trim(),
        },
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Send OTP Response:", response.data);

      if (response.data?.success === true) {
        setOtpSent(true);
        setOtp("");

        setMessage(
          "OTP sent successfully. Please check your email."
        );
      } else {
        setError(
          response.data?.message ||
            "OTP could not be sent."
        );
      }
    } catch (err) {
      console.error("SEND OTP ERROR:", err);

      console.error(
        "Server Response:",
        err.response?.data
      );

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to send OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // VERIFY OTP
  // =========================
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();

    console.log("VERIFY BUTTON CLICKED");

    setError("");
    setMessage("");

    // Check OTP
    if (!otp.trim()) {
      setError("Please enter the OTP.");
      return;
    }

    if (otp.trim().length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    // Check email
    if (!email.trim()) {
      setError("Email address is missing.");
      return;
    }

    try {
      setLoading(true);

      console.log("================================");
      console.log("VERIFY OTP START");
      console.log("API URL:", API_URL);
      console.log("Email:", email.trim());
      console.log("OTP:", otp.trim());
      console.log("================================");

      const response = await axios.post(
        `${API_URL}/api/auth/verify-otp`,
        {
          email: email.trim(),
          otp: otp.trim(),
        },
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "VERIFY OTP HTTP STATUS:",
        response.status
      );

      console.log(
        "VERIFY OTP RESPONSE:",
        response.data
      );

      // =========================
      // SUCCESS
      // =========================
      if (response.data?.success === true) {
        console.log("OTP VERIFIED SUCCESSFULLY");

        // Save JWT token
        if (response.data.token) {
          localStorage.setItem(
            "token",
            response.data.token
          );

          console.log("JWT token saved.");
        }

        // Save user
        if (response.data.user) {
          localStorage.setItem(
            "user",
            JSON.stringify(response.data.user)
          );

          console.log("User saved.");
        }

        setMessage("Login successful.");

        // Dashboard
        setTimeout(() => {
          navigate("/dashboard");
        }, 500);

        return;
      }

      // =========================
      // SUCCESS FALSE
      // =========================
      setError(
        response.data?.message ||
          "OTP verification failed."
      );
    } catch (err) {
      console.error(
        "================================"
      );

      console.error(
        "VERIFY OTP ERROR:",
        err
      );

      console.error(
        "HTTP STATUS:",
        err.response?.status
      );

      console.error(
        "SERVER RESPONSE:",
        err.response?.data
      );

      console.error(
        "================================"
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

  // =========================
  // CHANGE EMAIL
  // =========================
  const handleChangeEmail = () => {
    setOtpSent(false);
    setOtp("");
    setMessage("");
    setError("");
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* LOGO */}
        <div className="login-logo">
          OM
        </div>

        {/* TITLE */}
        <h1>Office Management</h1>

        <p className="subtitle">
          Secure business management system
        </p>

        {/* ========================= */}
        {/* EMAIL */}
        {/* ========================= */}

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
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              autoComplete="email"
              disabled={loading}
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
          /* ========================= */
          /* OTP */
          /* ========================= */

          <form onSubmit={handleVerifyOtp}>
            <label htmlFor="otp">
              Enter OTP
            </label>

            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Enter 6 digit OTP"
              value={otp}
              onChange={(e) => {
                const value =
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6);

                setOtp(value);
                setError("");
              }}
              disabled={loading}
              autoFocus
            />

            {/* VERIFY BUTTON */}
            <button
              type="submit"
              disabled={
                loading ||
                otp.trim().length !== 6
              }
            >
              {loading
                ? "Verifying..."
                : "Verify OTP"}
            </button>

            {/* CHANGE EMAIL */}
            <button
              type="button"
              className="secondary-button"
              onClick={handleChangeEmail}
              disabled={loading}
            >
              Change Email
            </button>
          </form>
        )}

        {/* SUCCESS MESSAGE */}
        {message && (
          <p className="login-message">
            {message}
          </p>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <p
            className="login-message"
            style={{
              color: "#b42318",
              background: "#fef3f2",
              border: "1px solid #fecdca",
            }}
          >
            {error}
          </p>
        )}

        {/* FOOTER */}
        <div className="login-footer">
          Secure • Cloud Based • Professional
        </div>

      </div>
    </div>
  );
}

export default Login;
