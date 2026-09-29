import React, { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login.jsx";
import Expense from "./pages/Expense.jsx";
import Users from "./pages/Users.jsx";
import Payroll from "./pages/Payroll.jsx";
import PayrollApprovals from "./pages/PayrollApprovals.jsx";

/* ==============================
   ACCOUNTS / OPERATIONS
================================ */
import AccountsMasters from "./pages/AccountsMasters.jsx";
import AccountsWorkspace from "./pages/AccountsWorkspace.jsx";
import InventoryMasters from "./pages/InventoryMasters.jsx";
import RawMaterialPurchase from "./pages/RawMaterialPurchase.jsx";
import Manufacturing from "./pages/Manufacturing.jsx";
import Inventory from "./pages/Inventory.jsx";
import Accounting from "./pages/Accounting.jsx";
import IntegratedOperations from "./pages/IntegratedOperations.jsx";
import VoucherCenter from "./pages/VoucherCenter.jsx";

/* ==============================
   HR MANAGEMENT
================================ */
import Employees from "./pages/Employees.jsx";
import Attendance from "./pages/Attendance.jsx";
import LeaveManagement from "./pages/LeaveManagement.jsx";
import HolidayCalendar from "./pages/HolidayCalendar.jsx";
import ShiftManagement from "./pages/ShiftManagement.jsx";

/* ==============================
   REPORTS
================================ */
import Reports from "./pages/Reports.jsx";
import PayrollReport from "./pages/PayrollReport.jsx";

/* ==============================
   PAYROLL
================================ */
import Salary from "./pages/Salary.jsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { startSessionManager } from "./lib/sessionManager.js";

// Start one global session manager for the whole SPA.
// It keeps the session alive while the user is active
// and logs the user out after 60 minutes of inactivity.
startSessionManager();

const Dashboard = lazy(
  () => import("./pages/Dashboard.jsx")
);

function LoadingScreen() {
  return (
    <div className="app-loading">
      <div className="loading-card">
        <div className="loading-spinner"></div>

        <h3>Office Management</h3>
        <p>Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>

          {/* =====================================
              ROOT
          ====================================== */}
          <Route
            path="/"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          {/* =====================================
              LOGIN
          ====================================== */}
          <Route
            path="/login"
            element={<Login />}
          />

          {/* =====================================
              PROTECTED USER ROUTES
          ====================================== */}
          <Route element={<ProtectedRoute />}>

            {/* ================================
                MAIN
            ================================= */}
            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/expenses"
              element={<Expense />}
            />

            <Route
              path="/approvals"
              element={<PayrollApprovals />}
            />

            {/* ================================
                ACCOUNTS / INVENTORY
            ================================= */}
            <Route
              path="/accounts"
              element={<AccountsMasters />}
            />

            <Route
              path="/accounts/workspace"
              element={<AccountsWorkspace />}
            />

            <Route
              path="/inventory-masters"
              element={<InventoryMasters />}
            />

            <Route
              path="/inventory/raw-material-purchase"
              element={<RawMaterialPurchase />}
            />

            {/* Support the shorter existing URL too */}
            <Route
              path="/raw-material-purchase"
              element={<RawMaterialPurchase />}
            />

            <Route
              path="/manufacturing"
              element={<Manufacturing />}
            />

            <Route
              path="/inventory"
              element={<Inventory />}
            />

            <Route
              path="/accounting"
              element={<Accounting />}
            />

            <Route
              path="/operations"
              element={<IntegratedOperations />}
            />

            <Route
              path="/voucher"
              element={<VoucherCenter />}
            />

            {/* ================================
                SALES / GST
            ================================= */}
            <Route
              path="/sales"
              element={<AccountsWorkspace />}
            />

            <Route
              path="/gst"
              element={<Accounting />}
            />

            {/* ================================
                HR MANAGEMENT
            ================================= */}
            <Route
              path="/employees"
              element={<Employees />}
            />

            <Route
              path="/attendance"
              element={<Attendance />}
            />

            <Route
              path="/leave"
              element={<LeaveManagement />}
            />

            {/* Existing Attendance.jsx uses /leaves
                in one action, so keep both working. */}
            <Route
              path="/leaves"
              element={<LeaveManagement />}
            />

            <Route
              path="/holidays"
              element={<HolidayCalendar />}
            />

            <Route
              path="/shifts"
              element={<ShiftManagement />}
            />

            {/* ================================
                REPORTS
            ================================= */}
            <Route
              path="/reports"
              element={<Reports />}
            />

            <Route
              path="/reports/attendance"
              element={<Reports />}
            />

            <Route
              path="/reports/leave"
              element={<Reports />}
            />

            <Route
              path="/reports/salary"
              element={<Reports />}
            />

            <Route
              path="/reports/business"
              element={<Reports />}
            />

            {/* Existing dedicated payroll report */}
            <Route
              path="/payroll/report"
              element={<PayrollReport />}
            />

            {/* ================================
                PAYROLL
            ================================= */}
            <Route
              path="/payroll"
              element={<Payroll />}
            />

            <Route
              path="/salary"
              element={<Salary />}
            />

            {/* Salary Slips currently use the
                existing payroll report screen. */}
            <Route
              path="/salary/slips"
              element={<PayrollReport />}
            />

          </Route>

          {/* =====================================
              ADMIN ONLY
          ====================================== */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["Admin"]}
              />
            }
          >
            <Route
              path="/users"
              element={<Users />}
            />
          </Route>

          {/* =====================================
              UNKNOWN ROUTE
          ====================================== */}
          <Route
            path="*"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

        </Routes>
      </Suspense>

      {/* =======================================
          LOADING STYLES
      ======================================== */}
      <style>{`
        .app-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f7fb;
          font-family: Arial, sans-serif;
        }

        .loading-card {
          width: 280px;
          padding: 30px 25px;
          background: #fff;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 10px 35px rgba(0, 0, 0, 0.08);
        }

        .loading-spinner {
          width: 38px;
          height: 38px;
          margin: 0 auto 18px;
          border: 4px solid #e5e7eb;
          border-top-color: #245a96;
          border-radius: 50%;
          animation: officeAppSpin 0.8s linear infinite;
        }

        .loading-card h3 {
          margin: 0;
          color: #172b4d;
        }

        .loading-card p {
          margin: 7px 0 0;
          color: #667085;
          font-size: 13px;
        }

        @keyframes officeAppSpin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </BrowserRouter>
  );
}
