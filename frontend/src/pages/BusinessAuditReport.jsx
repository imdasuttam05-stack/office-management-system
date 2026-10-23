import React, { useEffect, useState } from "react";
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./GSTReports.css";

const API = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;
const dateTime = value => value ? new Date(value).toLocaleString("en-IN") : "-";
const csvValue = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
const jsonText = value => value == null ? "-" : JSON.stringify(value, null, 2);
const ignoredAuditFields = new Set(["_id", "__v", "createdAt", "updatedAt", "companyId", "financialYear", "createdBy", "updatedBy", "ledger", "partyLedger"]);
const fieldLabel = value => ({
  voucherNo:"Voucher No.", productionNo:"Production No.", jobNo:"Job Order No.", docNo:"Document No.",
  partyLedgerName:"Party Ledger", partyLedger:"Party Ledger", ledgerName:"Ledger",
  lines:"Ledger Entries", totalDebit:"Total Debit", totalCredit:"Total Credit",
  openingBalance:"Opening Balance", openingType:"Balance Type", referenceNo:"Reference No.",
  outputItems:"Production Outputs", itemName:"Product", qty:"Quantity", packetCount:"Packets (PCS)",
  packetWeightKg:"Packet Weight (KG)", productionDate:"Production Date", mfgDate:"MFG Date",
  expiryDate:"Expiry Date", value:"Value", rate:"Rate", amount:"Amount",
  narration:"Narration", date:"Date", type:"Type", groupName:"Group",
}[value] || value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, letter => letter.toUpperCase()));

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function arrayEntryLabel(value, index) {
  if (!isPlainObject(value)) return `Line ${index + 1}`;
  return value.itemName || value.ledgerName || value.name || value.productionNo || `Line ${index + 1}`;
}

function flattenChanges(before, after, path = []) {
  if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return [];
  if (before == null && isPlainObject(after)) return flattenChanges({}, after, path);
  if (after == null && isPlainObject(before)) return flattenChanges(before, {}, path);
  if (before == null && Array.isArray(after)) return flattenChanges([], after, path);
  if (after == null && Array.isArray(before)) return flattenChanges(before, [], path);
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].filter(key => !ignoredAuditFields.has(key) && !/(?:Id|By)$/i.test(key)).flatMap(key =>
      flattenChanges(before[key], after[key], [...path, key])
    );
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const count = Math.max(before.length, after.length);
    return Array.from({length:count}, (_, index) => {
      const entry = after[index] ?? before[index];
      return flattenChanges(before[index], after[index], [...path, arrayEntryLabel(entry, index)]);
    }).flat();
  }
  return [{field:path.map(fieldLabel).join(" · "),key:path[path.length - 1],before,after}];
}

function displayValue(value, key) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    const formatted = value.toLocaleString("en-IN", {maximumFractionDigits:4});
    return /amount|value|rate|debit|credit|balance|cost|price/i.test(key || "")
      ? `₹ ${value.toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2})}`
      : formatted;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-IN");
    }
  }
  if (isPlainObject(value) || Array.isArray(value)) return JSON.stringify(value, null, 2);
  return String(value);
}

function recordNumber(row) {
  const before = row.metadata?.before || {};
  const after = row.metadata?.after || {};
  return after.voucherNo || before.voucherNo ||
    after.productionNo || before.productionNo || after.jobNo || before.jobNo ||
    after.docNo || before.docNo || after.invoiceNo || before.invoiceNo ||
    after.purchaseNo || before.purchaseNo || after.name || before.name || "-";
}

function mongoRecordId(row) {
  const raw = row.entityId || "";
  return typeof raw === "object" ? raw._id || raw.id || "" : raw;
}

