import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const monthStart = `${today.slice(0, 7)}-01`;
const qty = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "-";
const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export default function JobOrderStockReport() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ from: monthStart, to: today, party: "", product: "", jobNo: "" });
  const [rows, setRows] = useState([]);
  const [limited, setLimited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    produced: result.produced + row.producedQty,
    remaining: result.remaining + row.remainingQty,
  }), { planned: 0, produced: 0, remaining: 0 });

  function downloadCsv() {
    const columns = [
      ["Party", "partyName"], ["Date", "date"], ["Job Order", "jobNo"], ["Type", "type"],
      ["Product", "itemName"], ["Location", "location"], ["Planned Qty", "plannedQty"],
      ["Produced Qty", "producedQty"], ["Pending Production", "remainingQty"],
      ["Current Location Stock", "currentStockQty"], ["Unit", "unit"],
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
    const table = rows.map((row) => `<tr><td>${escape(row.partyName || "-")}</td><td>${dateLabel(row.date)}</td><td>${escape(row.jobNo)}</td><td>${escape(row.type)}</td><td>${escape(row.itemName)}</td><td>${escape(row.location)}</td><td>${qty(row.plannedQty)} ${escape(row.unit)}</td><td>${qty(row.producedQty)} ${escape(row.unit)}</td><td>${qty(row.remainingQty)} ${escape(row.unit)}</td><td>${qty(row.currentStockQty)} ${escape(row.unit)}</td></tr>`).join("");
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) {
      setError("Allow pop-ups to print this report.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>Job Order Stock Report</title><style>body{font:12px Arial;padding:20px;color:#172b4d}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #d0d5dd;padding:7px;text-align:left}th{background:#eef2f6}@page{size:landscape}</style></head><body><h1>Job Order Stock Report</h1><p>Party-wise · ${escape(filters.from || "All dates")} to ${escape(filters.to || "All dates")}</p><table><thead><tr><th>Party</th><th>Date</th><th>Job Order</th><th>Type</th><th>Product</th><th>Location</th><th>Planned</th><th>Produced</th><th>Pending Production</th><th>Current Location Stock</th></tr></thead><tbody>${table}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  return (
    <main style={styles.page}>
      <div style={styles.top}>
        <div>
          <button type="button" style={styles.back} onClick={() => navigate("/voucher")}>← Voucher Center</button>
          <h1 style={{ margin: "12px 0 4px" }}>Job Order Stock Report</h1>
          <p style={styles.muted}>Party-wise job orders, products, production progress and stock.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={styles.button} onClick={downloadCsv} disabled={!rows.length}>Export CSV</button>
          <button type="button" style={styles.button} onClick={printReport} disabled={!rows.length}>Print</button>
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
        <Summary label="Job order products" value={rows.length} />
        <Summary label="Planned output" value={qty(totals.planned)} />
        <Summary label="Produced" value={qty(totals.produced)} />
        <Summary label="Pending production" value={qty(totals.remaining)} />
      </section>
      <div style={styles.note}><b>Current Location Stock</b> is the total live stock for this product and location across batches; stock is not assigned to a specific job order after production.</div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead><tr>{["Party", "Date", "Job Order", "Type", "Product", "Location", "Planned", "Produced", "Pending Production", "Current Location Stock"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="10" style={styles.empty}>Loading report...</td></tr>
              : rows.length ? rows.map((row, index) => <tr key={`${row.jobId}-${row.itemName}-${index}`}>
                <td>{row.partyName || "-"}</td><td>{dateLabel(row.date)}</td><td>{row.jobNo}</td><td>{row.type === "GRADING" ? "Grading" : "Finished Goods"}</td>
                <td>{row.itemName}</td><td>{row.location}</td>
                <td>{qty(row.plannedQty)} {row.unit}</td><td>{qty(row.producedQty)} {row.unit}</td>
                <td>{qty(row.remainingQty)} {row.unit}</td><td>{qty(row.currentStockQty)} {row.unit}</td>
              </tr>) : <tr><td colSpan="10" style={styles.empty}>No job orders found for these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Summary({ label, value }) {
  return <div style={styles.summaryCard}><span>{label}</span><b>{value}</b></div>;
}

const styles = {
  page: { minHeight: "100vh", padding: 24, background: "#f5f7fb", color: "#172b4d", fontFamily: "Arial, sans-serif" },
  top: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 },
  muted: { color: "#667085", margin: 0 },
  back: { border: 0, background: "transparent", color: "#175cd3", padding: 0, cursor: "pointer", fontWeight: 600 },
  button: { border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", padding: "9px 13px", cursor: "pointer", fontWeight: 600 },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, background: "#fff", border: "1px solid #e4e7ec", borderRadius: 12, padding: 16 },
  label: { display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: "#475467" },
  input: { boxSizing: "border-box", width: "100%", border: "1px solid #d0d5dd", borderRadius: 7, padding: "9px 10px", font: "14px Arial" },
  error: { marginTop: 12, padding: 12, background: "#fef3f2", color: "#b42318", borderRadius: 8 },
  notice: { marginTop: 12, padding: 12, background: "#fffaeb", color: "#93370d", borderRadius: 8 },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, margin: "16px 0" },
  summaryCard: { display: "grid", gap: 7, background: "#fff", border: "1px solid #e4e7ec", borderRadius: 10, padding: 14 },
  note: { marginBottom: 12, color: "#475467", fontSize: 12, background: "#eef4ff", borderRadius: 8, padding: 11 },
  tableWrap: { overflowX: "auto", background: "#fff", border: "1px solid #e4e7ec", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 980 },
  empty: { padding: 24, textAlign: "center", color: "#667085" },
};
