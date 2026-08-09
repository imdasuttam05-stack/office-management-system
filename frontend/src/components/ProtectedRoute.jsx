import React from "react";
import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute({ allowedRoles }) {
  const token = localStorage.getItem("token");
  const userData = localStorage.getItem("user");

  // ==========================================
  // NOT LOGGED IN
  // ==========================================

  if (!token || !userData) {
    return <Navigate to="/login" replace />;
  }

  // ==========================================
  // PARSE USER DATA
  // ==========================================

  let user = {};

  try {
    user = JSON.parse(userData);
  } catch (error) {
    console.error("Invalid user data:", error);

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    return <Navigate to="/login" replace />;
  }

  // ==========================================
  // ROLE PERMISSION
  // ==========================================

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  // ==========================================
  // AUTHORIZED
  // ==========================================

  return <Outlet />;
}
