```jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute({ allowedRoles }) {
  const token = localStorage.getItem("token");
  const userData = localStorage.getItem("user");

  const location = useLocation();

  // ==========================================
  // NOT LOGGED IN
  // ==========================================

  if (!token || !userData) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // ==========================================
  // READ USER DATA
  // ==========================================

  let user = {};

  try {
    user = JSON.parse(userData || "{}");
  } catch (error) {
    console.error("Invalid user data:", error);

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // ==========================================
  // ROLE PERMISSION
  // ==========================================

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f7fb",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            padding: "40px",
            borderRadius: "16px",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <h2>Access Denied</h2>

          <p>
            You do not have permission to access this page.
          </p>

          <button
            onClick={() =>
              window.location.href = "/dashboard"
            }
            style={{
              marginTop: "15px",
              padding: "10px 18px",
              border: "none",
              borderRadius: "8px",
              background: "#245a96",
              color: "#ffffff",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // AUTHORIZED
  // ==========================================

  return <Outlet />;
}
```
