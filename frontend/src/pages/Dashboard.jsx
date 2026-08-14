import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com";

function Dashboard() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userData = localStorage.getItem("user");

  let user = {};

  try {
    user = JSON.parse(userData || "{}");
  } catch {
    user = {};
  }

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, {
        withCredentials: true,
      });
    } catch (error) {
      console.warn("Logout API failed:", error?.message);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    }
  };

  const openExpenses = () => {
    navigate("/expenses");
  };

  const openUsers = () => {
    if (user.role === "Admin") {
      navigate("/users");
      setSidebarOpen(false);
    }
  };

  const openModule = (module) => {
    navigate(`/module/${module}`);
    setSidebarOpen(false);
  };

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div className="dashboard">
      {/* ==========================================
          HEADER
      ========================================== */}

      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-title">Office Management</div>
          <div className="sidebar-brand-subtitle">Business Management System</div>
        </div>

        <nav className="sidebar-nav">
          <button className="sidebar-nav-item" onClick={() => { navigate("/dashboard"); setSidebarOpen(false); }}>
            <span>🏠</span><span>Dashboard</span>
          </button>

          <button className="sidebar-nav-item" onClick={() => { openExpenses(); setSidebarOpen(false); }}>
            <span>₹</span><span>Expenses</span>
          </button>

          <button className="sidebar-nav-item" onClick={() => openModule("approvals")}>
            <span>✓</span><span>Approvals</span>
          </button>

          <button className="sidebar-nav-item" onClick={() => openModule("employees")}>
            <span>👥</span><span>Employees</span>
          </button>

          <button className="sidebar-nav-item" onClick={() => openModule("reports")}>
            <span>📊</span><span>Reports</span>
          </button>

          {user.role === "Admin" && (
            <button className="sidebar-nav-item" onClick={openUsers}>
              <span>👤</span><span>User Management</span>
            </button>
          )}

          <button className="sidebar-nav-item" onClick={() => openModule("security")}>
            <span>🔐</span><span>Security</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{user.name || "User"}</strong>
            <span>{user.role || "Employee"}</span>
          </div>
          <button className="sidebar-logout" onClick={logout}>Logout</button>
        </div>
      </aside>

      <header className="dashboard-header">
        <div className="header-left">
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            title="Open menu"
          >
            ☰
          </button>

          <div>
          <h1>Office Management</h1>
          <p>Business Management System</p>
        </div>

        <div className="user-section">
          <div className="user-info">
            <strong>{user.name || "User"}</strong>

            <span>
              {user.role || "Employee"}
            </span>
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* ==========================================
          MAIN
      ========================================== */}

      <main className="dashboard-content">

        {/* ========================================
            WELCOME
        ======================================== */}

        <div className="welcome-card">
          <div>
            <h2>
              Welcome back, {user.name || "User"} 👋
            </h2>

            <p>
              Your Office Management Dashboard
            </p>
          </div>

          <div className="role-badge">
            {user.role || "Employee"}
          </div>
        </div>

        {/* ========================================
            STATISTICS
        ======================================== */}

        <div className="stats-grid">

          <div className="stat-card">
            <span>Total Expenses</span>

            <strong>₹0</strong>

            <small>
              This month
            </small>
          </div>

          <div className="stat-card">
            <span>Pending Approval</span>

            <strong>0</strong>

            <small>
              Waiting for action
            </small>
          </div>

          <div className="stat-card">
            <span>Total Employees</span>

            <strong>0</strong>

            <small>
              Active employees
            </small>
          </div>

          <div className="stat-card">
            <span>Pending Tasks</span>

            <strong>0</strong>

            <small>
              Requires attention
            </small>
          </div>

        </div>

        {/* ========================================
            QUICK ACCESS
        ======================================== */}

        <section className="modules-section">

          <h2>
            Quick Access
          </h2>

          <div className="modules-grid">

            {/* ====================================
                EXPENSES
            ==================================== */}

            <div
              className="module-card clickable"
              onClick={openExpenses}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  openExpenses();
                }
              }}
            >
              <div className="module-icon">
                ₹
              </div>

              <div>
                <h3>
                  Expenses
                </h3>

                <p>
                  Manage office expenses
                </p>
              </div>
            </div>

            {/* ====================================
                APPROVALS
            ==================================== */}

            <div
              className="module-card clickable"
              onClick={() => openModule("approvals")}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  openModule("approvals");
                }
              }}
            >
              <div className="module-icon">
                ✓
              </div>

              <div>
                <h3>
                  Approvals
                </h3>

                <p>
                  Review pending approvals
                </p>
              </div>
            </div>

            {/* ====================================
                EMPLOYEES
            ==================================== */}

            <div
              className="module-card clickable"
              onClick={() => openModule("employees")}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  openModule("employees");
                }
              }}
            >
              <div className="module-icon">👥</div>
              <div>
                <h3>Employees</h3>
                <p>Manage employees</p>
              </div>
            </div>

            {user.role === "Admin" && (
              <div
                className="module-card clickable"
                onClick={openUsers}
                role="button"
                tabIndex={0}
              >
                <div className="module-icon">👤</div>
                <div>
                  <h3>Users</h3>
                  <p>Create and edit users</p>
                </div>
              </div>
            )}

            {/* ====================================
                REPORTS
            ==================================== */}

            <div
              className="module-card clickable"
              onClick={() => openModule("reports")}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  openModule("reports");
                }
              }}
            >
              <div className="module-icon">
                📊
              </div>

              <div>
                <h3>
                  Reports
                </h3>

                <p>
                  View business reports
                </p>
              </div>
            </div>

            <div
              className="module-card clickable"
              onClick={() => openModule("security")}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  openModule("security");
                }
              }}
            >
              <div className="module-icon">
                🔐
              </div>

              <div>
                <h3>
                  Security
                </h3>

                <p>
                  Change your password
                </p>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* ==========================================
          STYLES
      ========================================== */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family:
            Arial,
            Helvetica,
            sans-serif;

          background: #f5f7fb;
          color: #172b4d;
        }

        .dashboard {
          min-height: 100vh;
          background: #f5f7fb;
        }

        /* ========================================
           HEADER
        ======================================== */

        .dashboard-header {
          min-height: 76px;

          background: #ffffff;

          border-bottom:
            1px solid #e4e7ec;

          display: flex;

          align-items: center;

          justify-content:
            space-between;

          padding:
            0 32px;
        }

        .dashboard-header h1 {
          margin: 0;

          font-size: 21px;

          color: #173b68;
        }

        .dashboard-header p {
          margin:
            4px 0 0;

          color: #667085;

          font-size: 13px;
        }

        /* ========================================
           USER
        ======================================== */

        .user-section {
          display: flex;

          align-items: center;

          gap: 20px;
        }

        .user-info {
          display: flex;

          flex-direction: column;

          align-items: flex-end;
        }

        .user-info strong {
          font-size: 14px;
        }

        .user-info span {
          margin-top: 3px;

          font-size: 12px;

          color: #245a96;
        }

        .logout-btn {
          border: none;

          background: #eef3f8;

          color: #245a96;

          padding:
            9px 16px;

          border-radius: 8px;

          font-weight: 600;

          cursor: pointer;

          transition:
            background 0.2s ease;
        }

        .logout-btn:hover {
          background: #e2ebf5;
        }

        /* ========================================
           CONTENT
        ======================================== */

        .dashboard-content {
          width: 100%;

          max-width: 1400px;

          margin: 0 auto;

          padding:
            38px 32px;
        }

        /* ========================================
           WELCOME
        ======================================== */

        .welcome-card {
          background:
            linear-gradient(
              135deg,
              #245a96,
              #174579
            );

          color: white;

          border-radius: 16px;

          padding: 28px;

          display: flex;

          justify-content:
            space-between;

          align-items: center;

          box-shadow:
            0 8px 24px
            rgba(
              36,
              90,
              150,
              0.12
            );
        }

        .welcome-card h2 {
          margin: 0;

          font-size: 23px;
        }

        .welcome-card p {
          margin:
            8px 0 0;

          font-size: 14px;
        }

        .role-badge {
          background:
            rgba(
              255,
              255,
              255,
              0.15
            );

          padding:
            8px 14px;

          border-radius: 20px;

          font-size: 13px;
        }

        /* ========================================
           STATS
        ======================================== */

        .stats-grid {
          display: grid;

          grid-template-columns:
            repeat(4, 1fr);

          gap: 18px;

          margin-top: 24px;
        }

        .stat-card {
          background: white;

          border:
            1px solid #e4e7ec;

          border-radius: 14px;

          padding: 22px;

          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .stat-card:hover {
          transform:
            translateY(-2px);

          box-shadow:
            0 8px 24px
            rgba(
              0,
              0,
              0,
              0.06
            );
        }

        .stat-card span {
          display: block;

          color: #667085;

          font-size: 13px;
        }

        .stat-card strong {
          display: block;

          margin-top: 10px;

          font-size: 28px;

          color: #173b68;
        }

        .stat-card small {
          display: block;

          margin-top: 6px;

          color: #98a2b3;
        }

        /* ========================================
           MODULES
        ======================================== */

        .modules-section {
          margin-top: 34px;
        }

        .modules-section h2 {
          font-size: 18px;

          margin:
            0 0 16px;
        }

        .modules-grid {
          display: grid;

          grid-template-columns:
            repeat(4, 1fr);

          gap: 18px;
        }

        .module-card {
          background: white;

          border:
            1px solid #e4e7ec;

          border-radius: 14px;

          padding: 20px;

          display: flex;

          align-items: center;

          gap: 15px;

          min-height: 100px;
        }

        .module-card.clickable {
          cursor: pointer;

          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .module-card.clickable:hover {
          transform:
            translateY(-3px);

          box-shadow:
            0 10px 25px
            rgba(
              36,
              90,
              150,
              0.10
            );

          border-color:
            #c7d8eb;
        }

        .module-card.clickable:focus {
          outline:
            2px solid #245a96;

          outline-offset: 2px;
        }

        .module-icon {
          width: 44px;

          height: 44px;

          border-radius: 10px;

          background: #eef4fb;

          color: #245a96;

          display: flex;

          align-items: center;

          justify-content: center;

          font-weight: 700;

          flex-shrink: 0;
        }

        .module-card h3 {
          margin: 0;

          font-size: 15px;
        }

        .module-card p {
          margin:
            5px 0 0;

          color: #667085;

          font-size: 12px;
        }

        /* ========================================
           SIDEBAR
        ======================================== */

        .menu-toggle {
          width: 42px;
          height: 42px;
          border: 1px solid #d0d5dd;
          background: #ffffff;
          border-radius: 10px;
          color: #173b68;
          font-size: 22px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .menu-toggle:hover {
          background: #f2f4f7;
          border-color: #b8c4d3;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .dashboard-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 285px;
          height: 100vh;
          background: #ffffff;
          border-right: 1px solid #e4e7ec;
          box-shadow: 14px 0 32px rgba(16,24,40,.12);
          z-index: 2000;
          display: flex;
          flex-direction: column;
          transform: translateX(-105%);
          transition: transform .25s ease;
        }

        .dashboard-sidebar.open {
          transform: translateX(0);
        }

        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,.36);
          z-index: 1900;
        }

        .sidebar-brand {
          padding: 24px 22px 18px;
          border-bottom: 1px solid #eef2f6;
        }

        .sidebar-brand-title {
          font-size: 20px;
          font-weight: 700;
          color: #173b68;
        }

        .sidebar-brand-subtitle {
          margin-top: 5px;
          color: #667085;
          font-size: 12px;
        }

        .sidebar-nav {
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow-y: auto;
        }

        .sidebar-nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border: 1px solid transparent;
          background: transparent;
          color: #344054;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          font-size: 14px;
          font-weight: 600;
          transition: all .2s ease;
        }

        .sidebar-nav-item:hover {
          background: #f2f6fb;
          color: #173b68;
          border-color: #dbe6f2;
        }

        .sidebar-footer {
          margin-top: auto;
          padding: 16px;
          border-top: 1px solid #eef2f6;
        }

        .sidebar-user {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 4px 6px 12px;
        }

        .sidebar-user strong {
          color: #173b68;
          font-size: 14px;
        }

        .sidebar-user span {
          color: #667085;
          font-size: 12px;
        }

        .sidebar-logout {
          width: 100%;
          border: none;
          background: #eef3f8;
          color: #245a96;
          padding: 11px 14px;
          border-radius: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .sidebar-logout:hover {
          background: #e2ebf5;
        }

        /* ========================================
           TABLET
        ======================================== */

        @media (max-width: 1000px) {

          .stats-grid,
          .modules-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

        }

        /* ========================================
           MOBILE
        ======================================== */

        @media (max-width: 600px) {

          .dashboard-sidebar {
            width: min(88vw, 300px);
          }

          .dashboard-header {
            padding:
              0 16px;
          }

          .dashboard-content {
            padding:
              18px 16px;
          }

          .user-info {
            display: none;
          }

          .welcome-card {
            padding: 22px;

            align-items:
              flex-start;

            gap: 16px;

            flex-direction:
              column;
          }

          .welcome-card h2 {
            font-size: 20px;
          }

          .stats-grid,
          .modules-grid {
            grid-template-columns:
              1fr;
          }

          .module-card {
            min-height: 88px;
          }

        }

      `}</style>

    </div>
  );
}

export default Dashboard;
