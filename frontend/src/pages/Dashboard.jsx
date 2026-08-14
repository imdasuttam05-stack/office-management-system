import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebarRef = useRef(null);

  const userData =
    localStorage.getItem("user");

  let user = {};

  try {
    user = JSON.parse(
      userData || "{}"
    );
  } catch {
    user = {};
  }

  const role =
    user.role || "Employee";

  const isAdmin =
    role === "Admin";

  /* =====================================================
     NAVIGATION
  ===================================================== */

  const go = (path) => {
    setSidebarOpen(false);
    navigate(path);
  };

  /* =====================================================
     LOGOUT
  ===================================================== */

  const logout = () => {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    navigate("/login", {
      replace: true,
    });
  };

  /* =====================================================
     CLOSE SIDEBAR
  ===================================================== */

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.key === "Escape"
      ) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  /* =====================================================
     SIDEBAR MENU
  ===================================================== */

  const mainMenu = [
    {
      label: "Dashboard",
      icon: "⌂",
      path: "/dashboard",
      active: true,
    },

    {
      label: "Expenses",
      icon: "₹",
      path: "/expenses",
      active: true,
    },

    {
      label: "Payroll",
      icon: "₹",
      path: "/payroll",
      active: true,
    },
  ];

  const hrMenu = [
    {
      label: "Employees",
      icon: "👥",
      path: null,
    },

    {
      label: "Attendance",
      icon: "✓",
      path: null,
    },

    {
      label: "Leave Management",
      icon: "📝",
      path: null,
    },

    {
      label: "Holiday Calendar",
      icon: "📅",
      path: null,
    },

    {
      label: "Shift Management",
      icon: "⏱",
      path: null,
    },
  ];

  const reportMenu = [
    {
      label: "Attendance Reports",
      icon: "▦",
      path: null,
    },

    {
      label: "Leave Reports",
      icon: "📋",
      path: null,
    },

    {
      label: "Salary Reports",
      icon: "₹",
      path: null,
    },
  ];

  /* =====================================================
     MENU ITEM
  ===================================================== */

  const renderMenuItem = (
    item,
    index
  ) => {
    const disabled =
      !item.active &&
      !item.path;

    return (
      <button
        key={`${item.label}-${index}`}
        type="button"
        className={`side-item ${
          disabled
            ? "disabled"
            : ""
        }`}
        disabled={disabled}
        onClick={() => {
          if (item.path) {
            go(item.path);
          }
        }}
      >
        <span className="side-icon">
          {item.icon}
        </span>

        <span className="side-label">
          {item.label}
        </span>

        {disabled && (
          <span className="coming-soon">
            Soon
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="dashboard">

      {/* =================================================
          OVERLAY
      ================================================= */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        ref={sidebarRef}
        className={`sidebar ${
          sidebarOpen
            ? "open"
            : ""
        }`}
      >

        {/* SIDEBAR HEADER */}

        <div className="sidebar-top">
          <div>
            <h2>
              Office Management
            </h2>

            <span>
              {role} Panel
            </span>
          </div>

          <button
            type="button"
            className="sidebar-close"
            onClick={() =>
              setSidebarOpen(false)
            }
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* MAIN MENU */}

        <div className="sidebar-section">
          <div className="sidebar-heading">
            MAIN
          </div>

          <nav className="sidebar-nav">
            {mainMenu.map(
              renderMenuItem
            )}
          </nav>
        </div>

        {/* HR MENU */}

        <div className="sidebar-section">
          <div className="sidebar-heading">
            HR MANAGEMENT
          </div>

          <nav className="sidebar-nav">
            {hrMenu.map(
              renderMenuItem
            )}
          </nav>
        </div>

        {/* REPORTS */}

        <div className="sidebar-section">
          <div className="sidebar-heading">
            REPORTS
          </div>

          <nav className="sidebar-nav">
            {reportMenu.map(
              renderMenuItem
            )}
          </nav>
        </div>

        {/* ADMIN */}

        {isAdmin && (
          <div className="sidebar-section">
            <div className="sidebar-heading">
              ADMINISTRATION
            </div>

            <nav className="sidebar-nav">
              {renderMenuItem({
                label:
                  "User Management",
                icon: "👤",
                path: "/users",
                active: true,
              }, 99)}
            </nav>
          </div>
        )}

        {/* LOGOUT */}

        <div className="sidebar-bottom">
          <button
            type="button"
            className="side-logout"
            onClick={logout}
          >
            <span className="side-icon logout-icon">
              ↪
            </span>

            <span>
              Logout
            </span>
          </button>
        </div>

      </aside>

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="dashboard-header">

        <div className="header-left">

          <button
            type="button"
            className="menu-btn"
            onClick={() =>
              setSidebarOpen(true)
            }
            aria-label="Open menu"
            title="Open menu"
          >
            <span />
            <span />
            <span />
          </button>

          <div>
            <h1>
              Office Management
            </h1>

            <p>
              Business Management System
            </p>
          </div>

        </div>

        <div className="user-section">

          <div className="user-info">

            <strong>
              {user.name ||
                "User"}
            </strong>

            <span>
              {role}
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

      {/* =================================================
          CONTENT
      ================================================= */}

      <main className="dashboard-content">

        {/* =================================================
            WELCOME
        ================================================= */}

        <section className="welcome-card">

          <div>

            <div className="welcome-small">
              OFFICE MANAGEMENT SYSTEM
            </div>

            <h2>
              Welcome back,{" "}
              {user.name ||
                "User"} 👋
            </h2>

            <p>
              Manage expenses, employees,
              attendance and payroll from
              one place.
            </p>

          </div>

          <div className="role-area">

            <span className="role-label">
              Current Role
            </span>

            <div className="role-badge">
              {role}
            </div>

          </div>

        </section>

        {/* =================================================
            STATISTICS
        ================================================= */}

        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon">
              ₹
            </div>

            <div className="stat-content">
              <span>
                Total Expenses
              </span>

              <strong>
                ₹0
              </strong>

              <small>
                This month
              </small>
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              ✓
            </div>

            <div className="stat-content">
              <span>
                Present Today
              </span>

              <strong>
                0
              </strong>

              <small>
                Attendance
              </small>
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              👥
            </div>

            <div className="stat-content">
              <span>
                Employees
              </span>

              <strong>
                0
              </strong>

              <small>
                Active employees
              </small>
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              ₹
            </div>

            <div className="stat-content">
              <span>
                Monthly Payroll
              </span>

              <strong>
                ₹0
              </strong>

              <small>
                Current month
              </small>
            </div>

          </div>

        </section>

        {/* =================================================
            QUICK ACCESS
        ================================================= */}

        <section className="modules-section">

          <div className="section-header">

            <div>
              <span className="section-kicker">
                QUICK ACCESS
              </span>

              <h2>
                Your Workspace
              </h2>

              <p>
                Frequently used office modules
              </p>
            </div>

            <button
              type="button"
              className="open-menu-link"
              onClick={() =>
                setSidebarOpen(true)
              }
            >
              ☰ Open Menu
            </button>

          </div>

          <div className="modules-grid">

            {/* EXPENSE */}

            <div
              className="module-card clickable"
              onClick={() =>
                go("/expenses")
              }
            >
              <div className="module-icon expense">
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

              <span className="card-arrow">
                →
              </span>

            </div>

            {/* PAYROLL */}

            <div
              className="module-card clickable"
              onClick={() =>
                go("/payroll")
              }
            >
              <div className="module-icon payroll">
                ₹
              </div>

              <div>
                <h3>
                  Payroll
                </h3>

                <p>
                  Salary, additions and deductions
                </p>
              </div>

              <span className="card-arrow">
                →
              </span>

            </div>

            {/* ATTENDANCE */}

            <div
              className="module-card"
            >
              <div className="module-icon attendance">
                ✓
              </div>

              <div>
                <h3>
                  Attendance
                </h3>

                <p>
                  Daily and monthly attendance
                </p>

                <span className="soon-badge">
                  Coming Soon
                </span>
              </div>
            </div>

            {/* LEAVE */}

            <div
              className="module-card"
            >
              <div className="module-icon leave">
                📝
              </div>

              <div>
                <h3>
                  Leave Management
                </h3>

                <p>
                  Leave requests and approvals
                </p>

                <span className="soon-badge">
                  Coming Soon
                </span>
              </div>
            </div>

            {/* HOLIDAY */}

            <div
              className="module-card"
            >
              <div className="module-icon holiday">
                📅
              </div>

              <div>
                <h3>
                  Holiday Calendar
                </h3>

                <p>
                  Holidays and weekly offs
                </p>

                <span className="soon-badge">
                  Coming Soon
                </span>
              </div>
            </div>

            {/* EMPLOYEES */}

            <div
              className="module-card"
            >
              <div className="module-icon employees">
                👥
              </div>

              <div>
                <h3>
                  Employees
                </h3>

                <p>
                  Employee master and profile
                </p>

                <span className="soon-badge">
                  Coming Soon
                </span>
              </div>
            </div>

            {/* USER MANAGEMENT */}

            {isAdmin && (
              <div
                className="module-card clickable admin-card"
                onClick={() =>
                  go("/users")
                }
              >
                <div className="module-icon users">
                  👤
                </div>

                <div>
                  <h3>
                    User Management
                  </h3>

                  <p>
                    Create and manage users
                  </p>
                </div>

                <span className="card-arrow">
                  →
                </span>
              </div>
            )}

          </div>

        </section>

        {/* =================================================
            ATTENDANCE PREVIEW
        ================================================= */}

        <section className="attendance-preview">

          <div className="attendance-preview-header">

            <div>
              <span className="section-kicker">
                ATTENDANCE
              </span>

              <h2>
                Today's Attendance
              </h2>
            </div>

            <span className="preview-badge">
              Coming Soon
            </span>

          </div>

          <div className="attendance-bars">

            <div className="attendance-row">
              <span>
                Present
              </span>

              <div className="progress">
                <div
                  className="progress-present"
                  style={{
                    width: "0%",
                  }}
                />
              </div>

              <strong>
                0
              </strong>
            </div>

            <div className="attendance-row">
              <span>
                Leave
              </span>

              <div className="progress">
                <div
                  className="progress-leave"
                  style={{
                    width: "0%",
                  }}
                />
              </div>

              <strong>
                0
              </strong>
            </div>

            <div className="attendance-row">
              <span>
                Absent
              </span>

              <div className="progress">
                <div
                  className="progress-absent"
                  style={{
                    width: "0%",
                  }}
                />
              </div>

              <strong>
                0
              </strong>
            </div>

          </div>

        </section>

      </main>

      {/* =================================================
          STYLES
      ================================================= */}

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

          background:
            #f5f7fb;

          color:
            #172b4d;
        }

        .dashboard {
          min-height: 100vh;

          background:
            #f5f7fb;
        }

        /* =============================================
           HEADER
        ============================================== */

        .dashboard-header {
          min-height: 76px;

          background:
            #ffffff;

          border-bottom:
            1px solid #e4e7ec;

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          padding:
            0 32px;

          position:
            sticky;

          top: 0;

          z-index: 20;
        }

        .header-left {
          display:
            flex;

          align-items:
            center;

          gap:
            14px;
        }

        .dashboard-header h1 {
          margin:
            0;

          font-size:
            21px;

          color:
            #173b68;
        }

        .dashboard-header p {
          margin:
            4px 0 0;

          color:
            #667085;

          font-size:
            13px;
        }

        /* =============================================
           MENU BUTTON
        ============================================== */

        .menu-btn {
          width:
            42px;

          height:
            42px;

          border:
            1px solid #d0d5dd;

          border-radius:
            10px;

          background:
            #ffffff;

          cursor:
            pointer;

          display:
            flex;

          flex-direction:
            column;

          justify-content:
            center;

          align-items:
            center;

          gap:
            4px;

          transition:
            all .2s ease;
        }

        .menu-btn:hover {
          background:
            #eef4fb;

          border-color:
            #b8cde4;
        }

        .menu-btn span {
          width:
            18px;

          height:
            2px;

          background:
            #173b68;

          border-radius:
            3px;
        }

        /* =============================================
           USER SECTION
        ============================================== */

        .user-section {
          display:
            flex;

          align-items:
            center;

          gap:
            20px;
        }

        .user-info {
          display:
            flex;

          flex-direction:
            column;

          align-items:
            flex-end;
        }

        .user-info strong {
          font-size:
            14px;
        }

        .user-info span {
          margin-top:
            3px;

          font-size:
            12px;

          color:
            #245a96;
        }

        .logout-btn {
          border:
            none;

          background:
            #eef3f8;

          color:
            #245a96;

          padding:
            9px 16px;

          border-radius:
            8px;

          font-weight:
            600;

          cursor:
            pointer;
        }

        /* =============================================
           SIDEBAR OVERLAY
        ============================================== */

        .sidebar-overlay {
          position:
            fixed;

          inset:
            0;

          background:
            rgba(
              15,
              23,
              42,
              .36
            );

          z-index:
            40;
        }

        /* =============================================
           SIDEBAR
        ============================================== */

        .sidebar {
          position:
            fixed;

          top:
            0;

          left:
            0;

          bottom:
            0;

          width:
            300px;

          background:
            #ffffff;

          box-shadow:
            14px 0 40px
            rgba(
              15,
              23,
              42,
              .16
            );

          transform:
            translateX(
              -105%
            );

          transition:
            transform
            .22s
            ease;

          z-index:
            50;

          display:
            flex;

          flex-direction:
            column;

          padding:
            22px 16px 16px;

          overflow-y:
            auto;
        }

        .sidebar.open {
          transform:
            translateX(0);
        }

        .sidebar-top {
          display:
            flex;

          align-items:
            flex-start;

          justify-content:
            space-between;

          padding:
            6px 10px 20px;

          border-bottom:
            1px solid #eaecf0;
        }

        .sidebar-top h2 {
          margin:
            0;

          font-size:
            18px;

          color:
            #173b68;
        }

        .sidebar-top span {
          display:
            block;

          margin-top:
            5px;

          color:
            #667085;

          font-size:
            12px;
        }

        .sidebar-close {
          border:
            none;

          background:
            #f2f4f7;

          width:
            34px;

          height:
            34px;

          border-radius:
            8px;

          font-size:
            23px;

          cursor:
            pointer;
        }

        .sidebar-section {
          margin-top:
            20px;
        }

        .sidebar-heading {
          padding:
            0 10px 8px;

          font-size:
            10px;

          font-weight:
            800;

          letter-spacing:
            1px;

          color:
            #98a2b3;
        }

        .sidebar-nav {
          display:
            grid;

          gap:
            5px;
        }

        .side-item {
          width:
            100%;

          border:
            none;

          background:
            transparent;

          color:
            #344054;

          padding:
            11px 10px;

          border-radius:
            10px;

          display:
            flex;

          align-items:
            center;

          gap:
            10px;

          text-align:
            left;

          font-size:
            13px;

          font-weight:
            600;

          cursor:
            pointer;

          transition:
            .15s ease;
        }

        .side-item:hover:not(
          :disabled
        ) {
          background:
            #eef4fb;

          color:
            #173b68;
        }

        .side-item:disabled {
          cursor:
            default;

          opacity:
            .65;
        }

        .side-icon {
          width:
            30px;

          height:
            30px;

          display:
            inline-flex;

          align-items:
            center;

          justify-content:
            center;

          border-radius:
            8px;

          background:
            #eef4fb;

          color:
            #245a96;

          flex-shrink:
            0;
        }

        .side-label {
          flex:
            1;
        }

        .coming-soon {
          font-size:
            9px;

          background:
            #f2f4f7;

          color:
            #98a2b3;

          padding:
            3px 6px;

          border-radius:
            10px;
        }

        .sidebar-bottom {
          margin-top:
            auto;

          padding-top:
            20px;
        }

        .side-logout {
          width:
            100%;

          border:
            none;

          background:
            #fef3f2;

          color:
            #b42318;

          padding:
            12px;

          border-radius:
            10px;

          display:
            flex;

          align-items:
            center;

          gap:
            10px;

          font-weight:
            700;

          cursor:
            pointer;
        }

        .logout-icon {
          color:
            #b42318;

          background:
            #ffffff;
        }

        /* =============================================
           CONTENT
        ============================================== */

        .dashboard-content {
          width:
            100%;

          max-width:
            1400px;

          margin:
            0 auto;

          padding:
            34px 32px;
        }

        /* =============================================
           WELCOME
        ============================================== */

        .welcome-card {
          background:
            linear-gradient(
              135deg,
              #245a96,
              #174579
            );

          color:
            #ffffff;

          border-radius:
            18px;

          padding:
            28px;

          display:
            flex;

          justify-content:
            space-between;

          align-items:
            center;

          box-shadow:
            0 12px 30px
            rgba(
              36,
              90,
              150,
              .14
            );
        }

        .welcome-small {
          font-size:
            10px;

          font-weight:
            700;

          letter-spacing:
            1px;

          opacity:
            .7;

          margin-bottom:
            8px;
        }

        .welcome-card h2 {
          margin:
            0;

          font-size:
            24px;
        }

        .welcome-card p {
          margin:
            8px 0 0;

          font-size:
            14px;

          opacity:
            .88;
        }

        .role-area {
          text-align:
            right;
        }

        .role-label {
          display:
            block;

          font-size:
            11px;

          opacity:
            .7;

          margin-bottom:
            6px;
        }

        .role-badge {
          display:
            inline-block;

          padding:
            8px 14px;

          border-radius:
            20px;

          background:
            rgba(
              255,
              255,
              255,
              .15
            );

          font-size:
            13px;

          font-weight:
            700;
        }

        /* =============================================
           STATISTICS
        ============================================== */

        .stats-grid {
          display:
            grid;

          grid-template-columns:
            repeat(4, 1fr);

          gap:
            18px;

          margin-top:
            24px;
        }

        .stat-card {
          background:
            #ffffff;

          border:
            1px solid #e4e7ec;

          border-radius:
            14px;

          padding:
            19px;

          display:
            flex;

          align-items:
            center;

          gap:
            13px;

          transition:
            .2s ease;
        }

        .stat-card:hover {
          transform:
            translateY(
              -2px
            );

          box-shadow:
            0 8px 24px
            rgba(
              0,
              0,
              0,
              .05
            );
        }

        .stat-icon {
          width:
            42px;

          height:
            42px;

          border-radius:
            11px;

          background:
            #eef4fb;

          color:
            #245a96;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          font-weight:
            800;

          font-size:
            17px;
        }

        .stat-content span {
          display:
            block;

          color:
            #667085;

          font-size:
            12px;
        }

        .stat-content strong {
          display:
            block;

          margin-top:
            5px;

          font-size:
            23px;

          color:
            #173b68;
        }

        .stat-content small {
          display:
            block;

          margin-top:
            3px;

          color:
            #98a2b3;

          font-size:
            10px;
        }

        /* =============================================
           SECTION
        ============================================== */

        .modules-section {
          margin-top:
            34px;
        }

        .section-header {
          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          margin-bottom:
            16px;
        }

        .section-kicker {
          font-size:
            10px;

          font-weight:
            800;

          letter-spacing:
            1px;

          color:
            #98a2b3;
        }

        .section-header h2 {
          margin:
            4px 0 4px;

          font-size:
            20px;
        }

        .section-header p {
          margin:
            0;

          color:
            #667085;

          font-size:
            12px;
        }

        .open-menu-link {
          border:
            1px solid #d0d5dd;

          background:
            #ffffff;

          color:
            #245a96;

          border-radius:
            9px;

          padding:
            9px 13px;

          cursor:
            pointer;

          font-weight:
            700;
        }

        /* =============================================
           MODULES
        ============================================== */

        .modules-grid {
          display:
            grid;

          grid-template-columns:
            repeat(3, 1fr);

          gap:
            18px;
        }

        .module-card {
          background:
            #ffffff;

          border:
            1px solid #e4e7ec;

          border-radius:
            15px;

          padding:
            20px;

          display:
            flex;

          align-items:
            center;

          gap:
            14px;

          min-height:
            105px;

          position:
            relative;
        }

        .module-card.clickable {
          cursor:
            pointer;

          transition:
            .2s ease;
        }

        .module-card.clickable:hover {
          transform:
            translateY(
              -3px
            );

          border-color:
            #c7d8eb;

          box-shadow:
            0 10px 24px
            rgba(
              36,
              90,
              150,
              .08
            );
        }

        .module-icon {
          width:
            46px;

          height:
            46px;

          border-radius:
            12px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          flex-shrink:
            0;

          font-weight:
            800;
        }

        .module-icon.expense {
          background:
            #eef4fb;

          color:
            #245a96;
        }

        .module-icon.payroll {
          background:
            #f2f4ff;

          color:
            #5148a8;
        }

        .module-icon.attendance {
          background:
            #ecfdf3;

          color:
            #027a48;
        }

        .module-icon.leave {
          background:
            #fffaeb;

          color:
            #b54708;
        }

        .module-icon.holiday {
          background:
            #fdf2fa;

          color:
            #c11574;
        }

        .module-icon.employees {
          background:
            #eef4fb;

          color:
            #245a96;
        }

        .module-icon.users {
          background:
            #eef4fb;

          color:
            #245a96;
        }

        .module-card h3 {
          margin:
            0;

          font-size:
            15px;
        }

        .module-card p {
          margin:
            5px 0 0;

          color:
            #667085;

          font-size:
            12px;
        }

        .card-arrow {
          margin-left:
            auto;

          color:
            #98a2b3;

          font-size:
            18px;
        }

        .soon-badge {
          display:
            inline-block;

          margin-top:
            7px;

          padding:
            3px 7px;

          background:
            #f2f4f7;

          color:
            #667085;

          border-radius:
            8px;

          font-size:
            9px;

          font-weight:
            700;
        }

        .admin-card {
          border-color:
            #c7d8eb;
        }

        /* =============================================
           ATTENDANCE PREVIEW
        ============================================== */

        .attendance-preview {
          margin-top:
            25px;

          background:
            #ffffff;

          border:
            1px solid #e4e7ec;

          border-radius:
            16px;

          padding:
            22px;
        }

        .attendance-preview-header {
          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;
        }

        .attendance-preview-header h2 {
          margin:
            4px 0 0;

          font-size:
            18px;
        }

        .preview-badge {
          padding:
            5px 9px;

          border-radius:
            10px;

          background:
            #f2f4f7;

          color:
            #667085;

          font-size:
            10px;

          font-weight:
            700;
        }

        .attendance-bars {
          margin-top:
            20px;

          display:
            grid;

          gap:
            13px;
        }

        .attendance-row {
          display:
            grid;

          grid-template-columns:
            100px 1fr 35px;

          gap:
            12px;

          align-items:
            center;

          font-size:
            12px;
        }

        .progress {
          height:
            8px;

          background:
            #eef2f6;

          border-radius:
            10px;

          overflow:
            hidden;
        }

        .progress-present {
          height:
            100%;

          background:
            #12b76a;

          border-radius:
            10px;
        }

        .progress-leave {
          height:
            100%;

          background:
            #f79009;

          border-radius:
            10px;
        }

        .progress-absent {
          height:
            100%;

          background:
            #f04438;

          border-radius:
            10px;
        }

        /* =============================================
           RESPONSIVE
        ============================================== */

        @media (
          max-width: 1050px
        ) {

          .stats-grid {
            grid-template-columns:
              repeat(
                2,
                1fr
              );
          }

          .modules-grid {
            grid-template-columns:
              repeat(
                2,
                1fr
              );
          }

        }

        @media (
          max-width: 650px
        ) {

          .dashboard-header {
            padding:
              0 16px;
          }

          .dashboard-content {
            padding:
              18px 16px;
          }

          .user-info {
            display:
              none;
          }

          .welcome-card {
            padding:
              21px;

            flex-direction:
              column;

            align-items:
              flex-start;

            gap:
              16px;
          }

          .role-area {
            text-align:
              left;
          }

          .stats-grid,
          .modules-grid {
            grid-template-columns:
              1fr;
          }

          .section-header {
            align-items:
              flex-start;

            gap:
              12px;

            flex-direction:
              column;
          }

          .sidebar {
            width:
              min(
                88vw,
                310px
              );
          }

          .attendance-row {
            grid-template-columns:
              78px 1fr 30px;
          }

        }

      `}</style>

    </div>
  );
}

export default Dashboard;
