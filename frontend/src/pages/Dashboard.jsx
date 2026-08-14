import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const storedUser =
        localStorage.getItem("user") ||
        localStorage.getItem("currentUser");

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.warn("Unable to read user data");
    }
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleOutsideClick = (event) => {
      const sidebar =
        document.getElementById("office-sidebar");

      const menuButton =
        document.getElementById("office-menu-button");

      if (
        sidebar &&
        !sidebar.contains(event.target) &&
        menuButton &&
        !menuButton.contains(event.target)
      ) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [sidebarOpen]);

  const getUserName = () => {
    return (
      user?.name ||
      user?.fullName ||
      user?.username ||
      "User"
    );
  };

  const getUserRole = () => {
    return user?.role || "Manager";
  };

  const isAdmin =
    String(getUserRole()).toLowerCase() ===
    "admin";

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const goTo = (path) => {
    closeSidebar();
    navigate(path);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("currentUser");

    sessionStorage.clear();

    navigate("/login", {
      replace: true,
    });
  };

  const soon = () => {
    // Currently disabled modules.
  };

  return (
    <div className="office-dashboard">
      {/* =====================================================
          SIDEBAR OVERLAY
      ====================================================== */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
        />
      )}

      {/* =====================================================
          SIDEBAR
      ====================================================== */}
      <aside
        id="office-sidebar"
        className={`office-sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">
              🏢
            </div>

            <div>
              <div className="brand-title">
                Office Management
              </div>

              <div className="brand-subtitle">
                Business Management System
              </div>
            </div>
          </div>

          <button
            className="sidebar-close"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* =================================================
            MAIN MENU
        ================================================== */}
        <div className="sidebar-scroll">
          <div className="menu-section">
            <div className="menu-section-title">
              MAIN MENU
            </div>

            <button
              className="sidebar-item active"
              onClick={() =>
                goTo("/dashboard")
              }
            >
              <span className="menu-icon">
                🏠
              </span>

              <span className="menu-text">
                Dashboard
              </span>
            </button>

            <button
              className="sidebar-item"
              onClick={() =>
                goTo("/expenses")
              }
            >
              <span className="menu-icon">
                ₹
              </span>

              <span className="menu-text">
                Expenses
              </span>
            </button>

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                ✓
              </span>

              <span className="menu-text">
                Approvals
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>
          </div>

          {/* =================================================
              HR MANAGEMENT
          ================================================== */}
          <div className="menu-section">
            <div className="menu-section-title">
              HR MANAGEMENT
            </div>

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                👥
              </span>

              <span className="menu-text">
                Employees
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                ✓
              </span>

              <span className="menu-text">
                Attendance
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                📑
              </span>

              <span className="menu-text">
                Leave Management
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                🗓️
              </span>

              <span className="menu-text">
                Holiday Calendar
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                ⏱
              </span>

              <span className="menu-text">
                Shift Management
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>
          </div>

          {/* =================================================
              REPORTS
          ================================================== */}
          <div className="menu-section">
            <div className="menu-section-title">
              REPORTS
            </div>

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                ▦
              </span>

              <span className="menu-text">
                Attendance Reports
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                📄
              </span>

              <span className="menu-text">
                Leave Reports
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                ₹
              </span>

              <span className="menu-text">
                Salary Reports
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>
          </div>

          {/* =================================================
              ADMINISTRATION
          ================================================== */}
          <div className="menu-section">
            <div className="menu-section-title">
              ADMINISTRATION
            </div>

            {isAdmin && (
              <button
                className="sidebar-item"
                onClick={() =>
                  goTo("/users")
                }
              >
                <span className="menu-icon">
                  👤
                </span>

                <span className="menu-text">
                  User Management
                </span>
              </button>
            )}

            <button
              className="sidebar-item disabled"
              onClick={soon}
            >
              <span className="menu-icon">
                🔐
              </span>

              <span className="menu-text">
                Security
              </span>

              <span className="soon-badge">
                Soon
              </span>
            </button>
          </div>
        </div>

        {/* =================================================
            SIDEBAR FOOTER
        ================================================== */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              {getUserName()
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="sidebar-user-info">
              <strong>
                {getUserName()}
              </strong>

              <span>
                {getUserRole()}
              </span>
            </div>
          </div>

          <button
            className="sidebar-logout"
            onClick={logout}
          >
            <span>↪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN AREA
      ====================================================== */}
      <div className="dashboard-main">
        {/* =================================================
            TOP HEADER
        ================================================== */}
        <header className="dashboard-header">
          <div className="header-left">
            <button
              id="office-menu-button"
              className="menu-button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="header-brand">
              <strong>
                Office Management
              </strong>

              <span>
                Business Management System
              </span>
            </div>
          </div>

          <div className="header-right">
            <div className="header-user">
              <div className="header-avatar">
                {getUserName()
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="header-user-info">
                <strong>
                  {getUserName()}
                </strong>

                <span>
                  {getUserRole()}
                </span>
              </div>
            </div>

            <button
              className="header-logout"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </header>

        {/* =================================================
            CONTENT
        ================================================== */}
        <main className="dashboard-content">
          {/* Welcome Banner */}
          <section className="welcome-banner">
            <div>
              <div className="welcome-small">
                OFFICE MANAGEMENT
              </div>

              <h1>
                Welcome back,{" "}
                {getUserName()} 👋
              </h1>

              <p>
                Manage your office,
                employees, attendance,
                expenses and salary from
                one place.
              </p>
            </div>

            <div className="role-badge">
              {getUserRole()}
            </div>
          </section>

          {/* =================================================
              SUMMARY CARDS
          ================================================== */}
          <section className="summary-grid">
            <div className="summary-card">
              <div className="summary-icon">
                ₹
              </div>

              <div>
                <span>
                  Total Expenses
                </span>

                <strong>₹0</strong>

                <small>
                  This month
                </small>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">
                ✓
              </div>

              <div>
                <span>
                  Pending Approval
                </span>

                <strong>0</strong>

                <small>
                  Waiting for action
                </small>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">
                👥
              </div>

              <div>
                <span>
                  Total Employees
                </span>

                <strong>0</strong>

                <small>
                  Active employees
                </small>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">
                📋
              </div>

              <div>
                <span>
                  Pending Tasks
                </span>

                <strong>0</strong>

                <small>
                  Requires attention
                </small>
              </div>
            </div>
          </section>

          {/* =================================================
              QUICK ACCESS
          ================================================== */}
          <section className="quick-section">
            <div className="section-heading">
              <div>
                <h2>
                  Quick Access
                </h2>

                <p>
                  Frequently used modules
                </p>
              </div>
            </div>

            <div className="quick-grid">
              {/* Expenses */}
              <button
                className="quick-card"
                onClick={() =>
                  navigate("/expenses")
                }
              >
                <div className="quick-icon">
                  ₹
                </div>

                <div className="quick-content">
                  <strong>
                    Expenses
                  </strong>

                  <span>
                    Manage office expenses
                  </span>
                </div>

                <div className="quick-arrow">
                  →
                </div>
              </button>

              {/* Approvals */}
              <button
                className="quick-card disabled-card"
                onClick={soon}
              >
                <div className="quick-icon">
                  ✓
                </div>

                <div className="quick-content">
                  <strong>
                    Approvals
                  </strong>

                  <span>
                    Review pending approvals
                  </span>
                </div>

                <span className="card-soon">
                  Soon
                </span>
              </button>

              {/* Employees */}
              <button
                className="quick-card disabled-card"
                onClick={soon}
              >
                <div className="quick-icon">
                  👥
                </div>

                <div className="quick-content">
                  <strong>
                    Employees
                  </strong>

                  <span>
                    Manage employees
                  </span>
                </div>

                <span className="card-soon">
                  Soon
                </span>
              </button>

              {/* Reports */}
              <button
                className="quick-card disabled-card"
                onClick={soon}
              >
                <div className="quick-icon">
                  📊
                </div>

                <div className="quick-content">
                  <strong>
                    Reports
                  </strong>

                  <span>
                    View business reports
                  </span>
                </div>

                <span className="card-soon">
                  Soon
                </span>
              </button>
            </div>
          </section>

          {/* =================================================
              HR PREVIEW
          ================================================== */}
          <section className="hr-preview">
            <div className="hr-preview-header">
              <div>
                <span className="section-label">
                  HR MANAGEMENT
                </span>

                <h2>
                  Complete Employee
                  Management
                </h2>

                <p>
                  Attendance, leave,
                  holidays, shifts and
                  salary management will
                  be available here.
                </p>
              </div>

              <div className="hr-symbol">
                👥
              </div>
            </div>

            <div className="hr-feature-grid">
              <div className="hr-feature">
                <span>✓</span>
                <div>
                  <strong>
                    Attendance
                  </strong>
                  <small>
                    Daily & monthly
                  </small>
                </div>
              </div>

              <div className="hr-feature">
                <span>📅</span>
                <div>
                  <strong>
                    Leave
                  </strong>
                  <small>
                    Leave management
                  </small>
                </div>
              </div>

              <div className="hr-feature">
                <span>₹</span>
                <div>
                  <strong>
                    Salary
                  </strong>
                  <small>
                    Salary & deductions
                  </small>
                </div>
              </div>

              <div className="hr-feature">
                <span>🗓</span>
                <div>
                  <strong>
                    Holidays
                  </strong>
                  <small>
                    Holiday calendar
                  </small>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* =====================================================
          STYLES
      ====================================================== */}
      <style>{`
        * {
          box-sizing: border-box;
        }

        .office-dashboard {
          min-height: 100vh;
          background: #f5f7fb;
          color: #102a43;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Arial,
            sans-serif;
        }

        /* ================================================
           SIDEBAR
        ================================================= */

        .office-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 285px;
          height: 100vh;
          background: #ffffff;
          border-right: 1px solid #e5eaf0;
          z-index: 1000;
          transform: translateX(-105%);
          transition:
            transform 0.28s ease,
            box-shadow 0.28s ease;
          display: flex;
          flex-direction: column;
          box-shadow:
            10px 0 40px
            rgba(15, 23, 42, 0.08);
        }

        .office-sidebar.sidebar-open {
          transform: translateX(0);
          box-shadow:
            15px 0 50px
            rgba(15, 23, 42, 0.16);
        }

        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background:
            rgba(15, 23, 42, 0.35);
          z-index: 999;
          backdrop-filter: blur(2px);
        }

        .sidebar-header {
          min-height: 76px;
          padding: 16px 16px 14px 20px;
          border-bottom: 1px solid #edf0f4;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .brand-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #edf5ff;
          font-size: 20px;
          flex-shrink: 0;
        }

        .brand-title {
          font-size: 14px;
          font-weight: 800;
          color: #123b68;
        }

        .brand-subtitle {
          margin-top: 3px;
          font-size: 10px;
          color: #8290a3;
        }

        .sidebar-close {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 9px;
          background: #f2f5f8;
          color: #64748b;
          font-size: 22px;
          cursor: pointer;
        }

        .sidebar-close:hover {
          background: #e8edf3;
        }

        .sidebar-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 18px 12px 15px;
        }

        .menu-section {
          margin-bottom: 22px;
        }

        .menu-section-title {
          padding: 0 10px 9px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #8a98aa;
        }

        .sidebar-item {
          width: 100%;
          min-height: 46px;
          padding: 7px 10px;
          border: 0;
          border-radius: 11px;
          background: transparent;
          display: flex;
          align-items: center;
          gap: 11px;
          color: #65748a;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          margin-bottom: 4px;
          transition:
            background 0.18s ease,
            color 0.18s ease,
            transform 0.18s ease;
        }

        .sidebar-item:hover {
          background: #f3f7fc;
          color: #174f87;
        }

        .sidebar-item.active {
          background: #eaf3ff;
          color: #14558f;
          font-weight: 750;
        }

        .sidebar-item.disabled {
          opacity: 0.78;
        }

        .sidebar-item.disabled:hover {
          background: #f7f8fa;
          color: #65748a;
          transform: none;
        }

        .menu-icon {
          width: 31px;
          height: 31px;
          border-radius: 9px;
          background: #f2f6fb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        .sidebar-item.active .menu-icon {
          background: #dcecff;
        }

        .menu-text {
          flex: 1;
        }

        .soon-badge {
          padding: 3px 8px;
          border-radius: 20px;
          background: #f5f6f8;
          color: #a5afbc;
          font-size: 9px;
          font-weight: 700;
        }

        .sidebar-footer {
          border-top: 1px solid #edf0f4;
          padding: 13px;
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 11px;
          padding: 7px;
        }

        .user-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #dcecff;
          color: #15548d;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }

        .sidebar-user-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .sidebar-user-info strong {
          color: #183b61;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-user-info span {
          margin-top: 3px;
          color: #8b98a9;
          font-size: 10px;
        }

        .sidebar-logout {
          width: 100%;
          height: 40px;
          border: 1px solid #e8edf2;
          border-radius: 10px;
          background: #fff;
          color: #6b7789;
          cursor: pointer;
          font-weight: 650;
          font-size: 12px;
        }

        .sidebar-logout:hover {
          background: #f7f9fb;
          color: #174f87;
        }

        .sidebar-logout span {
          margin-right: 7px;
        }

        /* ================================================
           MAIN
        ================================================= */

        .dashboard-main {
          min-height: 100vh;
        }

        .dashboard-header {
          height: 76px;
          padding: 0 28px;
          background: #ffffff;
          border-bottom: 1px solid #e6eaf0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .menu-button {
          width: 43px;
          height: 43px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          background: #fff;
          color: #174f87;
          font-size: 22px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            0 3px 10px
            rgba(15, 23, 42, 0.04);
        }

        .menu-button:hover {
          background: #f3f7fc;
        }

        .header-brand {
          display: flex;
          flex-direction: column;
        }

        .header-brand strong {
          color: #123b68;
          font-size: 16px;
        }

        .header-brand span {
          color: #8a98aa;
          font-size: 10px;
          margin-top: 3px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .header-user {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .header-avatar {
          width: 37px;
          height: 37px;
          border-radius: 50%;
          background: #e8f2ff;
          color: #14558f;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
        }

        .header-user-info {
          display: flex;
          flex-direction: column;
          text-align: right;
        }

        .header-user-info strong {
          color: #153d65;
          font-size: 12px;
        }

        .header-user-info span {
          color: #8996a8;
          font-size: 10px;
          margin-top: 2px;
        }

        .header-logout {
          height: 38px;
          padding: 0 16px;
          border: 0;
          border-radius: 10px;
          background: #edf3f9;
          color: #184f84;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .header-logout:hover {
          background: #e1ebf5;
        }

        /* ================================================
           CONTENT
        ================================================= */

        .dashboard-content {
          max-width: 1380px;
          margin: 0 auto;
          padding: 38px 28px 60px;
        }

        .welcome-banner {
          min-height: 154px;
          padding: 28px 30px;
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              #1d558e 0%,
              #245f9b 55%,
              #17497d 100%
            );
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow:
            0 15px 35px
            rgba(29, 85, 142, 0.18);
        }

        .welcome-small {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.4px;
          opacity: 0.72;
          margin-bottom: 7px;
        }

        .welcome-banner h1 {
          margin: 0;
          font-size: 25px;
          line-height: 1.25;
        }

        .welcome-banner p {
          margin: 8px 0 0;
          font-size: 13px;
          opacity: 0.85;
          max-width: 600px;
        }

        .role-badge {
          padding: 10px 17px;
          border-radius: 25px;
          background:
            rgba(255,255,255,0.14);
          border:
            1px solid
            rgba(255,255,255,0.16);
          font-size: 12px;
          font-weight: 750;
          flex-shrink: 0;
        }

        /* ================================================
           SUMMARY
        ================================================= */

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin-top: 23px;
        }

        .summary-card {
          min-height: 138px;
          background: #fff;
          border: 1px solid #e1e7ee;
          border-radius: 16px;
          padding: 21px;
          display: flex;
          align-items: center;
          gap: 15px;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .summary-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 12px 28px
            rgba(15, 23, 42, 0.07);
        }

        .summary-icon {
          width: 48px;
          height: 48px;
          border-radius: 13px;
          background: #edf5ff;
          color: #1760a0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .summary-card > div:last-child {
          display: flex;
          flex-direction: column;
        }

        .summary-card span {
          color: #66768a;
          font-size: 11px;
        }

        .summary-card strong {
          color: #123f6d;
          font-size: 25px;
          line-height: 1.15;
          margin-top: 6px;
        }

        .summary-card small {
          color: #99a4b3;
          font-size: 10px;
          margin-top: 5px;
        }

        /* ================================================
           QUICK ACCESS
        ================================================= */

        .quick-section {
          margin-top: 36px;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .section-heading h2 {
          margin: 0;
          color: #123b68;
          font-size: 19px;
        }

        .section-heading p {
          margin: 4px 0 0;
          color: #8b98a9;
          font-size: 11px;
        }

        .quick-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 17px;
        }

        .quick-card {
          min-height: 108px;
          border: 1px solid #e1e7ee;
          border-radius: 15px;
          background: #fff;
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 13px;
          text-align: left;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .quick-card:hover {
          transform: translateY(-2px);
          border-color: #cbdced;
          box-shadow:
            0 12px 26px
            rgba(15, 23, 42, 0.07);
        }

        .quick-icon {
          width: 44px;
          height: 44px;
          border-radius: 11px;
          background: #edf5ff;
          color: #1760a0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          flex-shrink: 0;
        }

        .quick-content {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .quick-content strong {
          color: #143c65;
          font-size: 13px;
        }

        .quick-content span {
          color: #8290a3;
          font-size: 10px;
          margin-top: 4px;
        }

        .quick-arrow {
          color: #91a0b1;
          font-size: 18px;
        }

        .disabled-card {
          cursor: default;
        }

        .disabled-card:hover {
          transform: none;
          border-color: #e1e7ee;
        }

        .card-soon {
          padding: 4px 8px;
          border-radius: 20px;
          background: #f4f6f8;
          color: #a1abb8;
          font-size: 9px;
          font-weight: 700;
        }

        /* ================================================
           HR PREVIEW
        ================================================= */

        .hr-preview {
          margin-top: 28px;
          background: #fff;
          border: 1px solid #e1e7ee;
          border-radius: 18px;
          padding: 25px;
        }

        .hr-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .section-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
          color: #8b98a9;
        }

        .hr-preview h2 {
          margin: 6px 0 5px;
          color: #153e67;
          font-size: 19px;
        }

        .hr-preview-header p {
          margin: 0;
          color: #8794a5;
          font-size: 11px;
          max-width: 650px;
          line-height: 1.6;
        }

        .hr-symbol {
          width: 58px;
          height: 58px;
          border-radius: 15px;
          background: #edf5ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        .hr-feature-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 22px;
        }

        .hr-feature {
          padding: 14px;
          border-radius: 12px;
          background: #f8fafc;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .hr-feature > span {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        .hr-feature div {
          display: flex;
          flex-direction: column;
        }

        .hr-feature strong {
          color: #31506f;
          font-size: 11px;
        }

        .hr-feature small {
          color: #99a4b2;
          font-size: 9px;
          margin-top: 3px;
        }

        /* ================================================
           TABLET
        ================================================= */

        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .quick-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .hr-feature-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        /* ================================================
           MOBILE
        ================================================= */

        @media (max-width: 700px) {
          .dashboard-header {
            height: 66px;
            padding: 0 14px;
          }

          .header-brand span {
            display: none;
          }

          .header-brand strong {
            font-size: 13px;
          }

          .header-user-info {
            display: none;
          }

          .header-logout {
            padding: 0 11px;
            font-size: 11px;
          }

          .menu-button {
            width: 39px;
            height: 39px;
          }

          .dashboard-content {
            padding: 20px 14px 40px;
          }

          .welcome-banner {
            padding: 22px;
            min-height: auto;
            align-items: flex-start;
            gap: 18px;
          }

          .welcome-banner h1 {
            font-size: 21px;
          }

          .welcome-banner p {
            font-size: 11px;
            line-height: 1.55;
          }

          .role-badge {
            display: none;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .summary-card {
            min-height: 115px;
            padding: 14px;
            gap: 9px;
          }

          .summary-icon {
            width: 38px;
            height: 38px;
            font-size: 15px;
          }

          .summary-card span {
            font-size: 9px;
          }

          .summary-card strong {
            font-size: 20px;
          }

          .summary-card small {
            font-size: 8px;
          }

          .quick-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .quick-card {
            min-height: 85px;
          }

          .hr-feature-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .hr-preview {
            padding: 18px;
          }

          .hr-preview-header {
            align-items: flex-start;
          }

          .hr-symbol {
            display: none;
          }

          .office-sidebar {
            width: min(285px, 88vw);
          }
        }

        @media (max-width: 430px) {
          .header-right {
            gap: 7px;
          }

          .header-avatar {
            display: none;
          }

          .summary-card {
            padding: 11px;
          }

          .summary-icon {
            display: none;
          }

          .hr-feature {
            padding: 11px;
          }
        }
      `}</style>
    </div>
  );
}
