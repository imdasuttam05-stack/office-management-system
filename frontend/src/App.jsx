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

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));

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

          {/* Root */}
          <Route
            path="/"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          {/* Login */}
          <Route
            path="/login"
            element={<Login />}
          />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>

            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/expenses"
              element={<Expense />}
            />

          </Route>

          <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
            <Route
              path="/users"
              element={<Users />}
            />
          </Route>

          {/* Unknown */}
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
