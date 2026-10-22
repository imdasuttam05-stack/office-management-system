import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const monthStart = `${today.slice(0, 7)}-01`;
const qty = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "-";
const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export default function JobOrderStockReport({ onBack }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ from: monthStart, to: today, party: "", product: "", jobNo: "" });
  const [rows, setRows] = useState([]);
  const [limited, setLimited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`${API}/api/inventory/job-orders/report${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || `Report request failed (${response.status}).`);
        return data;
      })
      .then((data) => {
        if (!active) return;
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setLimited(Boolean(data.limited));
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [query]);

  const totals = rows.reduce((result, row) => ({
    planned: result.planned + row.plannedQty,
    plannedPackets: result.plannedPackets + (row.plannedPacketCount || 0),
    produced: result.produced + row.producedQty,
    packets: result.packets + (row.producedPacketCount || 0),
    remaining: result.remaining + row.remainingQty,
    remainingPackets: result.remainingPackets + (row.remainingPacketCount || 0),
  }), { planned: 0, plannedPackets: 0, produced: 0, packets: 0, remaining: 0, remainingPackets: 0 });
  const jobOrderCount = new Set(rows.map((row) => row.jobId)).size;
  const partySummaries = useMemo(() => {
    const grouped = new Map();
    for (const row of rows) {
      const partyName = row.partyName || "-";
      const summary = grouped.get(partyName) || { partyName, jobs: new Set(), planned: 0, plannedPackets: 0, produced: 0, packets: 0, remaining: 0, remainingPackets: 0 };
      summary.jobs.add(row.jobId);
      summary.planned += row.plannedQty;
      summary.plannedPackets += row.plannedPacketCount || 0;
      summary.produced += row.producedQty;
      summary.packets += row.producedPacketCount || 0;
      summary.remaining += row.remainingQty;
      summary.remainingPackets += row.remainingPacketCount || 0;
      grouped.set(partyName, summary);
    }
    return [...grouped.values()].sort((a, b) => a.partyName.localeCompare(b.partyName));
  }, [rows]);

  async function showJobDetail(jobId) {
    setDetailLoading(true);
    setDetail(null);
    setError("");
    try {
      const response = await fetch(`${API}/api/inventory/job-orders/report/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `******"token") || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Job Order request failed (${response.status}).`);
      setDetail(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function downloadCsv() {
    const columns = [
      ["Party", "partyName"], ["Date", "date"], ["Job Order", "jobNo"], ["Type", "type"],
      ["Product", "itemName"], ["Location", "location"], ["Planned Packets", "plannedPacketCount"], ["Planned KG", "plannedQty"],
      ["Produced Packets", "producedPacketCount"], ["Produced KG", "producedQty"], ["Balance Packets", "remainingPacketCount"], ["Balance KG", "remainingQty"],
      ["Current Stock Packets", "currentStockPacketCount"], ["Current Location Stock", "currentStockQty"], ["Current Stock Unit", "currentStockUnit"], ["Unit", "unit"],
    ];
    const csv = [columns.map(([label]) => label), ...rows.map((row) => columns.map(([, key]) => key === "date" ? dateLabel(row[key]) : row[key] ?? ""))]
      .map((line) => line.map((cell) => {
        const value = String(cell);
        const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
        return `"${safeValue.replaceAll('"', '""')}"`;
      }).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `job-order-stock-${filters.from || "all"}-${filters.to || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const table = rows.map((row) => `<tr><td>${escape(row.partyName || "-")}</td><td>${dateLabel(row.date)}</td><td>${escape(row.jobNo)}</td><td>${escape(row.itemName)}</td><td>${qty(row.plannedPacketCount)} PCS</td><td>${qty(row.plannedQty)} ${escape(row.unit)}</td><td>${qty(row.producedPacketCount)} PCS</td><td>${qty(row.producedQty)} ${escape(row.unit)}</td><td>${qty(row.remainingPacketCount)} PCS</td><td>${qty(row.remainingQty)} ${escape(row.unit)}</td></tr>`).join("");
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) {
      setError("Allow pop-ups to print this report.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>Job Order Report</title><style>body{font:12px Arial;padding:20px;color:#172b4d}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #d0d5dd;padding:7px;text-align:left}th{background:#eef2f6}@page{size:landscape}</style></head><body><h1>Job Order Report</h1><p>Party-wise · ${escape(filters.from || "All dates")} to ${escape(filters.to || "All dates")}</p><table><thead><tr><th>Party</th><th>Job Date</th><th>Job Order</th><th>Product</th><th>Planned Packets</th><th>Planned KG</th><th>Produced Packets</th><th>Produced KG</th><th>Balance Packets</th><th>Balance KG</th></tr></thead><tbody>${table}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  return (
    <main className="jor-report-page" style={styles.page}>
      <style>{`
        .jor-summary-card span{color:#71838e;font-size:10px;text-transform:uppercase;letter-spacing:.045em;font-weight:800}
        .jor-summary-card b{color:#17374c;font-size:20px;font-variant-numeric:tabular-nums}
        .jor-party-title{margin:0;padding:14px 17px;color:#17374c;font-size:15px;font-weight:800;background:#eaf1f4;border:1px solid #d7e1e6;border-bottom:0}
        .jor-report-table th{position:sticky;top:0;background:#eaf1f4;color:#526a77;padding:11px 12px;font-size:10px;letter-spacing:.045em;text-transform:uppercase;border-bottom:1px solid #d7e1e6;text-align:left;white-space:nowrap}
        .jor-report-table td{padding:11px 12px;border-bottom:1px solid #edf1f3;color:#2f4654;vertical-align:middle}
        .jor-report-table tbody tr:nth-child(even){background:#fbfdfe}
        .jor-report-table tbody tr:hover{background:#f1f7f8}
        .jor-modal-table th{position:static}
        @media(max-width:640px){.jor-report-page{padding:12px!important}.jor-report-header{padding:18px!important}.jor-report-header h1{font-size:22px!important}}
      `}</style>
      <div className="jor-report-header" style={styles.top}>
        <div>
          <button type="button" style={styles.back} onClick={onBack || (() => navigate("/voucher"))}>← {onBack ? "Job Order" : "Voucher Center"}</button>
          <div style={styles.eyebrow}>PRODUCTION WORKFLOW · REPORT</div>
          <h1 style={{ margin: "6px 0 5px", color: "#fff", fontSize: 27, letterSpacing: "-.03em" }}>Job Order Stock Report</h1>
          <p style={styles.headerMuted}>Party-wise job orders, products, production progress and stock.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={styles.headerButton} onClick={downloadCsv} disabled={!rows.length}>Export CSV</button>
          <button type="button" style={styles.headerButtonPrimary} onClick={printReport} disabled={!rows.length}>Print Report</button>
        </div>
      </div>
      <section style={styles.filters}>
        {[
          ["from", "From date", "date"], ["to", "To date", "date"],
          ["party", "Party", "text"], ["product", "Product", "text"], ["jobNo", "Job order", "text"],
        ].map(([key, label, type]) => (
          <label key={key} style={styles.label}>
            <span>{label}</span>
            <input type={type} value={filters[key]} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} placeholder={type === "text" ? `Filter by ${label.toLowerCase()}` : undefined} style={styles.input} />
          </label>
        ))}
      </section>
      {error && <div role="alert" style={styles.error}>{error}</div>}
      {limited && <div style={styles.notice}>Showing the latest 5,000 job orders. Narrow the date range to see a smaller period.</div>}
      <section style={styles.summary}>
        <Summary label="Job orders" value={jobOrderCount} />
        <Summary label="Parties" value={partySummaries.length} />
        <Summary label="Planned (packets)" value={qty(totals.plannedPackets)} />
        <Summary label="Planned (KG)" value={qty(totals.planned)} />
        <Summary label="Produced (packets)" value={qty(totals.packets)} />
        <Summary label="Produced (KG)" value={qty(totals.produced)} />
        <Summary label="Balance (packets)" value={qty(totals.remainingPackets)} />
        <Summary label="Balance (KG)" value={qty(totals.remaining)} />
      </section>
      <section style={styles.partySummary}>
        <h2 className="jor-party-title">Party-wise Job Order Summary</h2>
        <div style={styles.tableWrap}>
          <table className="jor-report-table" style={styles.table}>
            <thead><tr>{["Party", "Job Orders", "Planned (Packets)", "Planned (KG)", "Produced (Packets)", "Produced (KG)", "Balance (Packets)", "Balance (KG)"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
            <tbody>{partySummaries.length ? partySummaries.map((party) => <tr key={party.partyName}>
              <td>{party.partyName}</td><td>{party.jobs.size}</td><td>{qty(party.plannedPackets)} PCS</td><td>{qty(party.planned)} KG</td><td>{qty(party.packets)} PCS</td><td>{qty(party.produced)} KG</td><td>{qty(party.remainingPackets)} PCS</td><td>{qty(party.remaining)} KG</td>
            </tr>) : <tr><td colSpan="8" style={styles.empty}>No party summary for these filters.</td></tr>}</tbody>
          </table>
        </div>
      </section>
      <div style={styles.note}><b>Planned KG</b> is calculated from planned packets × packet weight. Produced KG and balance KG are shown alongside packet counts. <b>Current Location Stock</b> is total live stock across batches, not stock assigned to a specific job order.</div>
      <div style={styles.tableWrap}>
        <table className="jor-report-table" style={styles.table}>
          <thead><tr>{["Party", "Job Date", "Job Order", "Product", "Planned (Packets)", "Planned (KG)", "Produced (Packets)", "Produced (KG)", "Balance (Packets)", "Balance (KG)", "Current Location Stock"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="11" style={styles.empty}>Loading report...</td></tr>
              : rows.length ? rows.map((row, index) => <tr key={`${row.jobId}-${row.itemName}-${index}`}>
                <td>{row.partyName || "-"}</td><td>{dateLabel(row.date)}</td>
                <td><button type="button" style={styles.jobLink} onClick={() => showJobDetail(row.jobId)}>{row.jobNo} · Details</button></td>
                <td>{row.itemName}</td><td>{qty(row.plannedPacketCount)} PCS</td><td>{qty(row.plannedQty)} {row.unit}</td>
                <td>{qty(row.producedPacketCount)} PCS</td><td>{qty(row.producedQty)} {row.unit}</td>
                <td>{qty(row.remainingPacketCount)} PCS</td><td>{qty(row.remainingQty)} {row.unit}</td><td>{row.packetWeightKg>0?`${qty(row.currentStockPacketCount)} PCS · ${qty(row.currentStockQty)} KG`:`${qty(row.currentStockQty)} ${row.currentStockUnit||row.unit}`}</td>
              </tr>) : <tr><td colSpan="11" style={styles.empty}>No job orders found for these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {(detailLoading || detail) && <div style={styles.overlay} role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
        <section style={styles.modal} role="dialog" aria-modal="true" aria-label="Job Order details">
          <div style={styles.modalHeader}>
            <div><h2 style={styles.sectionTitle}>{detail?.job?.jobNo || "Loading Job Order..."}</h2><span style={styles.muted}>Full Job Order and production details</span></div>
            <button type="button" style={styles.button} onClick={() => setDetail(null)}>Close</button>
          </div>
          {detailLoading ? <div style={styles.empty}>Loading Job Order details...</div> : detail && <>
            <div style={styles.detailGrid}>
              <div><b>Job Date</b><span>{dateLabel(detail.job.date)}</span></div><div><b>Party</b><span>{detail.job.partyName || "-"}</span></div>
              <div><b>Type</b><span>{detail.job.type === "GRADING" ? "Grading" : "Finished Goods"}</span></div><div><b>Location</b><span>{detail.job.location || "-"}</span></div>
              <div><b>Status</b><span>{detail.job.status || "-"}</span></div><div><b>Notes</b><span>{detail.job.notes || "-"}</span></div>
              <div><b>Labour Cost</b><span>₹ {qty(detail.job.labourCost)}</span></div><div><b>Transport Cost</b><span>₹ {qty(detail.job.transportCost)}</span></div>
              <div><b>Other Cost</b><span>₹ {qty(detail.job.otherCost)}</span></div><div><b>Total Cost</b><span>₹ {qty(detail.job.totalCost)}</span></div>
            </div>
            <h3 style={styles.subTitle}>Products, Production & Balance</h3>
            <div style={styles.tableWrap}><table className="jor-report-table jor-modal-table" style={styles.table}>
              <thead><tr>{["Product", "Planned (Packets)", "Planned (KG)", "Produced (Packets)", "Produced (KG)", "Balance (Packets)", "Balance (KG)"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{detail.products.map((product, index) => <tr key={`${product.itemName}-${index}`}>
                <td>{product.itemName}</td><td>{qty(product.plannedPacketCount)} PCS</td><td>{qty(product.plannedQty)} {product.unit}</td><td>{qty(product.producedPacketCount)} PCS</td>
                <td>{qty(product.producedQty)} {product.unit}</td><td>{qty(product.remainingPacketCount)} PCS</td><td>{qty(product.remainingQty)} {product.unit}</td>
              </tr>)}</tbody>
            </table></div>
            <h3 style={styles.subTitle}>Production Date-wise Details</h3>
            <div style={styles.tableWrap}><table className="jor-report-table jor-modal-table" style={styles.table}>
              <thead><tr>{["Production Date", "Production No.", "Product", "Packets", "Packet Weight (KG)", "Total (KG)", "Batch"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{detail.products.flatMap((product) => product.productions.map((production, index) => <tr key={`${production.productionNo}-${product.itemName}-${index}`}>
                <td>{dateLabel(production.date)}</td><td>{production.productionNo || "-"}</td><td>{production.itemName}</td>
                <td>{qty(production.packetCount)} PCS</td><td>{qty(production.packetWeightKg)}</td><td>{qty(production.qty)} {production.unit}</td><td>{production.batchNo || "-"}</td>
              </tr>))}{!detail.products.some((product) => product.productions.length) && <tr><td colSpan="7" style={styles.empty}>No production has been posted for this Job Order.</td></tr>}</tbody>
            </table></div>
            <h3 style={styles.subTitle}>Raw Materials Issued</h3>
            <div style={styles.tableWrap}><table className="jor-report-table jor-modal-table" style={styles.table}>
              <thead><tr>{["Raw Material", "Quantity", "Unit", "Batch"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{(detail.job.sourceItems || []).map((item, index) => <tr key={`${item.itemName}-${index}`}><td>{item.itemName}</td><td>{qty(item.qty)}</td><td>{item.unit || "KG"}</td><td>{item.batchNo || "-"}</td></tr>)}
                {!detail.job.sourceItems?.length && <tr><td colSpan="4" style={styles.empty}>No raw materials recorded.</td></tr>}</tbody>
            </table></div>
          </>}
        </section>
      </div>}
    </main>
  );
}

function Summary({ label, value }) {
  return <div className="jor-summary-card" style={styles.summaryCard}><span>{label}</span><b>{value}</b></div>;
}

const styles = {
  page: { minHeight: "100vh", padding: 24, background: "#f2f6f8", color: "#152a3a", fontFamily: '"Segoe UI", Arial, sans-serif' },
  top: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap", margin: "0 0 17px", padding: "20px 24px", borderRadius: 4, background: "#123c55", boxShadow: "0 8px 24px rgba(18,60,85,.12)" },
  eyebrow: { color: "#9bc8c1", fontSize: 10, fontWeight: 800, letterSpacing: "1.4px", marginTop: 12 },
  muted: { color: "#667085", margin: 0 },
  headerMuted: { color: "#c8d9e2", margin: 0, fontSize: 13 },
  back: { border: "1px solid #668194", borderRadius: 2, background: "transparent", color: "#fff", padding: "7px 10px", cursor: "pointer", fontWeight: 700, fontSize: 11 },
  headerButton: { border: "1px solid #668194", borderRadius: 2, background: "transparent", color: "#fff", padding: "10px 13px", cursor: "pointer", fontWeight: 700, fontSize: 12 },
  headerButtonPrimary: { border: "1px solid #e3b53d", borderRadius: 2, background: "#f4c648", color: "#183348", padding: "10px 14px", cursor: "pointer", fontWeight: 800, fontSize: 12 },
  button: { border: "1px solid #cbd8df", borderRadius: 2, background: "#fff", color: "#31586b", padding: "9px 13px", cursor: "pointer", fontWeight: 700 },
  jobLink: { border: 0, padding: 0, background: "transparent", color: "#27786e", cursor: "pointer", font: "inherit", fontWeight: 750, textDecoration: "underline", textUnderlineOffset: 3 },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 13, background: "#fff", border: "1px solid #d7e1e6", borderRadius: 3, padding: 18, boxShadow: "0 2px 8px rgba(18,60,85,.035)" },
  label: { display: "grid", gap: 7, fontSize: 11, fontWeight: 750, color: "#526a77" },
  input: { boxSizing: "border-box", width: "100%", minHeight: 38, border: "1px solid #cbd8df", borderRadius: 2, padding: "9px 10px", color: "#203c4e", background: "#fff", font: '13px "Segoe UI", Arial, sans-serif', outlineColor: "#27786e" },
  error: { marginTop: 12, padding: 12, background: "#fff0f0", color: "#8d2828", borderLeft: "3px solid #c34545", borderRadius: 2 },
  notice: { marginTop: 12, padding: 12, background: "#fff6df", color: "#71560d", borderLeft: "3px solid #e3b53d", borderRadius: 2 },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 11, margin: "16px 0" },
  summaryCard: { display: "grid", gap: 8, background: "#fff", border: "1px solid #d7e1e6", borderTop: "2px solid #27786e", borderRadius: 2, padding: 15 },
  partySummary: { marginBottom: 16 },
  sectionTitle: { margin: 0, color: "#17374c", fontSize: 18, fontWeight: 750 },
  subTitle: { margin: "20px 0 10px", color: "#27786e", fontSize: 13, fontWeight: 800 },
  note: { marginBottom: 12, color: "#426172", fontSize: 12, lineHeight: 1.6, background: "#e5eff4", borderLeft: "3px solid #27786e", borderRadius: 2, padding: "12px 14px" },
  tableWrap: { overflow: "auto", background: "#fff", border: "1px solid #d7e1e6", borderRadius: 2, boxShadow: "0 2px 8px rgba(18,60,85,.035)" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 980, fontSize: 12 },
  empty: { padding: 24, textAlign: "center", color: "#71838e" },
  overlay: { position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 20, background: "rgba(12,35,49,.62)", backdropFilter: "blur(2px)" },
  modal: { boxSizing: "border-box", width: "min(1100px, 100%)", maxHeight: "90vh", overflow: "auto", padding: 22, border: "1px solid #d7e1e6", borderTop: "3px solid #27786e", borderRadius: 3, background: "#f8fbfc", boxShadow: "0 20px 50px rgba(16,24,40,.25)" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #dfe7eb" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, padding: 15, border: "1px solid #d7e1e6", background: "#fff", borderRadius: 2 },
};
