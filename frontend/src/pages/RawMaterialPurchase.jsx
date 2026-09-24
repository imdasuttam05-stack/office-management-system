import React, { useEffect, useMemo, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const today = () => new Date().toISOString().slice(0, 10);
const blankLine = () => ({ itemName: "", hsn: "", unit: "KG", batchNo: "", barcode: "", mfgDate: "", expiryDate: "", qty: "", purchaseRate: "", discount: "", gstRate: "", gstType: "NONE" });

function headers() { return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` }; }
function money(n) { return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function RawMaterialPurchase() {
  const [form, setForm] = useState({ date: today(), location: "", supplierName: "", supplierGSTIN: "", supplierInvoiceNo: "", supplierInvoiceDate: "", transportCost: "", otherCost: "", remarks: "" });
  const [lines, setLines] = useState([blankLine()]);
  const [purchases, setPurchases] = useState([]);
  const [stock, setStock] = useState([]);
  const [tab, setTab] = useState("purchase");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [stockPagination, setStockPagination] = useState({ page: 1, pages: 1, total: 0 });

  const totals = useMemo(() => lines.reduce((a, l) => {
    const gross = Number(l.qty || 0) * Number(l.purchaseRate || 0);
    const taxable = Math.max(0, gross - Number(l.discount || 0));
    const gst = l.gstType === "NONE" ? 0 : taxable * Number(l.gstRate || 0) / 100;
    const cgst = l.gstType === "CGST_SGST" ? gst / 2 : 0;
    const sgst = l.gstType === "CGST_SGST" ? gst / 2 : 0;
    const igst = l.gstType === "IGST" ? gst : 0;
    return { taxable: a.taxable + taxable, cgst: a.cgst + cgst, sgst: a.sgst + sgst, igst: a.igst + igst };
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0 }), [lines]);
  const grand = totals.taxable + totals.cgst + totals.sgst + totals.igst + Number(form.transportCost || 0) + Number(form.otherCost || 0);

  useEffect(() => { if (tab === "purchase") loadPurchases(); }, [tab, page]);
  useEffect(() => { if (tab === "stock") loadStock(); }, [tab, stockPage]);

  async function loadPurchases() {
    setLoadingList(true); setError("");
    try { const r = await fetch(`${API_URL}/api/inventory/raw-material-purchases?page=${page}&limit=15&search=${encodeURIComponent(search)}`, { headers: headers() }); const d = await r.json(); if (!r.ok) throw new Error(d.message); setPurchases(d.items || []); setPagination(d.pagination || pagination); }
    catch (e) { setError(e.message || "Purchase list load failed."); } finally { setLoadingList(false); }
  }
  async function loadStock() {
    setLoadingList(true); setError("");
    try { const r = await fetch(`${API_URL}/api/inventory/raw-material-stock?page=${stockPage}&limit=20&search=${encodeURIComponent(search)}`, { headers: headers() }); const d = await r.json(); if (!r.ok) throw new Error(d.message); setStock(d.items || []); setStockPagination(d.pagination || stockPagination); }
    catch (e) { setError(e.message || "Stock load failed."); } finally { setLoadingList(false); }
  }
  function setField(name, value) { setForm(f => ({ ...f, [name]: value })); }
  function setLine(i, name, value) { setLines(a => a.map((x, idx) => idx === i ? { ...x, [name]: value } : x)); }
  function reset() { setForm({ date: today(), location: "", supplierName: "", supplierGSTIN: "", supplierInvoiceNo: "", supplierInvoiceDate: "", transportCost: "", otherCost: "", remarks: "" }); setLines([blankLine()]); }
  async function save() {
    setLoading(true); setError(""); setMessage("");
    try {
      const r = await fetch(`${API_URL}/api/inventory/raw-material-purchases`, { method: "POST", headers: headers(), body: JSON.stringify({ ...form, lines }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message || "Purchase save failed.");
      setMessage(d.message || "Purchase saved successfully."); reset(); setTab("purchase"); setPage(1); await loadPurchases();
    } catch (e) { setError(e.message || "Purchase save failed."); } finally { setLoading(false); }
  }

  return <div className="rmp-page">
    <style>{`.rmp-page{padding:22px;max-width:1400px;margin:auto}.rmp-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.rmp-head h2{margin:0;color:#172b4d}.rmp-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin-bottom:16px;box-shadow:0 4px 16px rgba(16,24,40,.04)}.rmp-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.rmp-field label{display:block;font-size:12px;color:#667085;margin-bottom:5px}.rmp-field input,.rmp-field select,.rmp-field textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d0d5dd;border-radius:8px;background:#fff}.rmp-field textarea{min-height:42px}.rmp-wide{grid-column:span 2}.rmp-table{width:100%;border-collapse:collapse;min-width:1100px}.rmp-table th,.rmp-table td{border-bottom:1px solid #eaecf0;padding:8px;text-align:left;font-size:12px;white-space:nowrap}.rmp-table th{background:#f8fafc}.rmp-table input,.rmp-table select{padding:7px;border:1px solid #d0d5dd;border-radius:6px;min-width:82px}.rmp-scroll{overflow:auto}.rmp-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:14px}.rmp-btn{border:0;border-radius:8px;padding:10px 14px;cursor:pointer;font-weight:600}.rmp-primary{background:#175cd3;color:#fff}.rmp-secondary{background:#eef2f6;color:#344054}.rmp-danger{background:#fee4e2;color:#b42318}.rmp-tabs{display:flex;gap:8px;margin-bottom:14px}.rmp-tab{border:1px solid #d0d5dd;background:#fff;padding:9px 14px;border-radius:8px;cursor:pointer}.rmp-tab.active{background:#175cd3;color:#fff;border-color:#175cd3}.rmp-msg{padding:10px;border-radius:8px;background:#ecfdf3;color:#027a48;margin-bottom:12px}.rmp-error{padding:10px;border-radius:8px;background:#fef3f2;color:#b42318;margin-bottom:12px}.rmp-summary{display:flex;justify-content:flex-end;gap:22px;flex-wrap:wrap;font-size:13px}.rmp-summary strong{color:#172b4d}.rmp-search{display:flex;gap:8px;margin-bottom:12px}.rmp-search input{padding:10px;border:1px solid #d0d5dd;border-radius:8px;flex:1}.rmp-pager{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;align-items:center}@media(max-width:900px){.rmp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.rmp-grid{grid-template-columns:1fr}.rmp-wide{grid-column:span 1}.rmp-page{padding:12px}}`}</style>
    <div className="rmp-head"><div><h2>Raw Material Purchase</h2><div style={{color:"#667085",fontSize:13}}>Purchase posts directly into Raw Material Stock.</div></div><button className="rmp-btn rmp-secondary" onClick={reset}>New Purchase</button></div>
    <div className="rmp-tabs"><button className={`rmp-tab ${tab === "purchase" ? "active" : ""}`} onClick={()=>setTab("purchase")}>Purchase</button><button className={`rmp-tab ${tab === "list" ? "active" : ""}`} onClick={()=>setTab("list")}>Purchase List</button><button className={`rmp-tab ${tab === "stock" ? "active" : ""}`} onClick={()=>setTab("stock")}>Raw Material Stock</button></div>
    {message && <div className="rmp-msg">{message}</div>}{error && <div className="rmp-error">{error}</div>}
    {tab === "purchase" && <>
      <div className="rmp-card"><div className="rmp-grid">
        <div className="rmp-field"><label>Purchase Date</label><input type="date" value={form.date} onChange={e=>setField("date",e.target.value)}/></div>
        <div className="rmp-field"><label>Location / Godown *</label><input value={form.location} onChange={e=>setField("location",e.target.value)} placeholder="Kolkata Warehouse"/></div>
        <div className="rmp-field"><label>Supplier *</label><input value={form.supplierName} onChange={e=>setField("supplierName",e.target.value)} placeholder="Supplier name"/></div>
        <div className="rmp-field"><label>Supplier GSTIN</label><input value={form.supplierGSTIN} onChange={e=>setField("supplierGSTIN",e.target.value.toUpperCase())}/></div>
        <div className="rmp-field"><label>Supplier Invoice No.</label><input value={form.supplierInvoiceNo} onChange={e=>setField("supplierInvoiceNo",e.target.value)}/></div>
        <div className="rmp-field"><label>Invoice Date</label><input type="date" value={form.supplierInvoiceDate} onChange={e=>setField("supplierInvoiceDate",e.target.value)}/></div>
        <div className="rmp-field"><label>Transport Cost</label><input type="number" min="0" value={form.transportCost} onChange={e=>setField("transportCost",e.target.value)}/></div>
        <div className="rmp-field"><label>Other Cost</label><input type="number" min="0" value={form.otherCost} onChange={e=>setField("otherCost",e.target.value)}/></div>
      </div></div>
      <div className="rmp-card"><div className="rmp-scroll"><table className="rmp-table"><thead><tr><th>Raw Material *</th><th>HSN</th><th>Unit</th><th>Batch</th><th>Barcode</th><th>MFG</th><th>Expiry</th><th>Qty *</th><th>Rate *</th><th>Discount</th><th>GST %</th><th>GST Type</th><th></th></tr></thead><tbody>{lines.map((l,i)=><tr key={i}><td><input value={l.itemName} onChange={e=>setLine(i,"itemName",e.target.value)} placeholder="Raw material"/></td><td><input value={l.hsn} onChange={e=>setLine(i,"hsn",e.target.value)}/></td><td><input value={l.unit} onChange={e=>setLine(i,"unit",e.target.value)}/></td><td><input value={l.batchNo} onChange={e=>setLine(i,"batchNo",e.target.value)}/></td><td><input value={l.barcode} onChange={e=>setLine(i,"barcode",e.target.value)}/></td><td><input type="date" value={l.mfgDate} onChange={e=>setLine(i,"mfgDate",e.target.value)}/></td><td><input type="date" value={l.expiryDate} onChange={e=>setLine(i,"expiryDate",e.target.value)}/></td><td><input type="number" min="0" value={l.qty} onChange={e=>setLine(i,"qty",e.target.value)}/></td><td><input type="number" min="0" value={l.purchaseRate} onChange={e=>setLine(i,"purchaseRate",e.target.value)}/></td><td><input type="number" min="0" value={l.discount} onChange={e=>setLine(i,"discount",e.target.value)}/></td><td><input type="number" min="0" max="100" value={l.gstRate} onChange={e=>setLine(i,"gstRate",e.target.value)}/></td><td><select value={l.gstType} onChange={e=>setLine(i,"gstType",e.target.value)}><option value="NONE">None</option><option value="CGST_SGST">CGST + SGST</option><option value="IGST">IGST</option></select></td><td><button className="rmp-btn rmp-danger" onClick={()=>setLines(a=>a.filter((_,x)=>x!==i))} disabled={lines.length===1}>×</button></td></tr>)}</tbody></table></div><button className="rmp-btn rmp-secondary" style={{marginTop:12}} onClick={()=>setLines(a=>[...a,blankLine()])}>+ Add Raw Material</button></div>
      <div className="rmp-card"><div className="rmp-grid"><div className="rmp-field rmp-wide"><label>Remarks</label><textarea value={form.remarks} onChange={e=>setField("remarks",e.target.value)}/></div></div><div className="rmp-summary"><span>Taxable: <strong>₹ {money(totals.taxable)}</strong></span><span>CGST: <strong>₹ {money(totals.cgst)}</strong></span><span>SGST: <strong>₹ {money(totals.sgst)}</strong></span><span>IGST: <strong>₹ {money(totals.igst)}</strong></span><span>Grand Total: <strong>₹ {money(grand)}</strong></span></div><div className="rmp-actions"><button className="rmp-btn rmp-secondary" onClick={reset}>Clear</button><button className="rmp-btn rmp-primary" disabled={loading} onClick={save}>{loading ? "Posting..." : "Post Purchase & Update Stock"}</button></div></div>
    </>}
    {(tab === "list" || tab === "stock") && <div className="rmp-card"><div className="rmp-search"><input placeholder="Search purchase / supplier / material" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter' && (tab==='list'?loadPurchases():loadStock())}/><button className="rmp-btn rmp-secondary" onClick={()=>{tab==='list'?loadPurchases():loadStock()}}>Search</button></div>{loadingList?<div>Loading...</div>:tab==='list'?<div className="rmp-scroll"><table className="rmp-table"><thead><tr><th>Purchase No</th><th>Date</th><th>Supplier</th><th>Location</th><th>Items</th><th>Total</th></tr></thead><tbody>{purchases.map(p=><tr key={p._id}><td>{p.purchaseNo}</td><td>{new Date(p.date).toLocaleDateString("en-IN")}</td><td>{p.supplierName}</td><td>{p.location}</td><td>{p.lines?.map(x=>`${x.itemName} (${x.qty} ${x.unit})`).join(", ")}</td><td>₹ {money(p.grandTotal)}</td></tr>)}</tbody></table></div>:<div className="rmp-scroll"><table className="rmp-table"><thead><tr><th>Material</th><th>Location</th><th>Batch</th><th>Barcode</th><th>Qty</th><th>Unit</th><th>Average Rate</th><th>Stock Value</th></tr></thead><tbody>{stock.map(s=><tr key={s._id}><td>{s.itemName}</td><td>{s.location}</td><td>{s.batchNo || "-"}</td><td>{s.barcode || "-"}</td><td>{s.qty}</td><td>{s.unit}</td><td>₹ {money(s.averageRate)}</td><td>₹ {money(s.stockValue)}</td></tr>)}</tbody></table></div>}
      <div className="rmp-pager"><button className="rmp-btn rmp-secondary" disabled={(tab==='list'?pagination:stockPagination).page<=1} onClick={()=>tab==='list'?setPage(p=>Math.max(1,p-1)):setStockPage(p=>Math.max(1,p-1))}>Prev</button><span>Page {(tab==='list'?pagination:stockPagination).page} / {(tab==='list'?pagination:stockPagination).pages || 1}</span><button className="rmp-btn rmp-secondary" disabled={(tab==='list'?pagination:stockPagination).page>=(tab==='list'?pagination:stockPagination).pages} onClick={()=>tab==='list'?setPage(p=>p+1):setStockPage(p=>p+1)}>Next</button></div>
    </div>}
  </div>;
}
