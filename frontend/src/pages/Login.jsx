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

  // ==========================================
  // SEND OTP
  // ==========================================
  const sendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      console.log("Sending OTP to:", cleanEmail);

      const response = await axios.post(
        `${API_URL}/api/auth/send-otp`,
        {
          email: cleanEmail,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      console.log("SEND OTP RESPONSE:", response.data);

      if (response.data?.success) {
        setOtpSent(true);

        setMessage(
          "OTP sent successfully. Please check your email."
        );

        setOtp("");
      } else {
        setError(
          response.data?.message ||
            "Unable to send OTP."
        );
      }
    } catch (err) {
      console.error("SEND OTP ERROR:", err);

      if (err.response) {
        setError(
          err.response.data?.message ||
            `Server error: ${err.response.status}`
        );
      } else if (err.request) {
        setError(
          "Server is not responding. Please try again."
        );
      } else {
        setError(
          err.message ||
            "Unable to send OTP."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // VERIFY OTP
  // ==========================================
  const handleVerifyOtp = async () => {
    console.log("VERIFY BUTTON CLICKED");

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    setError("");
    setMessage("");

    if (!cleanEmail) {
      setError("Email is missing.");
      return;
    }

    if (!cleanOtp) {
      setError("Please enter the OTP.");
      return;
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);

      setMessage("Verifying OTP...");

      console.log("================================");
      console.log("VERIFY OTP START");
      console.log("API:", API_URL);
      console.log("Email:", cleanEmail);
      console.log("OTP:", cleanOtp);
      console.log("================================");

      const response = await axios.post(
        `${API_URL}/api/auth/verify-otp`,
        {
          email: cleanEmail,
          otp: cleanOtp,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      console.log(
        "VERIFY OTP RESPONSE:",
        response
      );

      console.log(
        "VERIFY OTP DATA:",
        response.data
      );

      if (response.data?.success === true) {
        console.log(
          "OTP VERIFIED SUCCESSFULLY"
        );

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

        setError("");

        setMessage(
          "Login successful. Opening dashboard..."
        );

        // Give UI a moment to show success
        setTimeout(() => {
          navigate("/dashboard");
        }, 500);

        return;
      }

      // API responded but success=false
      setMessage("");

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
        "================================"
      );

      setMessage("");

      if (err.response) {
        console.error(
          "STATUS:",
          err.response.status
        );

        console.error(
          "DATA:",
          err.response.data
        );

        setError(
          err.response.data?.message ||
            `Verification failed (${err.response.status})`
        );
      } else if (err.request) {
        setError(
          "No response from server. Please try again."
        );
      } else {
        setError(
          err.message ||
            "Unable to verify OTP."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // CHANGE EMAIL
  // ==========================================
  const changeEmail = () => {
    setOtpSent(false);
    setOtp("");
    setMessage("");
    setError("");
  };

  // ==========================================
  // UI
  // ==========================================
  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-logo">
          OM
        </div>

        <h1>
          Office Management
        </h1>

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
              disabled={loading}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendOtp();
                }
              }}
            />

            <button
              type="button"
              onClick={sendOtp}
              disabled={loading}
            >
              {loading
                ? "Sending..."
                : "Send OTP"}
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
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Enter 6 digit OTP"
              value={otp}
              disabled={loading}
              autoFocus
              onChange={(e) => {
                const value =
                  e.target.value.replace(
                    /\D/g,
                    ""
                  );

                setOtp(value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  otp.length === 6 &&
                  !loading
                ) {
                  handleVerifyOtp();
                }
              }}
            />

            <button
              type="button"
              onClick={handleVerifyOtp}
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
          </>
        )}

        {/* SUCCESS / INFORMATION */}
        {message && (
          <p className="login-message">
            {message}
          </p>
        )}

        {/* ERROR */}
        {error && (
          <p
            className="login-message"
            style={{
              color: "#b42318",
              background: "#fef3f2",
              border:
                "1px solid #fecdca",
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
