import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./GSTReports.css";

const API = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const today = new Date().toISOString().slice(0, 10);
const dateTime = value => value ? new Date(value).toLocaleString("en-IN") : "-";
const monthName = value => new Date(`${value}-01T00:00:00`).toLocaleDateString("en-IN", {month:"long",year:"numeric"});
const csvValue = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
const jsonText = value => value == null ? "-" : JSON.stringify(value, null, 2);
const auditCategories = [
  {id:"purchase",label:"Purchase",key:"F11"},
  {id:"sale",label:"Sale",key:"F12"},
  {id:"jobOrder",label:"Job Order",key:"F13"},
  {id:"production",label:"Production",key:"F14"},
  {id:"grading",label:"Grading",key:"F15"},
  {id:"pi",label:"PI",key:"F16"},
  {id:"return",label:"Return",key:"F17"},
  {id:"damage",label:"Damage",key:"F18"},
  {id:"repacking",label:"Repacking",key:"F19"},
  {id:"packingConversion",label:"Packing Conversion",key:"F20"},
  {id:"jobOrderReport",label:"Job Order Report"},
  {id:"bomCosting",label:"BOM / Costing"},
  {id:"stockLedger",label:"Stock / Ledger"},
  {id:"documents",label:"Documents"},
  {id:"masters",label:"Masters"},
];
const actionTypes = [
  {id:"created",label:"Create / Post"},
  {id:"edited",label:"Edit"},
  {id:"deleted",label:"Delete"},
  {id:"cancelled",label:"Cancel"},
];
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
  _id:"Record ID", companyId:"Company ID", jobId:"Job Order ID", itemId:"Product ID",
  createdBy:"Created By", financialYear:"Financial Year", status:"Status",
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

function SnapshotValue({value, fieldKey = ""}) {
  if (Array.isArray(value)) {
    if (!value.length) return <span className="gst-audit-snapshot-empty">No entries</span>;
    return <div className="gst-audit-snapshot-list">
      {value.map((entry,index)=><article className="gst-audit-snapshot-item" key={`${fieldKey}-${index}`}>
        <h4>{arrayEntryLabel(entry,index)}</h4>
        <SnapshotValue value={entry} fieldKey={fieldKey}/>
      </article>)}
    </div>;
  }
  if (isPlainObject(value)) {
    const entries=Object.entries(value);
    if (!entries.length) return <span className="gst-audit-snapshot-empty">No details</span>;
    return <div className="gst-audit-snapshot-fields">
      {entries.map(([key,child])=><div className="gst-audit-snapshot-field" key={key}>
        <span>{fieldLabel(key)}</span>
        <div><SnapshotValue value={child} fieldKey={key}/></div>
      </div>)}
    </div>;
  }
  return <span className={fieldKey.toLowerCase().endsWith("id")||fieldKey==="_id"?"gst-audit-snapshot-id":""}>
    {displayValue(value,fieldKey)}
  </span>;
}

function recordNumber(row) {
  const before = row.metadata?.before || {};
  const after = row.metadata?.after || {};
  const knownNumber=after.voucherNo || before.voucherNo ||
    after.productionNo || before.productionNo || after.jobNo || before.jobNo ||
    after.docNo || before.docNo || after.invoiceNo || before.invoiceNo ||
    after.purchaseNo || before.purchaseNo || after.name || before.name;
  if(knownNumber)return knownNumber;
  const label=String(row.metadata?.recordLabel||"");
  return label.includes(" · ") ? label.slice(label.lastIndexOf(" · ")+3) : "-";
}

function mongoRecordId(row) {
  const raw = row.entityId || "";
  return typeof raw === "object" ? raw._id || raw.id || "" : raw;
}

