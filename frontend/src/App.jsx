import React, { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Expense from "./pages/Expense.jsx";

const Dashboard = lazy(() =>
  import("./pages/Dashboard.jsx")
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

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>

          {/* ROOT */}
          <Route
            path="/"
            element={
              <Navigate
                to="/login"
                replace
              />
            }
          />

          {/* LOGIN */}
          <Route
            path="/login"
            element={<Login />}
          />

          {/* PROTECTED APPLICATION */}
          <Route element={<ProtectedRoute />}>

            {/* DASHBOARD */}
            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            {/* EXPENSE */}
            <Route
              path="/expenses"
              element={<Expense />}
            />

          </Route>

          {/* UNKNOWN URL */}
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
    </BrowserRouter>
  );
}

export default App;
