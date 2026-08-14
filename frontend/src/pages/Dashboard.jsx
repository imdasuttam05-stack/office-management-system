import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const role = user.role || "Employee";
  const isAdmin = role === "Admin";

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const go = (path) => {
    setSidebarOpen(false);
    navigate(path);
  };

  const menuItems = [
    ["Dashboard", "/dashboard", "⌂"],
    ["Expenses", "/expenses", "₹"],
    ["Approvals", "/approvals", "✓"],
    ["Employees", "/employees", "👥"],
    ["Reports", "/reports", "▦"],
    ["Security", "/security", "🔐"],
  ];

  if (isAdmin) {
    menuItems.push(["User Management", "/users", "👤"]);
  }

  return (
    <div className="dashboard">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <div>
            <h2>Office Management</h2>
            <span>{role} Panel</span>
          </div>

          <button
            className="sidebar-close"
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(([label, path, icon]) => (
            <button
              key={path}
              type="button"
              className="side-item"
              onClick={() => go(path)}
            >
              <span className="side-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="side-logout"
          onClick={logout}
        >
          <span className="side-icon">↪</span>
          Logout
        </button>
      </aside>

      <header className="dashboard-header">
        <div className="header-left">
          <button
            type="button"
            className="menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            title="Open menu"
          >
            <span />
            <span />
            <span />
          </button>

          <div>
            <h1>Office Management</h1>
            <p>Business Management System</p>
          </div>
        </div>

        <div className="user-section">
          <div className="user-info">
            <strong>{user.name || "User"}</strong>
            <span>{role}</span>
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

      <main className="dashboard-content">
        <div className="welcome-card">
          <div>
            <h2>
              Welcome back, {user.name || "User"} 👋
            </h2>
            <p>Your Office Management Dashboard</p>
          </div>
          <div className="role-badge">{role}</div>
        </div>

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

        <section className="modules-section">
          <div className="section-heading-row">
            <h2>Quick Access</h2>
            <button
              type="button"
              className="open-menu-link"
              onClick={() => setSidebarOpen(true)}
            >
              Open Menu
            </button>
          </div>

          <div className="modules-grid">
            <div className="module-card clickable" onClick={() => go("/expenses")}>
              <div className="module-icon">₹</div>
              <div>
                <h3>Expenses</h3>
                <p>Manage office expenses</p>
              </div>
            </div>

            <div className="module-card clickable" onClick={() => go("/approvals")}>
              <div className="module-icon">✓</div>
              <div>
                <h3>Approvals</h3>
                <p>Review pending approvals</p>
              </div>
            </div>

            <div className="module-card clickable" onClick={() => go("/employees")}>
              <div className="module-icon">👥</div>
              <div>
                <h3>Employees</h3>
                <p>Employee directory</p>
              </div>
            </div>

            <div className="module-card clickable" onClick={() => go("/reports")}>
              <div className="module-icon">▦</div>
              <div>
                <h3>Reports</h3>
                <p>View business reports</p>
              </div>
            </div>

            <div className="module-card clickable" onClick={() => go("/security")}>
              <div className="module-icon">🔐</div>
              <div>
                <h3>Security</h3>
                <p>Change your password</p>
              </div>
            </div>

            {isAdmin && (
              <div className="module-card clickable admin-module" onClick={() => go("/users")}>
                <div className="module-icon">👤</div>
                <div>
                  <h3>User Management</h3>
                  <p>Create and manage users</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f5f7fb; color: #172b4d; }
        .dashboard { min-height: 100vh; background: #f5f7fb; }

        .dashboard-header { min-height: 76px; background: #fff; border-bottom: 1px solid #e4e7ec; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; position: sticky; top: 0; z-index: 20; }
        .header-left { display: flex; align-items: center; gap: 14px; }
        .dashboard-header h1 { margin: 0; font-size: 21px; color: #173b68; }
        .dashboard-header p { margin: 4px 0 0; color: #667085; font-size: 13px; }

        .menu-btn { width: 42px; height: 42px; border: 1px solid #d0d5dd; border-radius: 10px; background: #fff; cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px; }
        .menu-btn span { width: 18px; height: 2px; background: #173b68; border-radius: 3px; display: block; }
        .menu-btn:hover { background: #f8fafc; }

        .user-section { display: flex; align-items: center; gap: 20px; }
        .user-info { display: flex; flex-direction: column; align-items: flex-end; }
        .user-info strong { font-size: 14px; }
        .user-info span { margin-top: 3px; font-size: 12px; color: #245a96; }
        .logout-btn { border: none; background: #eef3f8; color: #245a96; padding: 9px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .logout-btn:hover { background: #e2ebf5; }

        .sidebar-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.34); z-index: 40; }
        .sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 290px; background: #fff; box-shadow: 14px 0 40px rgba(15,23,42,.16); transform: translateX(-105%); transition: transform .22s ease; z-index: 50; display: flex; flex-direction: column; padding: 22px 16px 16px; }
        .sidebar.open { transform: translateX(0); }
        .sidebar-top { display: flex; align-items: flex-start; justify-content: space-between; padding: 6px 10px 20px; border-bottom: 1px solid #eaecf0; }
        .sidebar-top h2 { margin: 0; font-size: 18px; color: #173b68; }
        .sidebar-top span { display: block; margin-top: 5px; color: #667085; font-size: 12px; }
        .sidebar-close { border: none; background: #f2f4f7; width: 34px; height: 34px; border-radius: 8px; font-size: 23px; cursor: pointer; color: #344054; }
        .sidebar-nav { display: grid; gap: 6px; padding: 18px 0; overflow-y: auto; }
        .side-item, .side-logout { width: 100%; border: none; background: transparent; color: #344054; padding: 12px 12px; border-radius: 10px; display: flex; align-items: center; gap: 12px; text-align: left; font-size: 14px; font-weight: 600; cursor: pointer; }
        .side-item:hover { background: #eef4fb; color: #173b68; }
        .side-logout { margin-top: auto; background: #fef3f2; color: #b42318; }
        .side-logout:hover { background: #fee4e2; }
        .side-icon { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; background: #eef4fb; color: #245a96; flex-shrink: 0; }
        .side-logout .side-icon { background: #fff; color: #b42318; }

        .dashboard-content { width: 100%; max-width: 1400px; margin: 0 auto; padding: 38px 32px; }
        .welcome-card { background: linear-gradient(135deg, #245a96, #174579); color: #fff; border-radius: 16px; padding: 28px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 24px rgba(36,90,150,.12); }
        .welcome-card h2 { margin: 0; font-size: 23px; }
        .welcome-card p { margin: 8px 0 0; font-size: 14px; }
        .role-badge { background: rgba(255,255,255,.15); padding: 8px 14px; border-radius: 20px; font-size: 13px; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 24px; }
        .stat-card { background: #fff; border: 1px solid #e4e7ec; border-radius: 14px; padding: 22px; transition: transform .2s ease, box-shadow .2s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.06); }
        .stat-card span { display: block; color: #667085; font-size: 13px; }
        .stat-card strong { display: block; margin-top: 10px; font-size: 28px; color: #173b68; }
        .stat-card small { display: block; margin-top: 6px; color: #98a2b3; }

        .modules-section { margin-top: 34px; }
        .section-heading-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .modules-section h2 { font-size: 18px; margin: 0; }
        .open-menu-link { border: 1px solid #d0d5dd; background: #fff; color: #245a96; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 600; }
        .open-menu-link:hover { background: #eef4fb; }
        .modules-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .module-card { background: #fff; border: 1px solid #e4e7ec; border-radius: 14px; padding: 20px; display: flex; align-items: center; gap: 15px; min-height: 100px; }
        .module-card.clickable { cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
        .module-card.clickable:hover { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(36,90,150,.10); border-color: #c7d8eb; }
        .module-icon { width: 44px; height: 44px; border-radius: 10px; background: #eef4fb; color: #245a96; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .module-card h3 { margin: 0; font-size: 15px; }
        .module-card p { margin: 5px 0 0; color: #667085; font-size: 12px; }
        .admin-module { border-color: #c7d8eb; }

        @media (max-width: 1000px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .modules-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .dashboard-header { padding: 0 16px; } .dashboard-content { padding: 18px 16px; } .user-info { display: none; } .welcome-card { padding: 22px; align-items: flex-start; gap: 16px; flex-direction: column; } .welcome-card h2 { font-size: 20px; } .stats-grid, .modules-grid { grid-template-columns: 1fr; } .module-card { min-height: 88px; } .sidebar { width: min(86vw, 300px); } }
      `}</style>
    </div>
  );
}

export default Dashboard;