export default function BusinessAuditReport() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({search:"",entity:"",action:""});
  const [year, setYear] = useState(Number(today.slice(0,4)));
  const [activeCategory, setActiveCategory] = useState("purchase");
  const [monthlySummary, setMonthlySummary] = useState({});
  const [selectedMonth, setSelectedMonth] = useState("");
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({total:0,totalPages:0});
  const [expanded, setExpanded] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchInputRef = useRef(null);
  const returnMonthRef = useRef("");
  const focusFirstRowRef = useRef(false);

  async function loadLogs(nextPage=page, category=activeCategory, month=selectedMonth) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({page:String(nextPage),limit:"100"});
      Object.entries(filters).forEach(([key,value]) => { if(value)params.set(key,value); });
      if(category)params.set("category",category);
      if(month)params.set("month",month);
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

  async function loadSummary(selectedYear=year) {
    setLoading(true);
    setError("");
    try {
      const token=localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
      const response=await fetch(`${API}/api/security/audit-log-summary?year=${selectedYear}`,{headers:{Authorization:`Bearer ${token}`}});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"Could not load monthly audit counts.");
      setMonthlySummary(data.summary||{});
      returnMonthRef.current = "";
      setSelectedMonth("");
      setLogs([]);
      setPagination({total:0,totalPages:0});
      setExpanded("");
    } catch(requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{loadSummary(year);},[]);

  useEffect(()=>{
    const categoryByFunctionKey=new Map(auditCategories.filter(category=>category.key).map(category=>[category.key,category.id]));
    const handleShortcut=event=>{
      const category=categoryByFunctionKey.get(event.key);
      const isTyping=["INPUT","TEXTAREA","SELECT"].includes(event.target?.tagName);
      if(!category||isTyping)return;
      event.preventDefault();
      returnMonthRef.current = "";
      setActiveCategory(category);
      setSelectedMonth("");
      setLogs([]);
      setPagination({total:0,totalPages:0});
      setExpanded("");
    };
    window.addEventListener("keydown",handleShortcut);
    return()=>window.removeEventListener("keydown",handleShortcut);
  },[]);

  useEffect(()=>{
    if(selectedMonth||!returnMonthRef.current)return;
    const month=returnMonthRef.current;
    returnMonthRef.current="";
    requestAnimationFrame(()=>{
      const button=[...document.querySelectorAll("[data-audit-month]")].find(item=>item.dataset.auditMonth===month);
      button?.focus();
    });
  },[selectedMonth]);

  useEffect(()=>{
    if(!focusFirstRowRef.current)return;
    focusFirstRowRef.current=false;
    document.querySelector(".gst-audit-detail-button")?.focus();
  },[logs]);

  function categoryMonthCounts(category, month) {
    const counts={created:0,edited:0,deleted:0,cancelled:0};
    for(const row of monthlySummary[category]||[]) {
      if(row.month===month&&counts[row.activityType]!==undefined)counts[row.activityType]+=row.count;
    }
    return counts;
  }

  function logActionType(row) {
    const message=String(row.metadata?.message||"");
    const status=String(row.metadata?.after?.status||"").toUpperCase();
    if(status==="CANCELLED"||status==="CANCELED"||/\bcancel(?:led|ed|lation)\b/i.test(message))return "cancelled";
    if(String(row.action||"").includes("DELETED"))return "deleted";
    if(String(row.action||"").includes("UPDATED"))return "edited";
    return "created";
  }

  function handleCategoryKeyDown(event) {
    if(event.key==="ArrowRight"&&!selectedMonth){
      const firstMonth=document.querySelector("[data-audit-month]");
      if(firstMonth){
        event.preventDefault();
        firstMonth.focus();
        return;
      }
    }
    handleListKeyDown(event,"[data-audit-category]");
  }

  function handleListKeyDown(event, selector, onBoundary) {
    if(!["ArrowDown","ArrowUp","ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    const buttons=[...event.currentTarget.querySelectorAll(selector)].filter(button=>!button.disabled);
    if(!buttons.length)return;
    const index=buttons.indexOf(document.activeElement);
    if(event.key==="Home"||event.key==="End"){
      event.preventDefault();
      buttons[event.key==="Home"?0:buttons.length-1].focus();
      return;
    }
    if(index<0){
      event.preventDefault();
      buttons[0].focus();
      return;
    }
    const current=buttons[index].getBoundingClientRect();
    const vertical=event.key==="ArrowUp"||event.key==="ArrowDown";
    const direction=event.key==="ArrowUp"||event.key==="ArrowLeft"?-1:1;
    const candidates=buttons.map((button,buttonIndex)=>{
      if(buttonIndex===index)return null;
      const rect=button.getBoundingClientRect();
      const primary=vertical?rect.top-current.top:rect.left-current.left;
      if(primary*direction<=0)return null;
      const secondary=vertical?rect.left-current.left:rect.top-current.top;
      return {button,score:Math.abs(primary)+Math.abs(secondary)*2};
    }).filter(Boolean).sort((left,right)=>left.score-right.score);
    event.preventDefault();
    if(!candidates.length){
      onBoundary?.(event);
      return;
    }
    candidates[0].button.focus();
  }

  function handleContentKeyDown(event) {
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="f"){
      event.preventDefault();
      searchInputRef.current?.focus();
      return;
    }
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="e"){
      event.preventDefault();
      if(selectedMonth&&logs.length)exportCsv();
      return;
    }
    if(event.key==="Escape"){
      if(expanded){
        event.currentTarget.querySelector(`[data-audit-record="${CSS.escape(expanded)}"]`)?.focus();
        setExpanded("");
        event.stopPropagation();
      }else if(selectedMonth){
        returnMonthRef.current=selectedMonth;
        setSelectedMonth("");
        setLogs([]);
        setPagination({total:0,totalPages:0});
      }else{
        document.querySelector('[data-audit-category][aria-pressed="true"]')?.focus();
      }
      return;
    }
    if(selectedMonth&&(event.key==="PageUp"||event.key==="PageDown")){
      const nextPage=event.key==="PageUp"?Math.max(1,page-1):Math.min(pagination.totalPages||page,page+1);
      if(nextPage!==page){
        event.preventDefault();
        focusFirstRowRef.current=true;
        loadLogs(nextPage);
      }
    }
  }

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
        if(activeCategory)params.set("category",activeCategory);
        if(selectedMonth)params.set("month",selectedMonth);
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
    link.download=`business-audit-${activeCategory}-${selectedMonth||year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  }

  return <main className="gst-page" onKeyDown={handleContentKeyDown}>
    <header className="gst-topbar">
      <div className="gst-brand"><span className="gst-brand-mark">LOG</span><div><strong>Business Audit Report</strong><small>Record changes with user and before / after details</small></div></div>
      <button className="gst-back" type="button" onClick={()=>navigate("/accounts?section=master")}><ArrowLeft size={16}/> Accounts Masters & Operations</button>
    </header>
    <div className="gst-workspace">
      <aside className="gst-sidebar">
        <div className="gst-menu-heading">AUDIT REPORT</div>
        <section className="gst-menu-group">
          <h2>VOUCHERS & OPERATIONS</h2>
          <div className="gst-audit-category-list" onKeyDown={handleCategoryKeyDown}>
            {auditCategories.map(category=><button
              type="button"
              key={category.id}
              data-audit-category
              className={`gst-menu-item ${activeCategory===category.id?"is-active":""}`}
              aria-pressed={activeCategory===category.id}
              onClick={()=>{returnMonthRef.current="";setActiveCategory(category.id);setSelectedMonth("");setLogs([]);setPagination({total:0,totalPages:0});setExpanded("")}}
            ><span>{category.label}</span>{category.key&&<kbd>{category.key}</kbd>}</button>)}
          </div>
          <p className="gst-audit-help">Arrow keys to move · Enter to select · → months · F11–F20 category shortcuts.</p>
        </section>
      </aside>
      <section className="gst-content">
        <div className="gst-page-heading">
          <div><div className="gst-eyebrow">ACCOUNTS MASTERS & OPERATIONS</div><h1>Business Activity Log</h1><p>Audit trail of successful business record changes.</p></div>
          <div className="gst-actions"><button type="button" title="Refresh" aria-label="Refresh" onClick={()=>selectedMonth?loadLogs(page):loadSummary(year)} disabled={loading}><RefreshCw size={16}/></button><button type="button" title="Export CSV" aria-label="Export CSV" onClick={exportCsv} disabled={!logs.length||loading}><Download size={16}/></button><button type="button" title="Print" aria-label="Print" onClick={()=>window.print()}><Printer size={16}/></button></div>
        </div>
        <div className="gst-filterbar gst-audit-toolbar">
          <label>Financial year<select value={year} onChange={event=>{const selected=Number(event.target.value);setYear(selected);loadSummary(selected)}}>{Array.from({length:7},(_,index)=>Number(today.slice(0,4))-index).map(option=><option key={option} value={option}>{option}–{String(option+1).slice(-2)}</option>)}</select></label>
          <label>Find entry<input ref={searchInputRef} type="search" placeholder="Voucher no., party, product, or user..." value={filters.search} onChange={event=>setFilters(current=>({...current,search:event.target.value}))} onKeyDown={event=>{if(event.key==="Enter"&&selectedMonth){focusFirstRowRef.current=true;loadLogs(1)}}}/></label>
          {selectedMonth&&<button type="button" className="gst-run" onClick={()=>loadLogs(1)} disabled={loading}>{loading?"Loading...":"Search month"}</button>}
          {selectedMonth&&<button type="button" className="gst-run gst-audit-back" onClick={()=>{returnMonthRef.current=selectedMonth;setSelectedMonth("");setLogs([]);setPagination({total:0,totalPages:0});setExpanded("")}}>All months</button>}
        </div>
        {error&&<div className="gst-error" role="alert">{error}</div>}
        {!selectedMonth&&<section className="gst-audit-month-panel">
          <div className="gst-table-heading"><div><h2>{auditCategories.find(category=>category.id===activeCategory)?.label} · Monthly Activity</h2><p>Select a month to see its Create, Edit, Delete and Cancel records.</p></div><span className="gst-source-label">{year}–{String(year+1).slice(-2)}</span></div>
          <div className="gst-audit-month-grid" onKeyDown={event=>handleListKeyDown(event,"[data-audit-month]",keyEvent=>{
            if(keyEvent.key==="ArrowLeft"){
              document.querySelector('[data-audit-category][aria-pressed="true"]')?.focus();
            }
          })}>
            {Array.from({length:12},(_,index)=>new Date(Date.UTC(year,index+3,1)).toISOString().slice(0,7)).reverse().map(month=>{
              const counts=categoryMonthCounts(activeCategory,month),total=Object.values(counts).reduce((sum,count)=>sum+count,0);
              return <button type="button" data-audit-month={month} key={month} disabled={loading} className="gst-audit-month-card" onClick={()=>{returnMonthRef.current=month;focusFirstRowRef.current=true;setSelectedMonth(month);loadLogs(1,activeCategory,month)}}>
                <span className="gst-audit-month-title">{monthName(month)}</span>
                <strong className="gst-audit-month-total">{total.toLocaleString("en-IN")} <small>entries</small></strong>
                <span className="gst-audit-month-counts">{actionTypes.map(action=><span key={action.id} className={`gst-audit-count gst-audit-count-${action.id}`}><b>{counts[action.id]}</b> {action.label}</span>)}</span>
                <span className="gst-audit-open-hint">Enter to open month</span>
              </button>;
            })}
          </div>
          {activeCategory==="jobOrderReport"&&<div className="gst-notice"><button type="button" className="gst-run" onClick={()=>navigate("/accounts?section=transactions&tab=job-order-report")}>Open Job Order Report</button></div>}
        </section>}
        {selectedMonth&&<>
        <div className="gst-report-panel">
          <div className="gst-table-heading"><div><h2>{auditCategories.find(category=>category.id===activeCategory)?.label} · {monthName(selectedMonth)}</h2><p>{Number(pagination.total||0).toLocaleString("en-IN")} activities · Page {page} of {pagination.totalPages||0}</p></div><span className="gst-source-label">ACTIVITY REGISTER</span></div>
          <div className="gst-table-scroll" onKeyDown={event=>handleListKeyDown(event,"button.gst-audit-detail-button")}><table className="gst-table"><thead><tr><th>Date / Time</th><th>User</th><th>Action</th><th>Record ID</th><th>Entity</th><th>Details</th></tr></thead><tbody>
            {logs.map(row=>{const changes=flattenChanges(row.metadata?.before,row.metadata?.after);return <React.Fragment key={row._id}><tr>
              <td>{dateTime(row.createdAt)}</td><td><b>{row.actorUser?.name||row.actorName||"Unknown user"}</b><small style={{display:"block",color:"#71838e"}}>{row.actorUser?.email||row.actorEmail||""} · {row.actorUser?.role||row.actorRole||""}</small></td>
              <td><span className={`gst-audit-action gst-audit-count-${logActionType(row)}`}>{actionTypes.find(action=>action.id===logActionType(row))?.label||row.action}</span></td>
              <td><b>{recordNumber(row)}</b><small style={{display:"block",maxWidth:180,overflow:"hidden",color:"#71838e",fontFamily:"monospace",fontSize:9,textOverflow:"ellipsis"}} title={mongoRecordId(row)}>{mongoRecordId(row)||"No database ID"}</small></td>
              <td>{row.entity||"-"}</td>
              <td><button type="button" data-audit-record={row._id} className="gst-menu-item gst-audit-detail-button" aria-expanded={expanded===row._id} onClick={()=>setExpanded(current=>current===row._id?"":row._id)}>{expanded===row._id?"Close full details":"View full report"} <span>↵</span></button></td>
            </tr>
            {expanded===row._id&&<tr><td colSpan="6"><div style={{whiteSpace:"normal"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:12}}><div><b>{recordNumber(row)}</b><small style={{display:"block",marginTop:4,color:"#71838e"}}>{row.entity||"Business Record"} · ID: {mongoRecordId(row)||"-"}</small></div><span style={{color:"#71838e",fontSize:11}}>{row.actorUser?.name||row.actorName||"Unknown user"} · {row.actorUser?.role||row.actorRole||""}</span></div>
              <div className="gst-audit-diff"><table className="gst-table"><thead><tr><th>Field / Particular</th><th className="gst-audit-before">Before</th><th className="gst-audit-after">After</th></tr></thead><tbody>
                {changes.map((change,index)=><tr key={`${change.field}-${index}`}><td><b>{change.field}</b></td><td className="gst-audit-before">{displayValue(change.before,change.key)}</td><td className="gst-audit-after">{displayValue(change.after,change.key)}</td></tr>)}
                {!changes.length&&<tr><td colSpan="3" className="gst-empty">Field-level snapshots were not captured for this record.</td></tr>}
              </tbody></table></div>
              <details className="gst-audit-snapshots">
                <summary>Full record snapshots <span>View every saved field</span></summary>
                <div className="gst-audit-snapshot-grid">
                  <section className="gst-audit-snapshot-panel gst-audit-before">
                    <header><span>BEFORE</span><strong>Previous record values</strong></header>
                    <SnapshotValue value={row.metadata?.before}/>
                  </section>
                  <section className="gst-audit-snapshot-panel gst-audit-after">
                    <header><span>AFTER</span><strong>Saved record values</strong></header>
                    <SnapshotValue value={row.metadata?.after}/>
                  </section>
                </div>
              </details>
              <div style={{marginTop:10,color:"#71838e",fontSize:10}}>Route: {row.metadata?.path||"-"} · {row.metadata?.message||""}</div>
            </div></td></tr>}
            </React.Fragment>})}
            {!logs.length&&<tr><td colSpan="6" className="gst-empty">{loading?"Loading audit records...":"No audit records found for the selected filters."}</td></tr>}
          </tbody></table></div>
          <footer className="gst-table-footer">↑/↓ move between records · Enter opens full details · Escape returns · Page Up/Down changes page · Ctrl+F searches · Ctrl+E exports. Before/after values exclude credentials.</footer>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12}}>
          <button type="button" className="gst-run" disabled={loading||page<=1} onClick={()=>loadLogs(page-1)}>Previous</button>
          <span style={{fontSize:11,color:"#71838e"}}>{pagination.total?`${((page-1)*100)+1}–${Math.min(page*100,pagination.total)} of ${pagination.total}`:"0 records"}</span>
          <button type="button" className="gst-run" disabled={loading||page>=(pagination.totalPages||0)} onClick={()=>loadLogs(page+1)}>Next</button>
        </div>
        </>}
      </section>
    </div>
  </main>;
}
