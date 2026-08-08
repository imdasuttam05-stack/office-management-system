```jsx
import React from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const userData = localStorage.getItem("user");

  let user = {};

  try {
    user = JSON.parse(userData || "{}");
  } catch {
    user = {};
  }

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
  };

  return (
    <div className="dashboard">
      {/* ================= HEADER ================= */}

      <header className="dashboard-header">
        <div>
          <h1>Office Management</h1>
          <p>Business Management System</p>
        </div>

        <div className="user-section">
          <div className="user-info">
            <strong>{user.name || "User"}</strong>
            <span>{user.role || "Employee"}</span>
          </div>

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {/* ================= MAIN ================= */}

      <main className="dashboard-content">
        {/* ================= WELCOME ================= */}

        <div className="welcome-card">
          <div>
            <h2>
              Welcome back, {user.name || "User"} 👋
            </h2>

            <p>Your Office Management Dashboard</p>
          </div>

          <div className="role-badge">
            {user.role || "Employee"}
          </div>
        </div>

        {/* ================= STAT CARDS ================= */}

        <div className="stats-grid">
          <div className="stat-card">
            <span>Total Expenses</span>
            <strong>₹0</strong>
            <small>This month</small>
          </div>

          <div className="stat-card">
            <span>Pending Approval</span>
            <strong>0</strong>
            <small>Waiting for action</small>
          </div>

          <div className="stat-card">
            <span>Total Employees</span>
            <strong>0</strong>
            <small>Active employees</small>
          </div>

          <div className="stat-card">
            <span>Pending Tasks</span>
            <strong>0</strong>
            <small>Requires attention</small>
          </div>
        </div>

        {/* ================= MODULES ================= */}

        <section className="modules-section">
          <h2>Quick Access</h2>

          <div className="modules-grid">
            <div className="module-card">
              <div className="module-icon">₹</div>

              <div>
                <h3>Expenses</h3>
                <p>Manage office expenses</p>
              </div>
            </div>

            <div className="module-card">
              <div className="module-icon">✓</div>

              <div>
                <h3>Approvals</h3>
                <p>Review pending approvals</p>
              </div>
            </div>

            <div className="module-card">
              <div className="module-icon">👥</div>

              <div>
                <h3>Employees</h3>
                <p>Manage employees</p>
              </div>
            </div>

            <div className="module-card">
              <div className="module-icon">📊</div>

              <div>
                <h3>Reports</h3>
                <p>View business reports</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================= CSS ================= */}

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Inter, Arial, sans-serif;
          background: #f5f7fb;
          color: #172b4d;
        }

        .dashboard {
          min-height: 100vh;
        }

        .dashboard-header {
          height: 76px;
          background: #ffffff;
          border-bottom: 1px solid #e4e7ec;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
        }

        .dashboard-header h1 {
          margin: 0;
          font-size: 21px;
          font-weight: 700;
        }

        .dashboard-header p {
          margin: 4px 0 0;
          color: #667085;
          font-size: 13px;
        }

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
          padding: 9px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .logout-btn:hover {
          background: #e2eaf2;
        }

        .dashboard-content {
          max-width: 1400px;
          margin: auto;
          padding: 32px;
        }

        .welcome-card {
          background: linear-gradient(
            135deg,
            #245a96,
            #174579
          );
          color: white;
          border-radius: 16px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 8px 25px rgba(36, 90, 150, 0.15);
        }

        .welcome-card h2 {
          margin: 0;
          font-size: 23px;
        }

        .welcome-card p {
          margin: 8px 0 0;
          opacity: 0.85;
          font-size: 14px;
        }

        .role-badge {
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.25);
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-top: 24px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 14px;
          padding: 22px;
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
        }

        .stat-card small {
          display: block;
          margin-top: 6px;
          color: #98a2b3;
          font-size: 12px;
        }

        .modules-section {
          margin-top: 32px;
        }

        .modules-section h2 {
          font-size: 18px;
          margin-bottom: 16px;
        }

        .modules-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }

        .module-card {
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 14px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          cursor: pointer;
          transition: 0.2s;
        }

        .module-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
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
          font-size: 18px;
          flex-shrink: 0;
        }

        .module-card h3 {
          margin: 0;
          font-size: 15px;
        }

        .module-card p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .stats-grid,
          .modules-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .dashboard-header {
            padding: 0 16px;
          }

          .dashboard-content {
            padding: 18px;
          }

          .user-info {
            display: none;
          }

          .welcome-card {
            padding: 20px;
          }

          .welcome-card h2 {
            font-size: 19px;
          }

          .stats-grid,
          .modules-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
```
