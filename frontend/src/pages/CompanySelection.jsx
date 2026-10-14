import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, CalendarDays, Plus, ArrowRight, RefreshCw, Pencil, Save, X, Building } from "lucide-react";
import "./GSTReports.css";
import "./CompanySelection.css";

const API_URL = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const FY_KEY = "oms_active_financial_year";
const COMPANY_KEY = "oms_active_company";
const EMPTY_COMPANY = {
  name: "", mailingName: "", address: "", country: "India", state: "", pincode: "",
  phone: "", mobile: "", email: "", gstin: "", pan: "", currencySymbol: "₹",
  financialYearFrom: "", booksBeginFrom: "",
};

function normalizeFinancialYear(value) {
  const raw = String(value || "").trim();
  const short = raw.match(/^(\d{2})-(\d{2})$/);
  if (short) return `20${short[1]}-${short[2]}`;
  return raw;
}
function financialYears() {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() < 3 ? year - 1 : year;
  return Array.from({ length: 10 }, (_, i) => {
    const y = start - 7 + i;
    return { label: `${y}-${String(y + 1).slice(-2)}`, start: `${y}-04-01`, end: `${y + 1}-03-31` };
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
  const [selectedFY, setSelectedFY] = useState(() => normalizeFinancialYear(localStorage.getItem(FY_KEY)) || years.find(y => new Date() >= new Date(y.start) && new Date() <= new Date(y.end))?.label || years[years.length - 1]?.label || "2026-27");
  const [form, setForm] = useState(EMPTY_COMPANY);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const token = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

  async function loadCompanies() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API_URL}/api/payroll/companies`, { headers: token() ? { Authorization: `Bearer ${token()}` } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Company list could not be loaded.");
      const list = Array.isArray(data.companies) ? data.companies : [];
      setCompanies(list);
      setSelectedCompany(current => current && list.some(c => c._id === current) ? current : (list[0]?._id || ""));
    } catch (e) { setError(e.message || "Company list could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadCompanies(); }, []);

  function startCreate() {
    setEditingId(""); setForm({ ...EMPTY_COMPANY, financialYearFrom: years.find(y => y.label === selectedFY)?.start || "", booksBeginFrom: years.find(y => y.label === selectedFY)?.start || "" });
    setFormOpen(true); setError("");
  }
  function startAlter(company) {
    setSelectedCompany(company._id); setEditingId(company._id); setForm({ ...EMPTY_COMPANY, ...company, name: company.name || "" }); setFormOpen(true); setError("");
  }
  function changeForm(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })); }
  async function saveCompany(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Company Name is required."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`${API_URL}/api/payroll/companies${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Company could not be ${editingId ? "updated" : "created"}.`);
      const saved = data.company;
      await loadCompanies();
      if (saved?._id) setSelectedCompany(saved._id);
      setFormOpen(false); setEditingId("");
    } catch (e) { setError(e.message || "Company could not be saved."); }
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
    // Full remount is intentional: clears stale entry/history React state from the previous FY.
    window.location.replace(safePath);
  }

  const field = (label, name, type = "text", wide = false) => <label className={`oms-tally-field ${wide ? "wide" : ""}`} key={name}><span>{label}</span><input name={name} type={type} value={form[name] ?? ""} onChange={changeForm} maxLength={name === "address" ? 1200 : 160} /></label>;

  return <main className="gst-page oms-company-page">
    <header className="gst-topbar"><div className="gst-brand"><span className="gst-brand-mark">OMS</span><div><strong>Company & Financial Year</strong><small>Tally-style company workspace</small></div></div><button className="gst-back" type="button" onClick={() => { ["token", "accessToken", "refreshToken", "user", COMPANY_KEY, FY_KEY, "oms_active_financial_year_start", "oms_active_financial_year_end"].forEach(k => localStorage.removeItem(k)); navigate("/login", { replace: true }); }}>Sign out</button></header>
    <section className="oms-company-wrap">
      <div className="oms-company-intro"><div className="gst-eyebrow">WORKSPACE SETUP</div><h1>Select Company</h1><p>Select the company and financial year first. Entries and reports are isolated by the selected company and financial year.</p></div>
      <div className="oms-company-grid">
        <section className="oms-company-card">
          <div className="oms-card-title"><Building2 size={19}/><div><h2>Company</h2><p>Create, select or alter company details</p></div><button type="button" className="oms-icon-button" onClick={loadCompanies} title="Refresh companies"><RefreshCw size={16}/></button></div>
          <div className="oms-company-list">{loading ? <p className="oms-muted">Loading companies…</p> : companies.map(c => <div key={c._id} className={`oms-company-row ${selectedCompany === c._id ? "selected" : ""}`}>
            <button type="button" className={`oms-company-option ${selectedCompany === c._id ? "selected" : ""}`} onClick={() => setSelectedCompany(c._id)}><span className="oms-company-avatar">{String(c.name || "C").slice(0,1).toUpperCase()}</span><span className="oms-company-option-text"><strong>{c.name}</strong><small>{c.state || c.country || (selectedCompany === c._id ? "Selected company" : "Click to select")}</small></span><span className="oms-radio-dot"/></button>
            <button type="button" className="oms-alter-button" onClick={() => startAlter(c)} title={`Alter ${c.name}`}><Pencil size={14}/> Alter</button>
          </div>)}{!loading && !companies.length && <p className="oms-muted">No companies yet. Create your first company.</p>}</div>
          <div className="oms-company-actions"><button type="button" className="gst-run" onClick={startCreate}><Plus size={15}/> Create Company</button><span>Company setup follows a Tally-style format.</span></div>
        </section>
        <section className="oms-company-card oms-fy-card"><div className="oms-card-title"><CalendarDays size={19}/><div><h2>Financial Year</h2><p>Indian financial year: 1 April – 31 March</p></div></div><label className="oms-field-label" htmlFor="oms-fy-select">Choose financial year</label><select id="oms-fy-select" value={selectedFY} onChange={e => setSelectedFY(e.target.value)}>{years.map(y => <option key={y.label} value={y.label}>FY {y.label} ({y.start} to {y.end})</option>)}</select><div className="oms-fy-preview"><span>Selected FY</span><strong>FY {selectedFY}</strong><small>{years.find(y => y.label === selectedFY)?.start} → {years.find(y => y.label === selectedFY)?.end}</small></div><button type="button" className="gst-run oms-continue" onClick={continueToWorkspace} disabled={!selectedCompany}><ArrowRight size={16}/> Select Company & Continue</button></section>
      </div>
      {formOpen && <section className="oms-company-card oms-tally-form-card"><div className="oms-card-title"><Building size={19}/><div><h2>{editingId ? "Alter Company" : "Create Company"}</h2><p>Company creation and alteration — Tally-style details</p></div><button type="button" className="oms-icon-button" onClick={() => setFormOpen(false)} title="Close"><X size={16}/></button></div>
        <form onSubmit={saveCompany} className="oms-tally-form">
          <div className="oms-tally-section-title">Company Information</div><div className="oms-tally-grid">{field("Company Name *", "name")}{field("Mailing Name", "mailingName")}{field("Address", "address", "text", true)}{field("Country", "country")}{field("State", "state")}{field("PIN Code", "pincode")}{field("Telephone", "phone")}{field("Mobile", "mobile")}{field("E-mail", "email", "email")}</div>
          <div className="oms-tally-section-title">Taxation & Currency</div><div className="oms-tally-grid">{field("GSTIN / UIN", "gstin")}{field("PAN / Income Tax No.", "pan")}{field("Base Currency Symbol", "currencySymbol")}</div>
          <div className="oms-tally-section-title">Financial Year Details</div><div className="oms-tally-grid">{field("Financial Year Begins From", "financialYearFrom", "date")}{field("Books Beginning From", "booksBeginFrom", "date")}</div>
          <div className="oms-tally-form-actions"><button type="button" className="oms-cancel-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="gst-run" disabled={saving}><Save size={15}/>{saving ? "Saving…" : editingId ? "Save Alterations" : "Create Company"}</button></div>
        </form>
      </section>}
      {error && <div className="gst-error" role="alert">{error}</div>}
      <p className="oms-footnote">Switching company or financial year reloads the workspace so previous entry/history screens cannot retain stale data from the last selection. Transaction records are filtered by the selected company and FY on the backend.</p>
    </section>
  </main>;
}
