import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL =
  (import.meta.env.VITE_API_URL ||
    "https://office-management-system-ikx8.onrender.com")
    .trim()
    .replace(/^=+/, "")
    .replace(/\/+$/, "");

function authConfig() {
  return {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  };
}

const emptyForm = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  role: "Employee",
};

export default function Users() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await axios.get(
        `${API_URL}/api/users`,
        authConfig()
      );

      setUsers(data.users || []);
    } catch (err) {
      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        navigate("/dashboard", {
          replace: true,
        });
        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const submit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      setSaving(true);

      if (editingId) {
        const payload = {
          ...form,
        };

        if (!payload.password) {
          delete payload.password;
        }

        await axios.patch(
          `${API_URL}/api/users/${editingId}`,
          payload,
          authConfig()
        );

        setMessage(
          "User updated successfully."
        );
      } else {
        await axios.post(
          `${API_URL}/api/users`,
          form,
          authConfig()
        );

        setMessage(
          "User created successfully."
        );
      }

      setForm(emptyForm);
      setEditingId(null);

      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save user."
      );
    } finally {
      setSaving(false);
    }
  };

  const edit = (user) => {
    setEditingId(user.id);

    setForm({
      name: user.name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      password: "",
      role: user.role || "Employee",
      isActive: user.isActive !== false,
    });

    setMessage("");
    setError("");
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: 24,
        fontFamily: "Arial, sans-serif",
        color: "#172b4d",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>
              User Management
            </h1>

            <p
              style={{
                color: "#667085",
              }}
            >
              Admin can create users and edit
              password, role and account status.
            </p>
          </div>

          <button
            onClick={() =>
              navigate("/dashboard")
            }
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #d0d5dd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </div>

        {(message || error) && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              marginBottom: 15,
              background: error
                ? "#fef3f2"
                : "#ecfdf3",
              color: error
                ? "#b42318"
                : "#027a48",
            }}
          >
            {error || message}
          </div>
        )}

        <form
          onSubmit={submit}
          style={{
            background: "#fff",
            padding: 20,
            borderRadius: 16,
            marginBottom: 20,
            boxShadow:
              "0 6px 24px rgba(0,0,0,.06)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {editingId
              ? "Edit User"
              : "Create User"}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",
              gap: 12,
            }}
          >
            {[
              ["name", "Name", "text"],
              ["email", "Email", "email"],
              ["mobile", "Mobile", "tel"],
              [
                "password",
                editingId
                  ? "New Password (optional)"
                  : "Password",
                "password",
              ],
            ].map(
              ([key, label, type]) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    flexDirection:
                      "column",
                    gap: 6,
                    fontSize: 13,
                  }}
                >
                  {label}

                  <input
                    type={type}
                    value={form[key] || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]: e.target.value,
                      })
                    }
                    required={
                      !editingId ||
                      key !== "password"
                    }
                    style={{
                      padding: 11,
                      border:
                        "1px solid #d0d5dd",
                      borderRadius: 10,
                    }}
                  />
                </label>
              )
            )}

            <label
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: 6,
                fontSize: 13,
              }}
            >
              Role

              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value,
                  })
                }
                style={{
                  padding: 11,
                  border:
                    "1px solid #d0d5dd",
                  borderRadius: 10,
                }}
              >
                <option value="Employee">
                  Employee
                </option>

                <option value="Manager">
                  Manager
                </option>

                <option value="Admin">
                  Admin
                </option>
              </select>
            </label>

            {editingId && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 25,
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    form.isActive !== false
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      isActive:
                        e.target.checked,
                    })
                  }
                />

                Active account
              </label>
            )}
          </div>

          <div
            style={{
              marginTop: 15,
              display: "flex",
              gap: 10,
            }}
          >
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "11px 18px",
                borderRadius: 8,
                border: "none",
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update User"
                : "Create User"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancel}
                style={{
                  padding: "11px 18px",
                  borderRadius: 8,
                  border:
                    "1px solid #d0d5dd",
                  background: "#fff",
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            overflow: "auto",
            boxShadow:
              "0 6px 24px rgba(0,0,0,.06)",
          }}
        >
          {loading ? (
            <div style={{ padding: 30 }}>
              Loading users...
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                minWidth: 800,
              }}
            >
              <thead>
                <tr>
                  {[
                    "Name",
                    "Email",
                    "Mobile",
                    "Role",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        padding: 14,
                        borderBottom:
                          "1px solid #eaecf0",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ padding: 14 }}>
                      {user.name}
                    </td>

                    <td style={{ padding: 14 }}>
                      {user.email}
                    </td>

                    <td style={{ padding: 14 }}>
                      {user.mobile}
                    </td>

                    <td style={{ padding: 14 }}>
                      {user.role}
                    </td>

                    <td style={{ padding: 14 }}>
                      {user.isActive
                        ? "Active"
                        : "Inactive"}
                    </td>

                    <td style={{ padding: 14 }}>
                      <button
                        onClick={() =>
                          edit(user)
                        }
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
