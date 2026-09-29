import React, { useEffect, useState } from "react";
import { hrApi } from "../lib/hrApi.js";
import { sendSalarySlipToWhatsApp } from "../lib/whatsappSalarySlip.js";

export default function Salary() {
  const now = new Date();

  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    employeeId: "",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    bonus: 0,
    deductions: 0,
    overtimeRate: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sharingId, setSharingId] = useState("");

  async function load() {
    try {
      setError("");

      const [e, s] = await Promise.all([
        hrApi.employees(),
        hrApi.salaries(),
      ]);

      const employeeRows = Array.isArray(e.employees) ? e.employees : [];
      const salaryRows = Array.isArray(s.salaries) ? s.salaries : [];

      setEmployees(employeeRows);
      setRows(salaryRows);

      if (!form.employeeId && employeeRows[0]) {
        setForm((f) => ({
          ...f,
          employeeId: employeeRows[0]._id,
        }));
      }
    } catch (e) {
      setError(e.message || "Unable to load salary data.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate(e) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await hrApi.generateSalary({
        ...form,
        month: Number(form.month),
        year: Number(form.year),
        bonus: Number(form.bonus || 0),
        deductions: Number(form.deductions || 0),
        overtimeRate: form.overtimeRate
          ? Number(form.overtimeRate)
          : undefined,
      });

      setMessage("Salary generated / recalculated successfully.");
      await load();
    } catch (e) {
      setError(e.message || "Unable to generate salary.");
    } finally {
      setLoading(false);
    }
  }

  async function openSlip(row) {
    try {
      setError("");
      const data = await hrApi.salarySlip(row._id);

      const salary = data?.salary || row;
      const employee = salary?.employeeId || {};

      window.alert(
        [
          "Salary Slip",
          "",
          `Employee: ${employee.name || row.employeeId?.name || "-"}`,
          `Employee ID: ${employee.employeeCode || row.employeeId?.employeeCode || "-"}`,
          `Month: ${salary.month}/${salary.year}`,
          `Gross Salary: ₹${Number(salary.grossSalary || 0).toLocaleString("en-IN")}`,
          `Net Salary: ₹${Number(salary.netSalary || 0).toLocaleString("en-IN")}`,
        ].join("\n")
      );
    } catch (e) {
      setError(e.message || "Unable to open salary slip.");
    }
  }

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
        `WhatsApp opened for ${detailed?.slip?.employeeName || row.employeeId?.name || "employee"}.`
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
        <header style={S.header}>
          <div>
            <h1 style={S.h1}>Salary & Payroll</h1>
            <p style={S.sub}>
              Attendance-based salary with overtime, bonus and deductions
            </p>
          </div>
        </header>

        {message ? <div style={S.success}>{message}</div> : null}
        {error ? <div style={S.error}>{error}</div> : null}

        <form onSubmit={generate} style={S.card}>
          <div style={S.formGrid}>
            <label style={S.field}>
              Employee
              <select
                style={S.input}
                value={form.employeeId}
                onChange={(e) =>
                  setForm({ ...form, employeeId: e.target.value })
                }
              >
                <option value="">Select Employee</option>
                {employees.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                    {x.employeeCode ? ` (${x.employeeCode})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={S.field}>
              Month
              <input
                type="number"
                min="1"
                max="12"
                style={S.input}
                value={form.month}
                onChange={(e) =>
                  setForm({ ...form, month: e.target.value })
                }
              />
            </label>

            <label style={S.field}>
              Year
              <input
                type="number"
                style={S.input}
                value={form.year}
                onChange={(e) =>
                  setForm({ ...form, year: e.target.value })
                }
              />
            </label>

            <label style={S.field}>
              Bonus
              <input
                type="number"
                style={S.input}
                value={form.bonus}
                onChange={(e) =>
                  setForm({ ...form, bonus: e.target.value })
                }
              />
            </label>

            <label style={S.field}>
              Manual Deductions
              <input
                type="number"
                style={S.input}
                value={form.deductions}
                onChange={(e) =>
                  setForm({ ...form, deductions: e.target.value })
                }
              />
            </label>

            <label style={S.field}>
              OT Rate / Hour
              <input
                type="number"
                style={S.input}
                value={form.overtimeRate}
                onChange={(e) =>
                  setForm({ ...form, overtimeRate: e.target.value })
                }
                placeholder="Optional"
              />
            </label>
          </div>

          <button style={S.btn} disabled={loading}>
            {loading ? "Processing..." : "Generate / Recalculate"}
          </button>
        </form>

        <section style={S.card}>
          <div style={S.tableHead}>
            <span>Employee</span>
            <span>Month</span>
            <span>Present</span>
            <span>Absent</span>
            <span>Gross</span>
            <span>Net Payable</span>
            <span>Actions</span>
          </div>

          {rows.length === 0 ? (
            <div style={S.empty}>
              No salary records found for the selected period.
            </div>
          ) : (
            rows.map((x) => (
              <div key={x._id} style={S.row}>
                <div>
                  <b>{x.employeeId?.name || "-"}</b>
                  <small>
                    {x.employeeId?.employeeCode || ""}
                  </small>
                </div>

                <span>
                  {x.month}/{x.year}
                </span>

                <span>{x.presentDays || 0}</span>
                <span>{x.absentDays || 0}</span>

                <span>
                  ₹{Number(x.grossSalary || 0).toLocaleString("en-IN")}
                </span>

                <strong>
                  ₹{Number(x.netSalary || 0).toLocaleString("en-IN")}
                </strong>

                <div style={S.actions}>
                  <button
                    type="button"
                    style={S.viewBtn}
                    onClick={() => openSlip(x)}
                  >
                    View Slip
                  </button>

                  <button
                    type="button"
                    style={S.whatsappBtn}
                    onClick={() => sendWhatsApp(x)}
                    disabled={sharingId === x._id}
                    title="Open WhatsApp with salary slip details"
                  >
                    {sharingId === x._id
                      ? "Opening..."
                      : "WhatsApp"}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

const S = {
  page: {
    padding: 24,
    background: "#f5f7fb",
    minHeight: "100vh",
    fontFamily: "Arial, sans-serif",
  },
  wrap: {
    maxWidth: 1400,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h1: {
    margin: 0,
    color: "#172b4d",
  },
  sub: {
    color: "#667085",
    marginTop: 7,
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 18,
    marginTop: 18,
    boxShadow: "0 8px 24px rgba(15,23,42,.06)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#344054",
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    padding: 12,
    border: "1px solid #d9e1ec",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
  },
  btn: {
    padding: "12px 18px",
    background: "#1d4f91",
    color: "#fff",
    border: 0,
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1.6fr .7fr .7fr .7fr 1fr 1fr 1.5fr",
    gap: 10,
    padding: "12px 0",
    color: "#475467",
    fontWeight: 700,
    fontSize: 13,
    borderBottom: "2px solid #eef2f6",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1.6fr .7fr .7fr .7fr 1fr 1fr 1.5fr",
    gap: 10,
    padding: "14px 0",
    borderBottom: "1px solid #eef2f6",
    alignItems: "center",
    fontSize: 13,
  },
  actions: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
  },
  viewBtn: {
    border: 0,
    borderRadius: 8,
    padding: "8px 10px",
    background: "#edf4ff",
    color: "#1d4f91",
    cursor: "pointer",
    fontWeight: 700,
  },
  whatsappBtn: {
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
    marginTop: 15,
  },
  error: {
    background: "#fee4e2",
    color: "#b42318",
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
  },
};