export default function BusinessAuditReport() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({from:monthStart,to:today,search:"",entity:"",action:""});
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({total:0,totalPages:0});
  const [expanded, setExpanded] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLogs(nextPage=page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({page:String(nextPage),limit:"100"});
      Object.entries(filters).forEach(([key,value]) => { if(value)params.set(key,value); });
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      const response = await fetch(`${API}/api/security/audit-logs?${params}`,{headers:{Authorization:`Bearer ${token}`}});
      const data = await response.json();
      if(!response.ok)throw new Error(data.message||"Could not load the audit report.");
      setLogs(Array.isArray(data.logs)?data.logs:[]);
      setPagination(data.pagination||{total:0,totalPages:0});
      setPage(nextPage);
      setExpanded("");
    } catch(requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{loadLogs(1);},[]);

  async function exportCsv() {
    setLoading(true);
    setError("");
    const allLogs=[];
    try{
      const token=localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
      let totalPages=1;
      for(let currentPage=1;currentPage<=totalPages;currentPage++){
        const params=new URLSearchParams({page:String(currentPage),limit:"100"});
        Object.entries(filters).forEach(([key,value])=>{if(value)params.set(key,value)});
        const response=await fetch(`${API}/api/security/audit-logs?${params}`,{headers:{Authorization:`Bearer ${token}`}});
        const data=await response.json();
        if(!response.ok)throw new Error(data.message||"Could not export the audit report.");
        allLogs.push(...(data.logs||[]));
        totalPages=data.pagination?.totalPages||0;
      }
    }catch(requestError){
      setError(requestError.message);
      setLoading(false);
      return;
    }
    const rows = [
      ["Date / Time","User","Email","Role","Action","Entity","Record No.","Mongo Record ID","Path","Before","After"],
      ...allLogs.map(row=>[
        dateTime(row.createdAt),row.actorUser?.name||row.actorName||"-",row.actorUser?.email||row.actorEmail||"-",row.actorUser?.role||row.actorRole||"-",
        row.action,row.entity,recordNumber(row),mongoRecordId(row),row.metadata?.path,jsonText(row.metadata?.before),jsonText(row.metadata?.after),
      ]),
    ];
    const contents=rows.map(row=>row.map(csvValue).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\uFEFF",contents],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");
    link.href=url;
    link.download=`business-audit-${filters.from||"all"}-${filters.to||"all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  }

  return <main className="gst-page">
    <header className="gst-topbar">
      <div className="gst-brand"><span className="gst-brand-mark">LOG</span><div><strong>Business Audit Report</strong><small>Record changes with user and before / after details</small></div></div>
      <button className="gst-back" type="button" onClick={()=>navigate("/accounts?section=master")}><ArrowLeft size={16}/> Accounts Masters & Operations</button>
    </header>
    <div className="gst-workspace">
      <aside className="gst-sidebar"><div className="gst-menu-heading">AUDIT REPORT</div><section className="gst-menu-group"><h2>BUSINESS RECORDS</h2><div className="gst-menu-item is-active">Create · Edit · Delete</div><p style={{padding:"6px 10px",color:"#71838e",fontSize:11,lineHeight:1.5}}>Changes include actor, timestamp, record path and captured before / after values.</p></section></aside>
      <section className="gst-content">
        <div className="gst-page-heading">
          <div><div className="gst-eyebrow">ACCOUNTS MASTERS & OPERATIONS</div><h1>Business Activity Log</h1><p>Audit trail of successful business record changes.</p></div>
          <div className="gst-actions"><button type="button" title="Refresh" aria-label="Refresh" onClick={()=>loadLogs(page)} disabled={loading}><RefreshCw size={16}/></button><button type="button" title="Export CSV" aria-label="Export CSV" onClick={exportCsv} disabled={!logs.length}><Download size={16}/></button><button type="button" title="Print" aria-label="Print" onClick={()=>window.print()}><Printer size={16}/></button></div>
        </div>
        <div className="gst-filterbar">
          <label>From date<input type="date" value={filters.from} max={filters.to} onChange={event=>setFilters(current=>({...current,from:event.target.value}))}/></label>
          <label>To date<input type="date" value={filters.to} min={filters.from} onChange={event=>setFilters(current=>({...current,to:event.target.value}))}/></label>
          <label>Search<input type="search" placeholder="User, action, route..." value={filters.search} onChange={event=>setFilters(current=>({...current,search:event.target.value}))}/></label>
          <label>Entity<input type="search" placeholder="e.g. PRODUCTION_ENTRY" value={filters.entity} onChange={event=>setFilters(current=>({...current,entity:event.target.value}))}/></label>
          <label>Action<input type="search" placeholder="e.g. UPDATED" value={filters.action} onChange={event=>setFilters(current=>({...current,action:event.target.value}))}/></label>
          <button type="button" className="gst-run" onClick={()=>loadLogs(1)} disabled={loading}>{loading?"Loading...":"Run report"}</button>
        </div>
        {error&&<div className="gst-error" role="alert">{error}</div>}
        <div className="gst-summary-grid">
          <div className="gst-summary"><span>Filtered changes</span><strong>{Number(pagination.total||0).toLocaleString("en-IN")}</strong></div>
          <div className="gst-summary"><span>Page</span><strong>{page} / {pagination.totalPages||0}</strong></div>
          <div className="gst-summary"><span>Entries on page</span><strong>{logs.length}</strong></div>
          <div className="gst-summary"><span>Record detail</span><strong>Before → After</strong></div>
        </div>
        <div className="gst-report-panel">
          <div className="gst-table-heading"><div><h2>Business Change Register</h2><p>{logs.length} entries · Page {page} of {pagination.totalPages||0}</p></div><span className="gst-source-label">AUDIT TRAIL</span></div>
          <div className="gst-table-scroll"><table className="gst-table"><thead><tr><th>Date / Time</th><th>User</th><th>Action</th><th>Record ID</th><th>Entity</th><th>Details</th></tr></thead><tbody>
            {logs.map(row=>{const changes=flattenChanges(row.metadata?.before,row.metadata?.after);return <React.Fragment key={row._id}><tr>
              <td>{dateTime(row.createdAt)}</td><td><b>{row.actorUser?.name||row.actorName||"Unknown user"}</b><small style={{display:"block",color:"#71838e"}}>{row.actorUser?.email||row.actorEmail||""} · {row.actorUser?.role||row.actorRole||""}</small></td>
              <td><span className="gst-source-label">{row.action}</span></td>
              <td><b>{recordNumber(row)}</b><small style={{display:"block",maxWidth:180,overflow:"hidden",color:"#71838e",fontFamily:"monospace",fontSize:9,textOverflow:"ellipsis"}} title={mongoRecordId(row)}>{mongoRecordId(row)||"No database ID"}</small></td>
              <td>{row.entity||"-"}</td>
              <td><button type="button" className="gst-menu-item" style={{display:"inline-block"}} onClick={()=>setExpanded(current=>current===row._id?"":row._id)}>{expanded===row._id?"Hide":"Before / After"}</button></td>
            </tr>
            {expanded===row._id&&<tr><td colSpan="6"><div style={{whiteSpace:"normal"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:12}}><div><b>{recordNumber(row)}</b><small style={{display:"block",marginTop:4,color:"#71838e"}}>{row.entity||"Business Record"} · ID: {mongoRecordId(row)||"-"}</small></div><span style={{color:"#71838e",fontSize:11}}>{row.actorUser?.name||row.actorName||"Unknown user"} · {row.actorUser?.role||row.actorRole||""}</span></div>
              <div className="gst-audit-diff"><table className="gst-table"><thead><tr><th>Field / Particular</th><th className="gst-audit-before">Before</th><th className="gst-audit-after">After</th></tr></thead><tbody>
                {changes.map((change,index)=><tr key={`${change.field}-${index}`}><td><b>{change.field}</b></td><td className="gst-audit-before">{displayValue(change.before,change.key)}</td><td className="gst-audit-after">{displayValue(change.after,change.key)}</td></tr>)}
                {!changes.length&&<tr><td colSpan="3" className="gst-empty">Field-level snapshots were not captured for this record.</td></tr>}
              </tbody></table></div>
              <details style={{marginTop:10}}><summary style={{cursor:"pointer",fontWeight:700}}>Full record snapshots</summary><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginTop:8}}>
                <div><b>Before</b><pre style={{maxHeight:340,overflow:"auto",padding:12,background:"#f3f7f9",border:"1px solid #d7e1e6",fontSize:10}}>{jsonText(row.metadata?.before)}</pre></div>
                <div><b>After</b><pre style={{maxHeight:340,overflow:"auto",padding:12,background:"#f3f7f9",border:"1px solid #d7e1e6",fontSize:10}}>{jsonText(row.metadata?.after)}</pre></div>
              </div></details>
              <div style={{marginTop:10,color:"#71838e",fontSize:10}}>Route: {row.metadata?.path||"-"} · {row.metadata?.message||""}</div>
            </div></td></tr>}
            </React.Fragment>})}
            {!logs.length&&<tr><td colSpan="6" className="gst-empty">{loading?"Loading audit records...":"No audit records found for the selected filters."}</td></tr>}
          </tbody></table></div>
          <footer className="gst-table-footer">Shows successful changes only. Before/after values are sanitized to exclude credentials. 100 records per page.</footer>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12}}>
          <button type="button" className="gst-run" disabled={loading||page<=1} onClick={()=>loadLogs(page-1)}>Previous</button>
          <span style={{fontSize:11,color:"#71838e"}}>{pagination.total?`${((page-1)*100)+1}–${Math.min(page*100,pagination.total)} of ${pagination.total}`:"0 records"}</span>
          <button type="button" className="gst-run" disabled={loading||page>=(pagination.totalPages||0)} onClick={()=>loadLogs(page+1)}>Next</button>
        </div>
      </section>
    </div>
  </main>;
}
