import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Building2, CalendarDays, Repeat2 } from "lucide-react";
import "./CompanyWorkspaceLayout.css";

const COMPANY_KEY = "oms_active_company";
const FY_KEY = "oms_active_financial_year";

function readCompany() {
  try { return JSON.parse(localStorage.getItem(COMPANY_KEY) || "null"); }
  catch { return null; }
}

export default function CompanyWorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const company = readCompany();
  const financialYear = localStorage.getItem(FY_KEY) || "Not selected";

  // The selection page has its own full-page layout and should not show the workspace bar.
  if (location.pathname === "/company-selection") return <Outlet />;

  return (
    <div className="oms-workspace-shell">
      <header className="oms-workspace-bar">
        <div className="oms-workspace-brand">
          <span className="oms-workspace-logo">OMS</span>
          <div className="oms-workspace-brand-copy">
            <strong>Office Management System</strong>
            <small>Active workspace</small>
          </div>
        </div>
        <div className="oms-workspace-current" aria-label="Current company and financial year">
          <div className="oms-workspace-detail">
            <Building2 size={17} aria-hidden="true" />
            <span><small>Current Company</small><strong title={company?.name || "No company selected"}>{company?.name || "No company selected"}</strong></span>
          </div>
          <span className="oms-workspace-divider" />
          <div className="oms-workspace-detail oms-workspace-fy">
            <CalendarDays size={17} aria-hidden="true" />
            <span><small>Financial Year</small><strong>{financialYear}</strong></span>
          </div>
          <button className="oms-switch-company" type="button" onClick={() => navigate("/company-selection", { state: { from: location.pathname } })}>
            <Repeat2 size={16} /> <span>Switch Company</span>
          </button>
        </div>
      </header>
      <div className="oms-workspace-outlet"><Outlet /></div>
    </div>
  );
}
