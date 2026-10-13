import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import "./GSTReports.css";

const API_URL = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const reportGroups = [
  { title: "GST Returns / Computations", items: ["Track GST Return Activities", "GSTR-1", "GSTR-3B", "Annual Computation"] },
  { title: "Exchange Reports", items: ["e-Invoice", "e-Way Bill"] },
  { title: "Reconciliation Reports", items: ["GSTR-1 Reconciliation", "GSTR-2A Reconciliation", "GSTR-2B Reconciliation", "Challan Reconciliation"] },
  { title: "GST Tools", items: ["Invoice Management System (IMS)", "GST Utilities", "Other Reports"] },
];

const amount = (value) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (value) => `₹${amount(value)}`;
const dateText = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const taxOf = (row) => Number(row.cgst || 0) + Number(row.sgst || 0) + Number(row.igst || 0);
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function fyStartDate() {
  const today = new Date();
  return `${today.getFullYear() - (today.getMonth() < 3 ? 1 : 0)}-04-01`;
}

function monthLabel(value) {
  return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function GSTReports() {
  const navigate = useNavigate();
  const [activeReport, setActiveReport] = useState("GSTR-1");
  const [from, setFrom] = useState(fyStartDate);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      const response = await fetch(`${API_URL}/api/inventory/gst-report?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "GST report could not be loaded.");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setRefreshedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (requestError) {
      setError(requestError.message || "GST report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReport(); }, []);

  const reportData = useMemo(() => buildReport(activeReport, rows), [activeReport, rows]);
  const inputRows = rows.filter((row) => row.sourceType === "PURCHASE");
  const outputRows = rows.filter((row) => row.sourceType === "SALE");
  const inputTax = inputRows.reduce((sum, row) => sum + taxOf(row), 0);
  const outputTax = outputRows.reduce((sum, row) => sum + taxOf(row), 0);
  const taxableValue = rows.reduce((sum, row) => sum + Number(row.taxableAmount || 0), 0);

  function exportCsv() {
    const content = [reportData.columns.map((column) => csvCell(column.label)).join(","), ...reportData.rows.map((row) => reportData.columns.map((column) => csvCell(column.value(row))).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeReport.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="gst-page">
      <header className="gst-topbar">
        <div className="gst-brand"><span className="gst-brand-mark">GST</span><div><strong>GST Reports</strong><small>Returns, registers and reconciliation</small></div></div>
        <button className="gst-back" type="button" onClick={() => navigate("/dashboard")}><ArrowLeft size={16} /> Dashboard</button>
      </header>

      <div className="gst-workspace">
        <aside className="gst-sidebar" aria-label="GST report menu">
          <div className="gst-menu-heading">REPORTS MENU</div>
          {reportGroups.map((group) => (
            <section className="gst-menu-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map((item) => <button type="button" key={item} className={`gst-menu-item${activeReport === item ? " is-active" : ""}`} onClick={() => setActiveReport(item)}>{item}</button>)}
            </section>
          ))}
        </aside>

        <section className="gst-content">
          <div className="gst-page-heading">
            <div><div className="gst-eyebrow">GOODS AND SERVICES TAX</div><h1>{activeReport}</h1><p>Company books data for the selected reporting period.</p></div>
            <div className="gst-actions">
              <button type="button" title="Refresh report" aria-label="Refresh report" onClick={loadReport} disabled={loading}><RefreshCw size={16} className={loading ? "gst-spinning" : ""} /></button>
              <button type="button" title="Export CSV" aria-label="Export CSV" onClick={exportCsv}><Download size={16} /></button>
              <button type="button" title="Print or save PDF" aria-label="Print or save PDF" onClick={() => window.print()}><Printer size={16} /></button>
            </div>
          </div>

          <div className="gst-filterbar">
            <label>From date<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
            <label>To date<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
            <button type="button" className="gst-run" onClick={loadReport} disabled={loading}><FileSpreadsheet size={15} />{loading ? "Loading..." : "Run report"}</button>
            <span className="gst-refresh-note">{refreshedAt ? `Updated ${refreshedAt}` : ""}</span>
          </div>

          {error && <div className="gst-error" role="alert">{error}</div>}
          {reportData.notice && <div className="gst-notice">{reportData.notice}</div>}

          <div className="gst-summary-grid">
            <Summary label="Sales tax (output)" value={money(outputTax)} tone="green" />
            <Summary label="Purchase tax (input)" value={money(inputTax)} tone="blue" />
            <Summary label="Net tax position" value={money(outputTax - inputTax)} tone="amber" />
            <Summary label="Taxable value" value={money(taxableValue)} tone="ink" />
          </div>

          <div className="gst-report-panel">
            <div className="gst-table-heading"><div><h2>{reportData.heading}</h2><p>{reportData.rows.length.toLocaleString("en-IN")} rows · {from} to {to}</p></div><span className="gst-source-label">BOOKS REGISTER</span></div>
            <div className="gst-table-scroll">
              <table className="gst-table"><thead><tr>{reportData.columns.map((column) => <th key={column.label} className={column.numeric ? "numeric" : ""}>{column.label}</th>)}</tr></thead>
                <tbody>{reportData.rows.map((row, index) => <tr key={`${row.documentNo || row.period || row.hsn || "row"}-${index}`}>{reportData.columns.map((column) => <td key={column.label} className={column.numeric ? "numeric" : ""}>{column.render ? column.render(row) : column.value(row)}</td>)}</tr>)}
                  {!reportData.rows.length && <tr><td className="gst-empty" colSpan={reportData.columns.length}>{loading ? "Loading GST records..." : "No GST transactions found for this period."}</td></tr>}
                </tbody>
              </table>
            </div>
            <footer className="gst-table-footer">Showing up to 5,000 GST ledger entries. Values are based on posted transactions in your books.</footer>
          </div>
          <p className="gst-disclaimer">GST return filing, portal reconciliation and e-Invoice / e-Way Bill generation require GSTN or IRP integration. This workspace reports your recorded books data only.</p>
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value, tone }) {
  return <div className={`gst-summary gst-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function buildReport(name, allRows) {
  const input = allRows.filter((row) => row.sourceType === "PURCHASE");
  const output = allRows.filter((row) => row.sourceType === "SALE");
  const invoiceColumns = [
    { label: "Date", value: (row) => dateText(row.date) },
    { label: "Document no.", value: (row) => row.documentNo || "-" },
    { label: "Party", value: (row) => row.partyName || "-" },
    { label: "GSTIN", value: (row) => row.partyGSTIN || "Unregistered" },
    { label: "HSN / SAC", value: (row) => row.hsn || "-" },
    { label: "Tax rate", value: (row) => `${Number(row.gstRate || 0)}%` },
    { label: "Taxable value", value: (row) => money(row.taxableAmount), numeric: true },
    { label: "CGST", value: (row) => money(row.cgst), numeric: true },
    { label: "SGST", value: (row) => money(row.sgst), numeric: true },
    { label: "IGST", value: (row) => money(row.igst), numeric: true },
    { label: "Total tax", value: (row) => money(taxOf(row)), numeric: true },
  ];

  if (name === "GSTR-1" || name === "GSTR-1 Reconciliation" || name === "e-Invoice" || name === "e-Way Bill") {
    const notices = {
      "GSTR-1 Reconciliation": "Portal upload data is not connected. Compare this books register with the downloaded GSTN GSTR-1 file before filing.",
      "e-Invoice": "IRP credentials and invoice registration are not connected. This is the eligible sales invoice register, not generated IRNs.",
      "e-Way Bill": "E-Way Bill portal data is not connected. Review the sales register for transport-document preparation.",
    };
    return { heading: name === "GSTR-1" ? "Outward supplies register" : name, rows: output, columns: invoiceColumns, notice: notices[name] || "GSTR-1 summary from posted sales transactions. Portal filing status is not available here." };
  }

  if (["GSTR-2A Reconciliation", "GSTR-2B Reconciliation", "Invoice Management System (IMS)"].includes(name)) {
    const notice = name === "Invoice Management System (IMS)"
      ? "IMS actions and supplier invoices from GSTN are not connected. Purchase invoices below are your books register."
      : `${name.slice(0, 6)} portal data is not connected. Import the GSTN statement to compare it with these purchase records.`;
    return { heading: "Inward supplies / purchase register", rows: input, columns: invoiceColumns, notice };
  }

  if (name === "GSTR-3B" || name === "Challan Reconciliation") {
    const data = [
      { section: "Outward supplies", taxable: sum(output, "taxableAmount"), cgst: sum(output, "cgst"), sgst: sum(output, "sgst"), igst: sum(output, "igst") },
      { section: "Eligible input tax credit", taxable: sum(input, "taxableAmount"), cgst: sum(input, "cgst"), sgst: sum(input, "sgst"), igst: sum(input, "igst") },
      { section: "Net tax position", taxable: sum(output, "taxableAmount") - sum(input, "taxableAmount"), cgst: sum(output, "cgst") - sum(input, "cgst"), sgst: sum(output, "sgst") - sum(input, "sgst"), igst: sum(output, "igst") - sum(input, "igst") },
    ];
    return { heading: name === "GSTR-3B" ? "Tax liability and input tax credit" : "Tax liability summary (challan data unavailable)", rows: data, notice: name === "GSTR-3B" ? "Books-based summary only. Validate eligibility and adjustments before filing GSTR-3B." : "Payment challans and GSTN cash / credit ledger are not connected; this is a books-based net tax estimate.", columns: [
      { label: "Particulars", value: (row) => row.section },
      { label: "Taxable value", value: (row) => money(row.taxable), numeric: true },
      { label: "CGST", value: (row) => money(row.cgst), numeric: true },
      { label: "SGST", value: (row) => money(row.sgst), numeric: true },
      { label: "IGST", value: (row) => money(row.igst), numeric: true },
      { label: "Total tax", value: (row) => money(row.cgst + row.sgst + row.igst), numeric: true },
    ] };
  }

  if (name === "Track GST Return Activities" || name === "Annual Computation") {
    const byMonth = new Map();
    allRows.forEach((row) => {
      const period = new Date(row.date).toISOString().slice(0, 7);
      const bucket = byMonth.get(period) || { period, salesDocs: new Set(), purchaseDocs: new Set(), outputTax: 0, inputTax: 0, taxable: 0 };
      bucket[(row.sourceType === "SALE" ? "salesDocs" : "purchaseDocs")].add(row.documentNo);
      bucket[row.sourceType === "SALE" ? "outputTax" : "inputTax"] += taxOf(row);
      bucket.taxable += Number(row.taxableAmount || 0);
      byMonth.set(period, bucket);
    });
    const data = [...byMonth.values()].sort((a, b) => b.period.localeCompare(a.period)).map((row) => ({ ...row, salesDocs: row.salesDocs.size, purchaseDocs: row.purchaseDocs.size }));
    return { heading: name === "Annual Computation" ? "Financial year tax computation by month" : "Return-period activity from books", rows: data, notice: "Return filing dates and filed / pending status are not linked to the GST portal.", columns: [
      { label: "Period", value: (row) => monthLabel(row.period) },
      { label: "Sales invoices", value: (row) => row.salesDocs, numeric: true },
      { label: "Purchase invoices", value: (row) => row.purchaseDocs, numeric: true },
      { label: "Taxable value", value: (row) => money(row.taxable), numeric: true },
      { label: "Output tax", value: (row) => money(row.outputTax), numeric: true },
      { label: "Input tax", value: (row) => money(row.inputTax), numeric: true },
      { label: "Net tax", value: (row) => money(row.outputTax - row.inputTax), numeric: true },
    ] };
  }

  if (name === "GST Utilities") {
    const byHsn = new Map();
    allRows.forEach((row) => {
      const key = row.hsn || "Not specified";
      const bucket = byHsn.get(key) || { hsn: key, invoices: new Set(), taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      bucket.invoices.add(row.documentNo);
      bucket.taxable += Number(row.taxableAmount || 0);
      bucket.cgst += Number(row.cgst || 0);
      bucket.sgst += Number(row.sgst || 0);
      bucket.igst += Number(row.igst || 0);
      byHsn.set(key, bucket);
    });
    return { heading: "HSN / SAC summary", rows: [...byHsn.values()].map((row) => ({ ...row, invoices: row.invoices.size })), notice: "Use this HSN summary to review your books. Validate HSN classification and rates before return upload.", columns: [
      { label: "HSN / SAC", value: (row) => row.hsn },
      { label: "Documents", value: (row) => row.invoices, numeric: true },
      { label: "Taxable value", value: (row) => money(row.taxable), numeric: true },
      { label: "CGST", value: (row) => money(row.cgst), numeric: true },
      { label: "SGST", value: (row) => money(row.sgst), numeric: true },
      { label: "IGST", value: (row) => money(row.igst), numeric: true },
    ] };
  }

  const byParty = new Map();
  allRows.forEach((row) => {
    const key = `${row.sourceType}-${row.partyGSTIN || row.partyName || "Unknown"}`;
    const bucket = byParty.get(key) || { type: row.sourceType === "SALE" ? "Sales" : "Purchase", partyName: row.partyName || "-", partyGSTIN: row.partyGSTIN || "Unregistered", documents: new Set(), taxable: 0, tax: 0 };
    bucket.documents.add(row.documentNo);
    bucket.taxable += Number(row.taxableAmount || 0);
    bucket.tax += taxOf(row);
    byParty.set(key, bucket);
  });
  return { heading: "Party-wise GST summary", rows: [...byParty.values()].map((row) => ({ ...row, documents: row.documents.size })), notice: "Summary is grouped from purchase and sales GST ledger entries.", columns: [
    { label: "Type", value: (row) => row.type },
    { label: "Party", value: (row) => row.partyName },
    { label: "GSTIN", value: (row) => row.partyGSTIN },
    { label: "Documents", value: (row) => row.documents, numeric: true },
    { label: "Taxable value", value: (row) => money(row.taxable), numeric: true },
    { label: "GST amount", value: (row) => money(row.tax), numeric: true },
  ] };
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}
