import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const userData = localStorage.getItem("user");

  // Not logged in
  if (!token || !userData) {
    return <Navigate to="/login" replace />;
  }

  let user = {};

  try {
    user = JSON.parse(userData);
  } catch (error) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    return <Navigate to="/login" replace />;
  }

  // Tally-style company/FY must be selected before entering the workspace.
  // Keep the selection route accessible so users can create or switch companies.
  if (location.pathname !== "/company-selection") {
    let activeCompany = null;
    try { activeCompany = JSON.parse(localStorage.getItem("oms_active_company") || "null"); } catch { activeCompany = null; }
    const activeFY = localStorage.getItem("oms_active_financial_year");
    if (!activeCompany?._id || !activeFY) {
      return <Navigate to="/company-selection" replace state={{ from: location.pathname }} />;
    }
  }

  // Role permission
  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  // Authorized
  return <Outlet />;
}
