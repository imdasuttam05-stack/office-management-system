import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Dashboard.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";

const Dashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Demo dashboard values for now.
  // Later these will come from the Expense API.
  const stats = useMemo(
    () => [
      {
        title: "Total Expenses",
        value: "₹0.00",
        change: "This month",
        icon: "₹",
        type: "blue",
      },
      {
        title: "Pending Approval",
        value: "0",
        change: "Awaiting review",
        icon: "⏳",
        type: "orange",
      },
      {
        title: "Approved",
        value: "0",
        change: "This month",
        icon: "✓",
        type: "green",
      },
      {
        title: "Rejected",
        value: "0",
        change: "This month",
        icon: "!",
        type: "red",
      },
    ],
    []
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("User data error:", error);
        localStorage.removeItem("user");
      }
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/", { replace: true });
  };

  const getInitials = () => {
    if (!user) return "U";

    if (user.name) {
      return user.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    }

    return user.email?.charAt(0).toUpperCase() || "U";
  };

  const handleNavigation = (path) => {
    setSidebarOpen(false);

    if (path === "/dashboard") {
      navigate("/dashboard");
      return;
    }

    navigate(path);
  };

  return (
    <div className="dashboard-layout">

      {/* ================= SIDEBAR ================= */}

      <aside
        className={`dashboard-sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="brand-logo">OM</div>

          <div>
            <div className="brand-title">
              Office Management
            </div>

            <div className="brand-subtitle">
              Business Management
            </div>
          </div>
        </div>

        <div className="sidebar-section-title">
          MAIN MENU
        </div>

        <nav className="sidebar-nav">

          <button
            className="nav-item active"
            onClick={() => handleNavigation("/dashboard")}
          >
            <span className="nav-icon">⌂</span>
            <span>Dashboard</span>
          </button>

          <button
            className="nav-item"
            onClick={() => handleNavigation("/expenses")}
          >
            <span className="nav-icon">₹</span>
            <span>Expenses</span>
          </button>

          <button
            className="nav-item"
            onClick={() =>
              handleNavigation("/upload-voucher")
            }
          >
            <span className="nav-icon">↑</span>
            <span>Upload Voucher</span>
          </button>

          <button
            className="nav-item"
            onClick={() =>
              handleNavigation("/approvals")
            }
          >
            <span className="nav-icon">✓</span>
            <span>Approvals</span>
          </button>

          <button
            className="nav-item"
            onClick={() => handleNavigation("/users")}
          >
            <span className="nav-icon">♙</span>
            <span>User Management</span>
          </button>

          <div className="sidebar-section-title second">
            MANAGEMENT
          </div>

          <button
            className="nav-item"
            onClick={() => handleNavigation("/reports")}
          >
            <span className="nav-icon">▥</span>
            <span>Reports</span>
          </button>

          <button
            className="nav-item"
            onClick={() => handleNavigation("/settings")}
          >
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </button>
        </nav>

        {/* Sidebar bottom */}

        <div className="sidebar-bottom">

          <div className="sidebar-security">
            <div className="security-icon">
              ✓
            </div>

            <div>
              <strong>Secure System</strong>
              <span>Cloud based</span>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            <span>↪</span>
            Logout
          </button>

        </div>
      </aside>

      {/* Mobile overlay */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================= MAIN ================= */}

      <main className="dashboard-main">

        {/* HEADER */}

        <header className="dashboard-header">

          <div className="header-left">

            <button
              className="mobile-menu-button"
              onClick={() =>
                setSidebarOpen(!sidebarOpen)
              }
            >
              ☰
            </button>

            <div>
              <h1>Dashboard</h1>

              <p>
                Welcome back! Here's what's happening
                today.
              </p>
            </div>

          </div>

          <div className="header-right">

            <button
              className="notification-button"
              title="Notifications"
            >
              🔔
              <span className="notification-dot">
                0
              </span>
            </button>

            <div className="header-user">

              <div className="user-avatar">
                {getInitials()}
              </div>

              <div className="header-user-info">

                <strong>
                  {user?.name || "User"}
                </strong>

                <span>
                  {user?.role || "Employee"}
                </span>

              </div>

            </div>

          </div>
        </header>

        {/* ================= CONTENT ================= */}

        <div className="dashboard-content">

          {/* Welcome card */}

          <section className="welcome-card">

            <div className="welcome-content">

              <div className="welcome-badge">
                OFFICE MANAGEMENT
              </div>

              <h2>
                Good day,{" "}
                {user?.name || "User"} 👋
              </h2>

              <p>
                Manage your office expenses,
                approvals and business activities
                from one place.
              </p>

              <div className="welcome-actions">

                <button
                  className="primary-action"
                  onClick={() =>
                    navigate("/expenses")
                  }
                >
                  <span>+</span>
                  Add Expense
                </button>

                <button
                  className="secondary-action"
                  onClick={() =>
                    navigate("/upload-voucher")
                  }
                >
                  <span>↑</span>
                  Upload Voucher
                </button>

              </div>

            </div>

            <div className="welcome-illustration">
              <div className="illustration-circle">
                <div className="illustration-card">
                  <div className="fake-line long" />
                  <div className="fake-line medium" />
                  <div className="fake-line short" />

                  <div className="fake-chart">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>

          </section>

          {/* ================= STAT CARDS ================= */}

          <section className="stats-grid">

            {stats.map((stat) => (
              <div
                className="stat-card"
                key={stat.title}
              >

                <div className="stat-top">

                  <div
                    className={`stat-icon ${stat.type}`}
                  >
                    {stat.icon}
                  </div>

                  <button className="stat-menu">
                    •••
                  </button>

                </div>

                <div className="stat-title">
                  {stat.title}
                </div>

                <div className="stat-value">
                  {stat.value}
                </div>

                <div className="stat-change">
                  {stat.change}
                </div>

              </div>
            ))}

          </section>

          {/* ================= LOWER GRID ================= */}

          <section className="dashboard-grid">

            {/* Recent expenses */}

            <div className="dashboard-card recent-card">

              <div className="card-header">

                <div>
                  <h3>Recent Expenses</h3>
                  <p>
                    Latest expense transactions
                  </p>
                </div>

                <button
                  className="view-all-button"
                  onClick={() =>
                    navigate("/expenses")
                  }
                >
                  View All →
                </button>

              </div>

              <div className="empty-state">

                <div className="empty-icon">
                  ₹
                </div>

                <h4>No expenses yet</h4>

                <p>
                  Your recent expense transactions
                  will appear here.
                </p>

                <button
                  className="empty-action"
                  onClick={() =>
                    navigate("/expenses")
                  }
                >
                  Add First Expense
                </button>

              </div>

            </div>

            {/* Quick actions */}

            <div className="dashboard-card">

              <div className="card-header">

                <div>
                  <h3>Quick Actions</h3>
                  <p>
                    Frequently used features
                  </p>
                </div>

              </div>

              <div className="quick-actions">

                <button
                  onClick={() =>
                    navigate("/expenses")
                  }
                >
                  <span className="quick-icon blue">
                    +
                  </span>

                  <span>
                    <strong>
                      Add Expense
                    </strong>
                    <small>
                      Create a new expense
                    </small>
                  </span>

                  <b>→</b>
                </button>

                <button
                  onClick={() =>
                    navigate("/upload-voucher")
                  }
                >
                  <span className="quick-icon purple">
                    ↑
                  </span>

                  <span>
                    <strong>
                      Upload Voucher
                    </strong>
                    <small>
                      Upload receipt or bill
                    </small>
                  </span>

                  <b>→</b>
                </button>

                <button
                  onClick={() =>
                    navigate("/approvals")
                  }
                >
                  <span className="quick-icon orange">
                    ✓
                  </span>

                  <span>
                    <strong>
                      Review Approvals
                    </strong>
                    <small>
                      Check pending requests
                    </small>
                  </span>

                  <b>→</b>
                </button>

                <button
                  onClick={() =>
                    navigate("/reports")
                  }
                >
                  <span className="quick-icon green">
                    ▥
                  </span>

                  <span>
                    <strong>
                      View Reports
                    </strong>
                    <small>
                      Business reports
                    </small>
                  </span>

                  <b>→</b>
                </button>

              </div>

            </div>

          </section>

          {/* ================= SYSTEM STATUS ================= */}

          <section className="system-status-card">

            <div className="status-left">

              <div className="status-check">
                ✓
              </div>

              <div>
                <strong>
                  All systems operational
                </strong>

                <span>
                  Your Office Management System is
                  running normally.
                </span>
              </div>

            </div>

            <div className="status-right">
              <span className="online-dot" />
              Cloud Connected
            </div>

          </section>

        </div>

      </main>
    </div>
  );
};

export default Dashboard;
