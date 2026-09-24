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
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { startSessionManager } from "./lib/sessionManager.js";

import Employees from "./pages/Employees.jsx";
import Attendance from "./pages/Attendance.jsx";
import LeaveManagement from "./pages/LeaveManagement.jsx";
import HolidayCalendar from "./pages/HolidayCalendar.jsx";
import Salary from "./pages/Salary.jsx";
import ShiftManagement from "./pages/ShiftManagement.jsx";
import PayrollApprovals from "./pages/PayrollApprovals.jsx";
import Reports from "./pages/Reports.jsx";

startSessionManager();

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));

const RawMaterialPurchase = lazy(
  () => import("./pages/RawMaterialPurchase.jsx")
);

const Manufacturing = lazy(
  () => import("./pages/Manufacturing.jsx")
);

const InventoryMasters = lazy(
  () => import("./pages/InventoryMasters.jsx")
);

function LoadingScreen() {
  return (
    <div className="app-loading">
      <div className="loading-card">
        <div className="loading-spinner" />

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

          {/* =====================================================
              ROOT
          ===================================================== */}

          <Route
            path="/"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          {/* =====================================================
              LOGIN
          ===================================================== */}

          <Route
            path="/login"
            element={<Login />}
          />

          {/* =====================================================
              PROTECTED ROUTES
          ===================================================== */}

          <Route element={<ProtectedRoute />}>

            {/* Dashboard */}

            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            {/* Expenses */}

            <Route
              path="/expenses"
              element={<Expense />}
            />

            {/* =================================================
                INVENTORY
            ================================================= */}

            <Route
              path="/inventory/raw-material-purchase"
              element={<RawMaterialPurchase />}
            />

            {/* Inventory Masters
                Location / Supplier / Product */}

            <Route
              path="/inventory/masters"
              element={<InventoryMasters />}
            />

            <Route
              path="/inventory"
              element={<Manufacturing />}
            />

            <Route
              path="/manufacturing"
              element={<Manufacturing />}
            />

            <Route
              path="/sales"
              element={<Manufacturing />}
            />

            <Route
              path="/gst"
              element={<Manufacturing />}
            />

            {/* =================================================
                HR MODULE
            ================================================= */}

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

            <Route
              path="/holidays"
              element={<HolidayCalendar />}
            />

            <Route
              path="/shifts"
              element={<ShiftManagement />}
            />

            {/* =================================================
                SALARY / PAYROLL
            ================================================= */}

            <Route
              path="/salary"
              element={<Salary />}
            />

            <Route
              path="/payroll/approvals"
              element={<PayrollApprovals />}
            />

            <Route
              path="/reports/payroll"
              element={<Reports />}
            />

            <Route
              path="/salary/slips"
              element={<Reports />}
            />

            <Route
              path="/payroll"
              element={<Salary />}
            />

          </Route>

          {/* =====================================================
              ADMIN ONLY
          ===================================================== */}

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

          {/* =====================================================
              OTHER ROUTES
          ===================================================== */}

          <Route
            path="/approvals"
            element={
              <Navigate
                to="/payroll/approvals"
                replace
              />
            }
          />

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
            path="/security"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          {/* =====================================================
              FALLBACK
          ===================================================== */}

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

      {/* =========================================================
          LOADING CSS
      ========================================================= */}

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
          box-shadow: 0 10px 35px rgba(0,0,0,.08);
        }

        .loading-spinner {
          width: 38px;
          height: 38px;
          margin: 0 auto 18px;
          border: 4px solid #e5e7eb;
          border-top-color: #245a96;
          border-radius: 50%;
          animation: officeAppSpin .8s linear infinite;
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
