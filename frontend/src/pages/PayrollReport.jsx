import React, { useEffect, useMemo, useState } from "react";
import { hrApi } from "../lib/hrApi.js";
import { sendSalarySlipToWhatsApp } from "../lib/whatsappSalarySlip.js";

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PayrollReport() {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sharingId, setSharingId] = useState("");

  async function load() {
    try {
      setError("");

      const r = await hrApi.salaryReport(
        `?month=${month}&year=${year}`
      );

      setRows(Array.isArray(r.salaries) ? r.salaries : []);
    } catch (e) {
      setError(e.message || "Unable to load payroll report.");
    }
  }

  useEffect(() => {
    load();
  }, [month, year]);

  const total = useMemo(
    () =>
      rows.reduce(
        (a, x) => ({
          ot: a.ot + Number(x.overtimeAmount || 0),
          cut: a.cut + Number(x.cuttingAmount || 0),
          gross: a.gross + Number(x.grossSalary || 0),
          net: a.net + Number(x.netSalary || 0),
        }),
        { ot: 0, cut: 0, gross: 0, net: 0 }
      ),
    [rows]
  );

  async function sendWhatsApp(row) {
    try {
      setSharingId(row._id);
      setError("");
      setMessage("");

      const detailed = await hrApi.detailedSalarySlip(row._id);

      sendSalarySlipToWhatsApp({
        salary: row,
        detailed,
      });

      setMessage(
        `WhatsApp opened for ${
          detailed?.slip?.employeeName ||
          row.employeeId?.name ||
          "employee"
        }.`
      );
    } catch (e) {
      setError(e.message || "Unable to open WhatsApp.");
    } finally {
      setSharingId("");
    }
  }

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <header style={S.head}>
          <div>
            <h1>Payroll Report</h1>
            <p>
              Approved overtime and cutting reflected in salary.
            </p>
          </div>

          <div style={S.filters}>
            <select
              style={S.input}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString(
                    "en-IN",
                    { month: "long" }
                  )}
                </option>
              ))}
            </select>

            <input
              style={S.input}
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
        </header>

        {message ? <div style={S.success}>{message}</div> : null}
        {error ? <div style={S.err}>{error}</div> : null}

        <div style={S.cards}>
          <div style={S.card}>
            <b>{rows.length}</b>
            <span>Employees</span>
          </div>

          <div style={S.card}>
            <b>{money(total.ot)}</b>
            <span>Approved OT Amount</span>
          </div>

          <div style={S.card}>
            <b>{money(total.cut)}</b>
            <span>Cutting Deduction</span>
          </div>

          <div style={S.card}>
            <b>{money(total.net)}</b>
            <span>Net Payable</span>
          </div>
        </div>

        <section style={S.table}>
          <div style={S.th}>
            <span>Employee</span>
            <span>Present</span>
            <span>OT Hours</span>
            <span>OT Amount</span>
            <span>Cutting</span>
            <span>Gross</span>
            <span>Net Payable</span>
            <span>Action</span>
          </div>

          {rows.map((x) => (
            <div style={S.tr} key={x._id}>
              <span>
                <b>{x.employeeId?.name || "-"}</b>
                <small>
                  {x.employeeId?.employeeCode || ""}
                </small>
              </span>

              <span>{x.presentDays || 0}</span>

              <span>
                {Number(x.overtimeHours || 0).toFixed(2)} h
              </span>

              <span>{money(x.overtimeAmount)}</span>

              <span>
                {Math.floor(
                  Number(x.cuttingMinutes || 0) / 60
                )}
                h{" "}
                {String(
                  Number(x.cuttingMinutes || 0) % 60
                ).padStart(2, "0")}
                m
              </span>

              <span>{money(x.grossSalary)}</span>

              <strong>{money(x.netSalary)}</strong>

              <button
                type="button"
                style={S.whatsapp}
                onClick={() => sendWhatsApp(x)}
                disabled={sharingId === x._id}
              >
                {sharingId === x._id
                  ? "Opening..."
                  : "WhatsApp"}
              </button>
            </div>
          ))}

          {rows.length === 0 && (
            <div style={S.empty}>
              No salary records found.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  wrap: {
    maxWidth: 1400,
    margin: "0 auto",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
  },
  filters: {
    display: "flex",
    gap: 8,
  },
  input: {
    padding: 11,
    border: "1px solid #d0d5dd",
    borderRadius: 9,
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    margin: "20px 0",
  },
  card: {
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 5px 18px rgba(15,23,42,.05)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  table: {
    background: "#fff",
    borderRadius: 14,
    overflow: "hidden",
  },
  th: {
    display: "grid",
    gridTemplateColumns:
      "1.5fr .6fr .8fr 1fr 1fr 1fr 1fr .9fr",
    gap: 10,
    padding: 14,
    background: "#eef2f7",
    fontWeight: 700,
    fontSize: 13,
  },
  tr: {
    display: "grid",
    gridTemplateColumns:
      "1.5fr .6fr .8fr 1fr 1fr 1fr 1fr .9fr",
    gap: 10,
    padding: 14,
    borderTop: "1px solid #eef2f7",
    alignItems: "center",
    fontSize: 13,
  },
  whatsapp: {
    border: 0,
    borderRadius: 8,
    padding: "8px 10px",
    background: "#e9f9ef",
    color: "#16803a",
    cursor: "pointer",
    fontWeight: 700,
  },
  empty: {
    padding: 24,
    textAlign: "center",
    color: "#667085",
  },
  success: {
    background: "#ecfdf3",
    color: "#027a48",
    padding: 12,
    borderRadius: 10,
    margin: "15px 0",
  },
  err: {
    background: "#fee4e2",
    color: "#b42318",
    padding: 12,
    borderRadius: 10,
    margin: "15px 0",
  },
};
