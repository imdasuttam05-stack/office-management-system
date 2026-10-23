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
      ["Date / Time","User","Email","Role","Action","Entity","Record ID","Path","Before","After"],
      ...allLogs.map(row=>[
        dateTime(row.createdAt),row.actorUser?.name||row.actorName||"-",row.actorUser?.email||row.actorEmail||"-",row.actorUser?.role||row.actorRole||"-",
        row.action,row.entity,row.entityId,row.metadata?.path,jsonText(row.metadata?.before),jsonText(row.metadata?.after),
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
          <div className="gst-table-scroll"><table className="gst-table"><thead><tr><th>Date / Time</th><th>User</th><th>Action</th><th>Entity</th><th>Record ID</th><th>Details</th></tr></thead><tbody>
            {logs.map(row=><React.Fragment key={row._id}><tr>
              <td>{dateTime(row.createdAt)}</td><td><b>{row.actorUser?.name||row.actorName||"Unknown user"}</b><small style={{display:"block",color:"#71838e"}}>{row.actorUser?.email||row.actorEmail||""} · {row.actorUser?.role||row.actorRole||""}</small></td>
              <td><span className="gst-source-label">{row.action}</span></td><td>{row.entity||"-"}</td><td>{row.entityId||"-"}</td>
              <td><button type="button" className="gst-menu-item" style={{display:"inline-block"}} onClick={()=>setExpanded(current=>current===row._id?"":row._id)}>{expanded===row._id?"Hide":"Before / After"}</button></td>
            </tr>
            {expanded===row._id&&<tr><td colSpan="6"><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,whiteSpace:"normal"}}>
              <div><b>Before</b><pre style={{maxHeight:340,overflow:"auto",padding:12,background:"#f3f7f9",border:"1px solid #d7e1e6",fontSize:10}}>{jsonText(row.metadata?.before)}</pre></div>
              <div><b>After</b><pre style={{maxHeight:340,overflow:"auto",padding:12,background:"#f3f7f9",border:"1px solid #d7e1e6",fontSize:10}}>{jsonText(row.metadata?.after)}</pre></div>
              <div style={{gridColumn:"1/-1",color:"#71838e",fontSize:10}}>Route: {row.metadata?.path||"-"} · {row.metadata?.message||""}</div>
            </div></td></tr>}
            </React.Fragment>)}
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
