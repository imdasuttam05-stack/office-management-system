import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clearAlerts = () => {
    setMessage("");
    setError("");
  };

  const saveSession = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const login = async (event) => {
    event.preventDefault();
    clearAlerts();

    try {
      setLoading(true);
      const { data } = await axios.post(`${API_URL}/api/auth/login`, { mobile, password });
      if (data.success) {
        saveSession(data);
        navigate("/dashboard", { replace: true });
      } else {
        setError(data.message || "Login failed.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to login. Please check your mobile number and password.");
    } finally {
      setLoading(false);
    }
  };

  const sendResetOtp = async (event) => {
    event.preventDefault();
    clearAlerts();

    try {
      setLoading(true);
      const { data } = await axios.post(`${API_URL}/api/auth/forgot-password/send-otp`, { mobile });
      if (data.success) {
        setMaskedEmail(data.maskedEmail || "your registered email");
        setMode("reset");
        setMessage(`${data.message} Check ${data.maskedEmail || "your registered email"}.`);
      } else {
        setError(data.message || "Unable to send OTP.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send reset OTP.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    clearAlerts();

    try {
      setLoading(true);
      const { data } = await axios.post(`${API_URL}/api/auth/forgot-password/reset`, {
        mobile,
        otp,
        newPassword,
      });
      if (data.success) {
        setMessage("Password reset successful. Please login with your mobile number and new password.");
        setPassword("");
        setOtp("");
        setNewPassword("");
        setMode("login");
      } else {
        setError(data.message || "Unable to reset password.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP or password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  const switchTo = (nextMode) => {
    setMode(nextMode);
    clearAlerts();
    setOtp("");
    setNewPassword("");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">OM</div>
        <h1>Office Management</h1>
        <p className="subtitle">Secure business management system</p>

        {mode === "login" && (
          <form onSubmit={login}>
            <label htmlFor="mobile">Mobile Number</label>
            <input
              id="mobile"
              type="tel"
              inputMode="numeric"
              placeholder="Enter registered mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/[^0-9+]/g, ""))}
              autoComplete="tel"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>

            <button type="button" className="secondary-button" onClick={() => switchTo("forgot")} disabled={loading}>
              Forgot Password?
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={sendResetOtp}>
            <h3>Forgot Password</h3>
            <p style={{ color: "#667085", fontSize: 13 }}>Enter your registered mobile number. OTP will be sent to your registered email.</p>
            <label htmlFor="forgot-mobile">Mobile Number</label>
            <input
              id="forgot-mobile"
              type="tel"
              inputMode="numeric"
              placeholder="Enter registered mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/[^0-9+]/g, ""))}
              autoComplete="tel"
            />
            <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send OTP to Email"}</button>
            <button type="button" className="secondary-button" onClick={() => switchTo("login")} disabled={loading}>Back to Login</button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={resetPassword}>
            <h3>Reset Password</h3>
            <p style={{ color: "#667085", fontSize: 13 }}>OTP sent to {maskedEmail || "your registered email"}.</p>
            <label htmlFor="reset-otp">Email OTP</label>
            <input
              id="reset-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button type="submit" disabled={loading || otp.length !== 6}>{loading ? "Saving..." : "Reset Password"}</button>
            <button type="button" className="secondary-button" onClick={() => switchTo("forgot")} disabled={loading}>Back</button>
          </form>
        )}

        {message && <p className="login-message">{message}</p>}
        {error && <p className="login-message" style={{ color: "#b42318", background: "#fef3f2" }}>{error}</p>}
        <div className="login-footer">Password Login • OTP Only for Password Reset</div>
      </div>
    </div>
  );
}
