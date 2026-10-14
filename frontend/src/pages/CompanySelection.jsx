import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, CalendarDays, Plus, ArrowRight, RefreshCw } from "lucide-react";
import "./GSTReports.css";
import "./CompanySelection.css";

const API_URL = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const FY_KEY = "oms_active_financial_year";
const COMPANY_KEY = "oms_active_company";

function financialYears() {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() < 3 ? year - 1 : year;
  return Array.from({ length: 8 }, (_, i) => {
    const y = start - 5 + i;
    return { label: `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`, start: `${y}-04-01`, end: `${y + 1}-03-31` };
  }).reverse();
}

export default function CompanySelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const years = useMemo(financialYears, []);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COMPANY_KEY) || "null")?._id || ""; } catch { return ""; }
  });
  const [selectedFY, setSelectedFY] = useState(() => localStorage.getItem(FY_KEY) || years.find(y => new Date() >= new Date(y.start) && new Date() <= new Date(y.end))?.label || years[years.length - 1]?.label || "26-27");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadCompanies() {
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      const response = await fetch(`${API_URL}/api/payroll/companies`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Company list could not be loaded.");
      const list = Array.isArray(data.companies) ? data.companies : [];
      setCompanies(list);
      if (!selectedCompany && list.length) setSelectedCompany(list[0]._id);
    } catch (e) { setError(e.message || "Company list could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadCompanies(); }, []);

  async function createCompany(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true); setError("");
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      const response = await fetch(`${API_URL}/api/payroll/companies`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ name: newName.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Company could not be created.");
      setNewName(""); await loadCompanies();
      if (data.company?._id) setSelectedCompany(data.company._id);
    } catch (e) { setError(e.message || "Company could not be created."); }
    finally { setSaving(false); }
  }

  function continueToWorkspace() {
    const company = companies.find(c => c._id === selectedCompany);
    const fy = years.find(y => y.label === selectedFY);
    if (!company || !fy) { setError("Please select a company and financial year."); return; }
    localStorage.setItem(COMPANY_KEY, JSON.stringify({ _id: company._id, name: company.name }));
    localStorage.setItem(FY_KEY, fy.label);
    localStorage.setItem("oms_active_financial_year_start", fy.start);
    localStorage.setItem("oms_active_financial_year_end", fy.end);
    const requestedPath = location.state?.from;
    const safePath = requestedPath && requestedPath.startsWith("/") && requestedPath !== "/company-selection" ? requestedPath : "/dashboard";
    navigate(safePath, { replace: true });
  }

  return <main className="gst-page oms-company-page">
    <header className="gst-topbar"><div className="gst-brand"><span className="gst-brand-mark">OMS</span><div><strong>Company & Financial Year</strong><small>Tally-style company workspace</small></div></div><button className="gst-back" type="button" onClick={() => { localStorage.removeItem(COMPANY_KEY); navigate("/login", { replace: true }); }}>Sign out</button></header>
    <section className="oms-company-wrap">
      <div className="oms-company-intro"><div className="gst-eyebrow">WORKSPACE SETUP</div><h1>Select Company</h1><p>Select the company and financial year first. You will then enter the system for that selection.</p></div>
      <div className="oms-company-grid">
        <section className="oms-company-card"><div className="oms-card-title"><Building2 size={19}/><div><h2>Company</h2><p>Select an existing company</p></div><button type="button" className="oms-icon-button" onClick={loadCompanies} title="Refresh companies"><RefreshCw size={16}/></button></div>
          <div className="oms-company-list">{loading ? <p className="oms-muted">Loading companies…</p> : companies.map(c => <button type="button" key={c._id} className={`oms-company-option ${selectedCompany === c._id ? "selected" : ""}`} onClick={() => setSelectedCompany(c._id)}><span className="oms-company-avatar">{String(c.name || "C").slice(0,1).toUpperCase()}</span><span className="oms-company-option-text"><strong>{c.name}</strong><small>{selectedCompany === c._id ? "Selected company" : "Click to select"}</small></span><span className="oms-radio-dot"/></button>)}{!loading && !companies.length && <p className="oms-muted">No companies yet. Create your first company below.</p>}</div>
          <form className="oms-create-company" onSubmit={createCompany}><label htmlFor="oms-company-name">Create another company</label><div><input id="oms-company-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter company name" maxLength={120}/><button className="gst-run" disabled={saving || !newName.trim()}><Plus size={15}/>{saving ? "Creating…" : "Create"}</button></div><small>Create 4–5 companies or more; each will appear in this list.</small></form>
        </section>
        <section className="oms-company-card oms-fy-card"><div className="oms-card-title"><CalendarDays size={19}/><div><h2>Financial Year</h2><p>Indian financial year: 1 April – 31 March</p></div></div><label className="oms-field-label" htmlFor="oms-fy-select">Choose financial year</label><select id="oms-fy-select" value={selectedFY} onChange={e => setSelectedFY(e.target.value)}>{years.map(y => <option key={y.label} value={y.label}>20{y.label} ({y.start} to {y.end})</option>)}</select><div className="oms-fy-preview"><span>Selected FY</span><strong>FY {selectedFY}</strong><small>{years.find(y => y.label === selectedFY)?.start} → {years.find(y => y.label === selectedFY)?.end}</small></div><button type="button" className="gst-run oms-continue" onClick={continueToWorkspace} disabled={!selectedCompany}><ArrowRight size={16}/> Select Company & Continue</button></section>
      </div>
      {error && <div className="gst-error" role="alert">{error}</div>}
      <p className="oms-footnote">Company and FY selection are saved for this browser session. Full historical data separation requires the accounting APIs and existing records to be scoped to the selected company and year.</p>
    </section>
  </main>;
}
