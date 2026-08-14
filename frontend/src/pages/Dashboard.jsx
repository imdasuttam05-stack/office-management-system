import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";

/* =========================================================
   AUTH HELPERS
========================================================= */

function getStoredUser() {
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("currentUser");

    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

/* =========================================================
   ICON
========================================================= */

function Icon({ children }) {
  return (
    <span className="side-icon">
      {children}
    </span>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

export default function Dashboard() {
  const navigate = useNavigate();

  const sidebarRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [user, setUser] = useState(
    getStoredUser()
  );

  const [expenseTotal, setExpenseTotal] =
    useState(0);

  const [pendingApproval, setPendingApproval] =
    useState(0);

  const [employeeCount, setEmployeeCount] =
    useState(0);

  const [pendingTasks, setPendingTasks] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  /* =======================================================
     USER
  ======================================================= */

  useEffect(() => {
    const storedUser = getStoredUser();

    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  /* =======================================================
     CLOSE SIDEBAR ON OUTSIDE CLICK
  ======================================================= */

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!sidebarOpen) return;

      const sidebar =
        sidebarRef.current;

      const menuButton =
        document.querySelector(
          ".dashboard-menu-btn"
        );

      if (
        sidebar &&
        !sidebar.contains(
          event.target
        ) &&
        !menuButton?.contains(
          event.target
        )
      ) {
        setSidebarOpen(false);
      }
    }

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

  /* =======================================================
     ESC CLOSE
  ======================================================= */

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  /* =======================================================
     LOAD DASHBOARD DATA
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);

      const token = getToken();

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/expenses`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
          }
        );

        if (response.status === 401) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Failed to load expenses"
          );
        }

        const data =
          await response.json();

        if (cancelled) return;

        const expenses =
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.expenses
              )
            ? data.expenses
            : Array.isArray(
                data?.data
              )
            ? data.data
            : [];

        let total = 0;
        let pending = 0;

        expenses.forEach(
          (expense) => {
            const amount =
              Number(
                expense?.amount
              ) || 0;

            total += amount;

            const status =
              String(
                expense?.status ||
                  expense?.approvalStatus ||
                  ""
              ).toLowerCase();

            if (
              status === "pending" ||
              status === "pending approval"
            ) {
              pending += 1;
            }
          }
        );

        setExpenseTotal(total);
        setPendingApproval(pending);
      } catch (error) {
        console.error(
          "Dashboard expense error:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     USER NAME / ROLE
  ======================================================= */

  const userName =
    user?.name ||
    user?.fullName ||
    user?.username ||
    "User";

  const userRole =
    user?.role ||
    "Employee";

  const isAdmin =
    String(userRole).toLowerCase() ===
    "admin";

  /* =======================================================
     NAVIGATION
  ======================================================= */

  function goTo(path) {
    setSidebarOpen(false);
    navigate(path);
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  function handleLogout() {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "accessToken"
    );

    localStorage.removeItem(
      "refreshToken"
    );

    localStorage.removeItem(
      "user"
    );

    localStorage.removeItem(
      "currentUser"
    );

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  }

  /* =======================================================
     FORMAT MONEY
  ======================================================= */

  function formatMoney(value) {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }
    ).format(value || 0);
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="dashboard">

      {/* ===================================================
          SIDEBAR OVERLAY
      =================================================== */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside
        ref={sidebarRef}
        className={`sidebar ${
          sidebarOpen
            ? "sidebar-open"
            : ""
        }`}
      >
        {/* Sidebar Header */}

        <div className="sidebar-top">
          <div>
            <div className="sidebar-brand">
              Office Management
            </div>

            <div className="sidebar-subtitle">
              Business Management System
            </div>
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

        {/* =================================================
            MAIN
        ================================================= */}

        <div className="sidebar-section">
          <div className="sidebar-heading">
            MAIN
          </div>

          <div className="sidebar-nav">

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/dashboard")
              }
            >
              <Icon>⌂</Icon>

              <span className="side-label">
                Dashboard
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/expenses")
              }
            >
              <Icon>₹</Icon>

              <span className="side-label">
                Expenses
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/approvals")
              }
            >
              <Icon>✓</Icon>

              <span className="side-label">
                Approvals
              </span>
            </button>

          </div>
        </div>

        {/* =================================================
            HR MANAGEMENT
        ================================================= */}

        <div className="sidebar-section">

          <div className="sidebar-heading">
            HR MANAGEMENT
          </div>

          <div className="sidebar-nav">

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/employees")
              }
            >
              <Icon>♟</Icon>

              <span className="side-label">
                Employees
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/attendance")
              }
            >
              <Icon>✓</Icon>

              <span className="side-label">
                Attendance
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/leave")
              }
            >
              <Icon>📄</Icon>

              <span className="side-label">
                Leave Management
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/holidays")
              }
            >
              <Icon>▦</Icon>

              <span className="side-label">
                Holiday Calendar
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/shifts")
              }
            >
              <Icon>◷</Icon>

              <span className="side-label">
                Shift Management
              </span>
            </button>

          </div>
        </div>

        {/* =================================================
            REPORTS
        ================================================= */}

        <div className="sidebar-section">

          <div className="sidebar-heading">
            REPORTS
          </div>

          <div className="sidebar-nav">

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo(
                  "/reports/attendance"
                )
              }
            >
              <Icon>▦</Icon>

              <span className="side-label">
                Attendance Reports
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo(
                  "/reports/leave"
                )
              }
            >
              <Icon>▤</Icon>

              <span className="side-label">
                Leave Reports
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo(
                  "/reports/salary"
                )
              }
            >
              <Icon>₹</Icon>

              <span className="side-label">
                Salary Reports
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/reports")
              }
            >
              <Icon>▥</Icon>

              <span className="side-label">
                Business Reports
              </span>
            </button>

          </div>
        </div>

        {/* =================================================
            PAYROLL
        ================================================= */}

        <div className="sidebar-section">

          <div className="sidebar-heading">
            PAYROLL
          </div>

          <div className="sidebar-nav">

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/salary")
              }
            >
              <Icon>₹</Icon>

              <span className="side-label">
                Salary Management
              </span>
            </button>

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/salary/slips")
              }
            >
              <Icon>▤</Icon>

              <span className="side-label">
                Salary Slips
              </span>
            </button>

          </div>
        </div>

        {/* =================================================
            ADMINISTRATION
        ================================================= */}

        <div className="sidebar-section">

          <div className="sidebar-heading">
            ADMINISTRATION
          </div>

          <div className="sidebar-nav">

            {isAdmin && (
              <button
                type="button"
                className="side-item admin-item"
                onClick={() =>
                  goTo("/users")
                }
              >
                <Icon>♟</Icon>

                <span className="side-label">
                  User Management
                </span>
              </button>
            )}

            <button
              type="button"
              className="side-item"
              onClick={() =>
                goTo("/security")
              }
            >
              <Icon>🔒</Icon>

              <span className="side-label">
                Security
              </span>
            </button>

          </div>
        </div>

        {/* =================================================
            SIDEBAR LOGOUT
        ================================================= */}

        <div className="sidebar-bottom">

          <button
            type="button"
            className="side-logout"
            onClick={handleLogout}
          >
            <Icon>↪</Icon>

            <span>
              Logout
            </span>
          </button>

        </div>
      </aside>

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="dashboard-header">

        <div className="header-left">

          <button
            type="button"
            className="dashboard-menu-btn"
            onClick={() =>
              setSidebarOpen(true)
            }
            aria-label="Open menu"
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
              {userName}
            </strong>

            <span>
              {userRole}
            </span>
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
          >
            Logout
          </button>

        </div>

      </header>

      {/* ===================================================
          CONTENT
      =================================================== */}

      <main className="dashboard-content">

        {/* Welcome */}

        <section className="welcome-card">

          <div>

            <div className="welcome-small">
              OFFICE MANAGEMENT
            </div>

            <h2>
              Welcome back,{" "}
              {userName} 👋
            </h2>

            <p>
              Manage your office,
              employees, attendance,
              leave and salary from
              one place.
            </p>

          </div>

          <div className="role-area">

            <span className="role-label">
              CURRENT ROLE
            </span>

            <span className="role-badge">
              {userRole}
            </span>

          </div>

        </section>

        {/* =================================================
            STATS
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
                {loading
                  ? "..."
                  : formatMoney(
                      expenseTotal
                    )}
              </strong>

              <small>
                Current records
              </small>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              ✓
            </div>

            <div className="stat-content">

              <span>
                Pending Approval
              </span>

              <strong>
                {pendingApproval}
              </strong>

              <small>
                Waiting for action
              </small>

            </div>

          </div>

          <div
            className="stat-card clickable"
            onClick={() =>
              goTo("/employees")
            }
          >

            <div className="stat-icon">
              ♟
            </div>

            <div className="stat-content">

              <span>
                Total Employees
              </span>

              <strong>
                {employeeCount}
              </strong>

              <small>
                Active employees
              </small>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              !
            </div>

            <div className="stat-content">

              <span>
                Pending Tasks
              </span>

              <strong>
                {pendingTasks}
              </strong>

              <small>
                Requires attention
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

              <div className="section-kicker">
                QUICK ACCESS
              </div>

              <h2>
                Office Modules
              </h2>

              <p>
                Quickly access the most
                important sections.
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

            {/* Expenses */}

            <div
              className="module-card clickable"
              onClick={() =>
                goTo("/expenses")
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

            {/* Approvals */}

            <div
              className="module-card clickable"
              onClick={() =>
                goTo("/approvals")
              }
            >
              <div className="module-icon attendance">
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

              <span className="card-arrow">
                →
              </span>
            </div>

            {/* Employees */}

            <div
              className="module-card clickable"
              onClick={() =>
                goTo("/employees")
              }
            >
              <div className="module-icon employees">
                ♟
              </div>

              <div>
                <h3>
                  Employees
                </h3>

                <p>
                  Manage employees
                </p>
              </div>

              <span className="card-arrow">
                →
              </span>
            </div>

            {/* Attendance */}

            <div
              className="module-card clickable"
              onClick={() =>
                goTo("/attendance")
              }
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
              </div>

              <span className="card-arrow">
                →
              </span>
            </div>

            {/* Leave */}

            <div
              className="module-card clickable"
              onClick={() =>
                goTo("/leave")
              }
            >
              <div className="module-icon leave">
                📄
              </div>

              <div>
                <h3>
                  Leave Management
                </h3>

                <p>
                  Manage employee leaves
                </p>
              </div>

              <span className="card-arrow">
                →
              </span>
            </div>

            {/* Holidays */}

            <div
              className="module-card clickable"
              onClick={() =>
                goTo("/holidays")
              }
            >
              <div className="module-icon holiday">
                ▦
              </div>

              <div>
                <h3>
                  Holiday Calendar
                </h3>

                <p>
                  Manage office holidays
                </p>
              </div>

              <span className="card-arrow">
                →
              </span>
            </div>

            {/* Salary */}

            <div
              className="module-card clickable"
              onClick={() =>
                goTo("/salary")
              }
            >
              <div className="module-icon payroll">
                ₹
              </div>

              <div>
                <h3>
                  Salary Management
                </h3>

                <p>
                  Salary, additions & deductions
                </p>
              </div>

              <span className="card-arrow">
                →
              </span>
            </div>

            {/* Salary Slip */}

            <div
              className="module-card clickable"
              onClick={() =>
                goTo("/salary/slips")
              }
            >
              <div className="module-icon payroll">
                ▤
              </div>

              <div>
                <h3>
                  Salary Slips
                </h3>

                <p>
                  Create and view salary slips
                </p>
              </div>

              <span className="card-arrow">
                →
              </span>
            </div>

            {/* Reports */}

            <div
              className="module-card clickable"
              onClick={() =>
                goTo("/reports")
              }
            >
              <div className="module-icon expense">
                ▥
              </div>

              <div>
                <h3>
                  Reports
                </h3>

                <p>
                  View business reports
                </p>
              </div>

              <span className="card-arrow">
                →
              </span>
            </div>

          </div>
        </section>

        {/* =================================================
            ATTENDANCE / HR PREVIEW
        ================================================= */}

        <section className="attendance-preview">

          <div className="attendance-preview-header">

            <div>

              <div className="section-kicker">
                HR OVERVIEW
              </div>

              <h2>
                Attendance & Payroll
              </h2>

            </div>

            <span className="preview-badge">
              Coming Soon
            </span>

          </div>

          <div className="attendance-preview-grid">

            <div className="preview-box">

              <div className="preview-icon present">
                ✓
              </div>

              <div>
                <strong>
                  Attendance
                </strong>

                <span>
                  Daily / Monthly
                </span>
              </div>

            </div>

            <div className="preview-box">

              <div className="preview-icon leave">
                📄
              </div>

              <div>
                <strong>
                  Leave
                </strong>

                <span>
                  Paid / Unpaid
                </span>
              </div>

            </div>

            <div className="preview-box">

              <div className="preview-icon holiday">
                ▦
              </div>

              <div>
                <strong>
                  Holidays
                </strong>

                <span>
                  Company calendar
                </span>
              </div>

            </div>

            <div className="preview-box">

              <div className="preview-icon salary">
                ₹
              </div>

              <div>
                <strong>
                  Salary
                </strong>

                <span>
                  Additions & deductions
                </span>
              </div>

            </div>

          </div>

        </section>

      </main>

      {/* ===================================================
          STYLES
      =================================================== */}

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

        button {
          font-family: inherit;
        }

        /* ================================
           DASHBOARD
        ================================= */

        .dashboard {
          min-height: 100vh;
          background: #f5f7fb;
        }

        /* ================================
           HEADER
        ================================= */

        .dashboard-header {
          height: 74px;

          background: #ffffff;

          border-bottom:
            1px solid #e4e7ec;

          display: flex;

          align-items: center;

          justify-content:
            space-between;

          padding:
            0 28px;

          position: sticky;

          top: 0;

          z-index: 20;
        }

        .header-left {
          display: flex;

          align-items: center;

          gap: 14px;
        }

        .dashboard-menu-btn {
          width: 40px;
          height: 40px;

          border:
            1px solid #d0d5dd;

          border-radius: 9px;

          background: #ffffff;

          display: flex;

          flex-direction: column;

          justify-content: center;

          align-items: center;

          gap: 4px;

          cursor: pointer;
        }

        .dashboard-menu-btn span {
          width: 17px;
          height: 2px;

          border-radius: 3px;

          background: #173b68;
        }

        .dashboard-header h1 {
          margin: 0;

          font-size: 20px;

          color: #173b68;
        }

        .dashboard-header p {
          margin:
            3px 0 0;

          color: #667085;

          font-size: 11px;
        }

        .user-section {
          display: flex;

          align-items: center;

          gap: 16px;
        }

        .user-info {
          display: flex;

          flex-direction: column;

          align-items: flex-end;
        }

        .user-info strong {
          font-size: 13px;
        }

        .user-info span {
          margin-top: 3px;

          color: #245a96;

          font-size: 11px;
        }

        .logout-btn {
          border: none;

          background: #eef3f8;

          color: #245a96;

          padding:
            9px 15px;

          border-radius: 8px;

          font-weight: 700;

          cursor: pointer;
        }

        /* ================================
           SIDEBAR OVERLAY
        ================================= */

        .sidebar-overlay {
          position: fixed;

          inset: 0;

          background:
            rgba(
              15,
              23,
              42,
              .35
            );

          z-index: 40;
        }

        /* ================================
           SIDEBAR
        ================================= */

        .sidebar {
          position: fixed;

          top: 0;
          left: 0;
          bottom: 0;

          width: 282px;

          background: #ffffff;

          box-shadow:
            10px 0 32px
            rgba(
              15,
              23,
              42,
              .15
            );

          transform:
            translateX(-105%);

          transition:
            transform .23s ease;

          z-index: 50;

          display: flex;

          flex-direction: column;

          padding:
            12px;

          overflow-y: auto;

          overflow-x: hidden;

          scrollbar-width: thin;

          scrollbar-color:
            #d0d5dd
            transparent;
        }

        .sidebar.sidebar-open {
          transform:
            translateX(0);
        }

        .sidebar::-webkit-scrollbar {
          width: 5px;
        }

        .sidebar::-webkit-scrollbar-thumb {
          background:
            #d0d5dd;

          border-radius:
            10px;
        }

        /* ================================
           SIDEBAR TOP
        ================================= */

        .sidebar-top {
          min-height: 58px;

          display: flex;

          align-items: center;

          justify-content:
            space-between;

          padding:
            3px 7px 12px;

          border-bottom:
            1px solid #eaecf0;

          flex-shrink: 0;
        }

        .sidebar-brand {
          color: #173b68;

          font-size: 16px;

          font-weight: 800;
        }

        .sidebar-subtitle {
          color: #98a2b3;

          font-size: 9px;

          margin-top: 3px;
        }

        .sidebar-close {
          width: 32px;
          height: 32px;

          border: none;

          border-radius: 8px;

          background:
            #f2f4f7;

          color: #344054;

          font-size: 21px;

          cursor: pointer;
        }

        /* ================================
           SIDEBAR SECTION
        ================================= */

        .sidebar-section {
          margin-top: 13px;
        }

        .sidebar-heading {
          padding:
            0 7px 6px;

          font-size: 9px;

          font-weight: 800;

          letter-spacing: .9px;

          color: #98a2b3;
        }

        .sidebar-nav {
          display: grid;

          gap: 2px;
        }

        .side-item {
          width: 100%;

          min-height: 39px;

          border: none;

          background:
            transparent;

          color: #667085;

          padding:
            6px 7px;

          border-radius: 9px;

          display: flex;

          align-items: center;

          gap: 9px;

          text-align: left;

          font-size: 12px;

          font-weight: 600;

          cursor: pointer;

          transition:
            background .15s ease,
            color .15s ease;
        }

        .side-item:hover {
          background:
            #eef4fb;

          color:
            #173b68;
        }

        .side-icon {
          width: 30px;
          height: 30px;

          border-radius: 8px;

          background:
            #f3f7fc;

          color:
            #245a96;

          display: flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;

          font-size: 13px;
        }

        .side-label {
          flex: 1;

          white-space: nowrap;
        }

        .admin-item {
          background:
            #f8fbff;
        }

        /* ================================
           SIDEBAR BOTTOM
        ================================= */

        .sidebar-bottom {
          margin-top: 14px;

          padding-top: 10px;

          border-top:
            1px solid #eaecf0;

          flex-shrink: 0;
        }

        .side-logout {
          width: 100%;

          min-height: 40px;

          border: none;

          border-radius: 9px;

          background:
            #fef3f2;

          color:
            #b42318;

          display: flex;

          align-items: center;

          gap: 9px;

          padding:
            7px;

          font-size: 12px;

          font-weight: 700;

          cursor: pointer;
        }

        .side-logout .side-icon {
          color: #b42318;

          background:
            #ffffff;
        }

        /* ================================
           CONTENT
        ================================= */

        .dashboard-content {
          max-width: 1400px;

          margin:
            0 auto;

          padding:
            30px 28px;
        }

        /* ================================
           WELCOME
        ================================= */

        .welcome-card {
          background:
            linear-gradient(
              135deg,
              #245a96,
              #174579
            );

          color: #ffffff;

          border-radius:
            17px;

          padding:
            27px;

          display: flex;

          justify-content:
            space-between;

          align-items:
            center;
        }

        .welcome-small {
          font-size: 9px;

          font-weight: 800;

          letter-spacing:
            1px;

          opacity: .7;

          margin-bottom:
            7px;
        }

        .welcome-card h2 {
          margin: 0;

          font-size: 23px;
        }

        .welcome-card p {
          margin:
            7px 0 0;

          font-size: 12px;

          opacity: .9;
        }

        .role-area {
          text-align: right;
        }

        .role-label {
          display: block;

          font-size: 9px;

          opacity: .7;

          margin-bottom: 5px;
        }

        .role-badge {
          display: inline-block;

          padding:
            7px 13px;

          border-radius:
            18px;

          background:
            rgba(
              255,
              255,
              255,
              .15
            );

          font-size: 11px;

          font-weight: 700;
        }

        /* ================================
           STATS
        ================================= */

        .stats-grid {
          display: grid;

          grid-template-columns:
            repeat(4, 1fr);

          gap:
            16px;

          margin-top:
            20px;
        }

        .stat-card {
          background:
            #ffffff;

          border:
            1px solid #e4e7ec;

          border-radius:
            13px;

          padding:
            17px;

          display: flex;

          align-items:
            center;

          gap:
            12px;
        }

        .stat-card.clickable {
          cursor: pointer;

          transition:
            transform .18s ease,
            box-shadow .18s ease;
        }

        .stat-card.clickable:hover {
          transform:
            translateY(-2px);

          box-shadow:
            0 8px 20px
            rgba(
              36,
              90,
              150,
              .08
            );
        }

        .stat-icon {
          width: 42px;
          height: 42px;

          border-radius:
            10px;

          background:
            #eef4fb;

          color:
            #245a96;

          display: flex;

          align-items:
            center;

          justify-content:
            center;

          font-weight:
            800;

          flex-shrink: 0;
        }

        .stat-content span {
          display: block;

          color:
            #667085;

          font-size:
            11px;
        }

        .stat-content strong {
          display: block;

          margin-top:
            3px;

          color:
            #173b68;

          font-size:
            21px;
        }

        .stat-content small {
          display: block;

          margin-top:
            3px;

          color:
            #98a2b3;

          font-size:
            9px;
        }

        /* ================================
           MODULES
        ================================= */

        .modules-section {
          margin-top:
            28px;
        }

        .section-header {
          display: flex;

          align-items:
            flex-end;

          justify-content:
            space-between;

          margin-bottom:
            14px;
        }

        .section-kicker {
          color:
            #98a2b3;

          font-size:
            9px;

          font-weight:
            800;

          letter-spacing:
            1px;
        }

        .section-header h2 {
          margin:
            4px 0 3px;

          font-size:
            18px;
        }

        .section-header p {
          margin: 0;

          color:
            #667085;

          font-size:
            11px;
        }

        .open-menu-link {
          border:
            1px solid #d0d5dd;

          background:
            #ffffff;

          color:
            #245a96;

          padding:
            8px 11px;

          border-radius:
            8px;

          font-size:
            10px;

          font-weight:
            700;

          cursor:
            pointer;
        }

        .modules-grid {
          display: grid;

          grid-template-columns:
            repeat(3, 1fr);

          gap:
            14px;
        }

        .module-card {
          background:
            #ffffff;

          border:
            1px solid #e4e7ec;

          border-radius:
            13px;

          min-height:
            88px;

          padding:
            16px;

          display:
            flex;

          align-items:
            center;

          gap:
            12px;
        }

        .module-card.clickable {
          cursor:
            pointer;

          transition:
            transform .18s ease,
            box-shadow .18s ease;
        }

        .module-card.clickable:hover {
          transform:
            translateY(-2px);

          box-shadow:
            0 8px 22px
            rgba(
              36,
              90,
              150,
              .08
            );
        }

        .module-icon {
          width:
            43px;

          height:
            43px;

          border-radius:
            10px;

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

        .module-icon.payroll {
          background:
            #f2f4ff;

          color:
            #5148a8;
        }

        .module-icon.employees {
          background:
            #eef4fb;

          color:
            #245a96;
        }

        .module-card h3 {
          margin:
            0;

          font-size:
            13px;
        }

        .module-card p {
          margin:
            4px 0 0;

          color:
            #667085;

          font-size:
            10px;
        }

        .card-arrow {
          margin-left:
            auto;

          color:
            #98a2b3;

          font-size:
            15px;
        }

        /* ================================
           HR PREVIEW
        ================================= */

        .attendance-preview {
          margin-top:
            20px;

          background:
            #ffffff;

          border:
            1px solid #e4e7ec;

          border-radius:
            14px;

          padding:
            20px;
        }

        .attendance-preview-header {
          display:
            flex;

          justify-content:
            space-between;

          align-items:
            center;
        }

        .attendance-preview-header h2 {
          margin:
            4px 0 0;

          font-size:
            17px;
        }

        .preview-badge {
          padding:
            4px 8px;

          border-radius:
            8px;

          background:
            #f2f4f7;

          color:
            #667085;

          font-size:
            8px;

          font-weight:
            700;
        }

        .attendance-preview-grid {
          display:
            grid;

          grid-template-columns:
            repeat(4, 1fr);

          gap:
            12px;

          margin-top:
            16px;
        }

        .preview-box {
          display:
            flex;

          align-items:
            center;

          gap:
            9px;

          border:
            1px solid #eaecf0;

          border-radius:
            10px;

          padding:
            11px;
        }

        .preview-icon {
          width:
            34px;

          height:
            34px;

          border-radius:
            8px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          flex-shrink:
            0;
        }

        .preview-icon.present {
          background:
            #ecfdf3;

          color:
            #027a48;
        }

        .preview-icon.leave {
          background:
            #fffaeb;

          color:
            #b54708;
        }

        .preview-icon.holiday {
          background:
            #fdf2fa;

          color:
            #c11574;
        }

        .preview-icon.salary {
          background:
            #f2f4ff;

          color:
            #5148a8;
        }

        .preview-box strong {
          display:
            block;

          font-size:
            11px;
        }

        .preview-box span {
          display:
            block;

          margin-top:
            3px;

          color:
            #98a2b3;

          font-size:
            9px;
        }

        /* ================================
           RESPONSIVE
        ================================= */

        @media (max-width: 1100px) {

          .stats-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .modules-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .attendance-preview-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }
        }

        @media (max-width: 650px) {

          .dashboard-header {
            height:
              64px;

            padding:
              0 14px;
          }

          .dashboard-header h1 {
            font-size:
              16px;
          }

          .dashboard-header p {
            font-size:
              9px;
          }

          .user-info {
            display:
              none;
          }

          .logout-btn {
            padding:
              8px 10px;

            font-size:
              10px;
          }

          .dashboard-content {
            padding:
              18px 14px;
          }

          .welcome-card {
            flex-direction:
              column;

            align-items:
              flex-start;

            gap:
              14px;

            padding:
              21px;
          }

          .welcome-card h2 {
            font-size:
              19px;
          }

          .role-area {
            text-align:
              left;
          }

          .stats-grid,
          .modules-grid,
          .attendance-preview-grid {
            grid-template-columns:
              1fr;
          }

          .section-header {
            flex-direction:
              column;

            align-items:
              flex-start;

            gap:
              10px;
          }

          .sidebar {
            width:
              min(
                88vw,
                300px
              );
          }
        }

      `}</style>
    </div>
  );
}
