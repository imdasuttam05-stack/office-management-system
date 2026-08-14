import React, { useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com"
)
  .trim()
  .replace(/^=+/, "")
  .replace(/\/+$/, "");

function getTitle(pathname) {
  if (pathname === "/approvals") return "Approvals";
  if (pathname === "/employees") return "Employees";
  if (pathname === "/reports") return "Reports";
  if (pathname === "/security") return "Security";
  return "Office Management";
}

export default function ModulePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const title = getTitle(location.pathname);

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setSaving(true);

      const token = localStorage.getItem("token");

      const response = await axios.post(
        `${API_URL}/api/auth/change-password`,
        {
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        }
      );

      setMessage(
        response.data?.message ||
          "Password changed successfully."
      );

      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to change password."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <h1>{title}</h1>
          <p>Office Management System</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="back-btn"
        >
          ← Dashboard
        </button>
      </header>

      <main className="module-content">
        {location.pathname === "/approvals" && (
          <section className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon">✓</div>
              <div>
                <h2>Approval Queue</h2>
                <p>
                  Pending approval items will appear here for review.
                </p>
              </div>
            </article>

            <article className="feature-card">
              <div className="feature-icon">0</div>
              <div>
                <h2>Pending</h2>
                <p>There are currently no pending approval items.</p>
              </div>
            </article>
          </section>
        )}

        {location.pathname === "/employees" && (
          <section className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon">👥</div>
              <div>
                <h2>Employee Directory</h2>
                <p>
                  Employee records, roles and active status can be managed from this module.
                </p>
              </div>
            </article>

            <article className="feature-card">
              <div className="feature-icon">+</div>
              <div>
                <h2>User Management</h2>
                <p>
                  Admin users can create and edit accounts from User Management.
                </p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => navigate("/users")}
                >
                  Open User Management
                </button>
              </div>
            </article>
          </section>
        )}

        {location.pathname === "/reports" && (
          <section className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon">₹</div>
              <div>
                <h2>Expense Reports</h2>
                <p>
                  Expense and approval reports will be available here.
                </p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => navigate("/expenses")}
                >
                  Open Expenses
                </button>
              </div>
            </article>

            <article className="feature-card">
              <div className="feature-icon">▦</div>
              <div>
                <h2>Business Reports</h2>
                <p>
                  Reporting widgets are ready for the next reporting APIs.
                </p>
              </div>
            </article>
          </section>
        )}

        {location.pathname === "/security" && (
          <section className="security-card">
            <h2>Change Password</h2>
            <p className="section-text">
              Change your current password. You will need to login again after a successful change.
            </p>

            {(message || error) && (
              <div className={error ? "alert error" : "alert success"}>
                {error || message}
              </div>
            )}

            <form onSubmit={changePassword} className="security-form">
              <label>
                Current password
                <input
                  type="password"
                  value={form.currentPassword}
                  onChange={(event) =>
                    updateForm("currentPassword", event.target.value)
                  }
                  required
                />
              </label>

              <label>
                New password
                <input
                  type="password"
                  value={form.newPassword}
                  onChange={(event) =>
                    updateForm("newPassword", event.target.value)
                  }
                  minLength={8}
                  required
                />
              </label>

              <label>
                Confirm new password
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    updateForm("confirmPassword", event.target.value)
                  }
                  minLength={8}
                  required
                />
              </label>

              <button
                type="submit"
                className="primary-btn"
                disabled={saving}
              >
                {saving ? "Updating..." : "Change Password"}
              </button>
            </form>
          </section>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f5f7fb; color: #172b4d; }
        .module-page { min-height: 100vh; background: #f5f7fb; }
        .module-header { min-height: 76px; background: #fff; border-bottom: 1px solid #e4e7ec; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; }
        .module-header h1 { margin: 0; font-size: 22px; color: #173b68; }
        .module-header p { margin: 4px 0 0; color: #667085; font-size: 13px; }
        .back-btn { border: 1px solid #d0d5dd; background: #fff; color: #173b68; padding: 10px 14px; border-radius: 9px; cursor: pointer; font-weight: 600; }
        .module-content { max-width: 1200px; margin: 0 auto; padding: 32px; }
        .feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .feature-card, .security-card { background: #fff; border: 1px solid #e4e7ec; border-radius: 16px; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,.04); }
        .feature-card { display: flex; gap: 18px; align-items: flex-start; }
        .feature-icon { width: 48px; height: 48px; border-radius: 12px; background: #eef4fb; color: #245a96; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .feature-card h2, .security-card h2 { margin: 0; font-size: 18px; }
        .feature-card p, .section-text { color: #667085; line-height: 1.6; margin: 8px 0 0; }
        .primary-btn { margin-top: 14px; border: none; background: #245a96; color: #fff; padding: 11px 16px; border-radius: 9px; cursor: pointer; font-weight: 700; }
        .primary-btn:disabled { opacity: .6; cursor: not-allowed; }
        .security-card { max-width: 620px; margin: 0 auto; }
        .security-form { display: grid; gap: 15px; margin-top: 20px; }
        .security-form label { display: grid; gap: 7px; font-size: 13px; font-weight: 600; }
        .security-form input { padding: 12px; border: 1px solid #d0d5dd; border-radius: 9px; font-size: 14px; }
        .alert { margin-top: 16px; padding: 11px 13px; border-radius: 9px; font-size: 13px; }
        .alert.error { background: #fef3f2; color: #b42318; }
        .alert.success { background: #ecfdf3; color: #027a48; }
        @media (max-width: 700px) { .module-header { padding: 0 16px; } .module-content { padding: 18px 16px; } .feature-grid { grid-template-columns: 1fr; } .module-header h1 { font-size: 19px; } }
      `}</style>
    </div>
  );
}
