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

        <h3>
          Office Management
        </h3>

        <p>
          Loading...
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={<LoadingScreen />}
      >
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

          <Route
            element={
              <ProtectedRoute />
            }
          >

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

            {/* Payroll */}
            <Route
              path="/payroll"
              element={<Payroll />}
            />

          </Route>

          {/* =====================================
              ADMIN ONLY
          ====================================== */}

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "Admin",
                ]}
              />
            }
          >

            {/* User Management */}
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

          font-family:
            Arial,
            sans-serif;
        }

        .loading-card {
          width: 280px;

          padding:
            30px 25px;

          background: #fff;

          border-radius: 16px;

          text-align: center;

          box-shadow:
            0 10px 35px
            rgba(0, 0, 0, 0.08);
        }

        .loading-spinner {
          width: 38px;
          height: 38px;

          margin:
            0 auto 18px;

          border:
            4px solid #e5e7eb;

          border-top-color:
            #245a96;

          border-radius: 50%;

          animation:
            officeAppSpin
            0.8s
            linear
            infinite;
        }

        .loading-card h3 {
          margin: 0;

          color:
            #172b4d;
        }

        .loading-card p {
          margin:
            7px 0 0;

          color:
            #667085;

          font-size: 13px;
        }

        @keyframes officeAppSpin {

          from {
            transform:
              rotate(0deg);
          }

          to {
            transform:
              rotate(360deg);
          }

        }

      `}</style>
    </BrowserRouter>
  );
}
