import React, { useEffect, useMemo, useState } from "react";
import { hrApi } from "../lib/hrApi.js";

function fmtDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatOT(value) {
  const totalMinutes = Math.round(
    Number(value || 0) * 60
  );

  if (totalMinutes <= 0) return "0h 00m";

  return `${Math.floor(totalMinutes / 60)}h ${String(
    totalMinutes % 60
  ).padStart(2, "0")}m`;
}

function formatCutting(value) {
  const totalMinutes = Math.round(
    Number(value || 0)
  );

  if (totalMinutes <= 0) return "0h 00m";

  return `${Math.floor(totalMinutes / 60)}h ${String(
    totalMinutes % 60
  ).padStart(2, "0")}m`;
}

function getEmployee(row) {
  return row.employeeId || {};
}

function getShift(row) {
  return row.shiftId || {};
}

export default function PayrollApprovals() {
  const today = new Date();

  const [month, setMonth] = useState(
    String(today.getMonth() + 1).padStart(2, "0")
  );

  const [year, setYear] = useState(
    String(today.getFullYear())
  );

  const [rows, setRows] = useState([]);

  const [selected, setSelected] = useState([]);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [approveOT, setApproveOT] = useState(true);

  const [approveCutting, setApproveCutting] =
    useState(true);

  const [bulkOTChoice, setBulkOTChoice] = useState("approve");
  const [bulkCuttingChoice, setBulkCuttingChoice] = useState("approve");

  const [filter, setFilter] = useState("All");

  async function load() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      setSelected([]);

      const response =
        await hrApi.payrollApprovals(
          `?month=${Number(month)}&year=${Number(year)}`
        );

      setRows(response.approvals || []);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load payroll approvals."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month, year]);

  const filteredRows = useMemo(() => {
    if (filter === "Overtime") {
      return rows.filter(
        (row) =>
          Number(row.overtimeHours || 0) > 0
      );
    }

    if (filter === "Cutting") {
      return rows.filter(
        (row) =>
          Number(row.cuttingMinutes || 0) > 0
      );
    }

    if (filter === "Pending") {
      return rows.filter(
        (row) =>
          (Number(row.overtimeHours || 0) > 0 &&
            !row.overtimeApproved) ||
          (Number(row.cuttingMinutes || 0) > 0 &&
            !row.cuttingApproved)
      );
    }

    if (filter === "Approved") {
      return rows.filter(
        (row) =>
          (Number(row.overtimeHours || 0) <= 0 ||
            row.overtimeApproved) &&
          (Number(row.cuttingMinutes || 0) <= 0 ||
            row.cuttingApproved)
      );
    }

    return rows;
  }, [rows, filter]);

  const allFilteredSelected =
    filteredRows.length > 0 &&
    filteredRows.every((row) =>
      selected.includes(row._id)
    );

  function toggleOne(id) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    );
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((current) =>
        current.filter(
          (id) =>
            !filteredRows.some(
              (row) => row._id === id
            )
        )
      );

      return;
    }

    setSelected((current) => [
      ...new Set([
        ...current,
        ...filteredRows.map((row) => row._id)
      ])
    ]);
  }

  async function approveSelected() {
    if (!selected.length) {
      setError(
        "Please select at least one attendance record."
      );
      return;
    }

    if (bulkOTChoice === "keep" && bulkCuttingChoice === "keep") {
      setError("Choose OT and/or Cutting: Approve or Do Not Approve.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = { ids: selected };
      if (bulkOTChoice !== "keep") payload.overtimeApproved = bulkOTChoice === "approve";
      if (bulkCuttingChoice !== "keep") payload.cuttingApproved = bulkCuttingChoice === "approve";
      const response = await hrApi.approvePayrollAdjustments(payload);

      setMessage(
        response?.message ||
          "Payroll adjustments approved successfully."
      );

      setSelected([]);

      await load();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to approve payroll adjustments."
      );
    } finally {
      setSaving(false);
    }
  }

  async function setSingleAdjustment(row, type, approved) {
    try {
      setSaving(true); setError(""); setMessage("");
      const payload = { ids: [row._id] };
      payload[type === "ot" ? "overtimeApproved" : "cuttingApproved"] = approved;
      const response = await hrApi.approvePayrollAdjustments(payload);
      setMessage(response?.message || "Attendance adjustment updated.");
      await load();
    } catch (err) {
      setError(err?.message || "Unable to update attendance adjustment.");
    } finally { setSaving(false); }
  }

  async function approveSingle(row) {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response =
        await hrApi.approvePayrollAdjustments({
          ids: [row._id],
          overtimeApproved:
            Number(row.overtimeHours || 0) > 0
              ? true
              : approveOT,
          cuttingApproved:
            Number(row.cuttingMinutes || 0) > 0
              ? true
              : approveCutting
        });

      setMessage(
        response?.message ||
          "Payroll adjustment approved."
      );

      await load();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to approve this record."
      );
    } finally {
      setSaving(false);
    }
  }

  const pendingOT = rows.filter(
    (row) =>
      Number(row.overtimeHours || 0) > 0 &&
      !row.overtimeApproved
  ).length;

  const pendingCutting = rows.filter(
    (row) =>
      Number(row.cuttingMinutes || 0) > 0 &&
      !row.cuttingApproved
  ).length;

  const approvedOT = rows.filter(
    (row) =>
      Number(row.overtimeHours || 0) > 0 &&
      row.overtimeApproved
  ).length;

  const approvedCutting = rows.filter(
    (row) =>
      Number(row.cuttingMinutes || 0) > 0 &&
      row.cuttingApproved
  ).length;

  return (
    <main style={S.page}>
      <div style={S.container}>

        <header style={S.header}>
          <div>
            <h1 style={S.title}>
              Payroll Approvals
            </h1>

            <p style={S.subtitle}>
              Approve overtime and cutting before
              they are included in payroll.
            </p>
          </div>

          <div style={S.filters}>

            <select
              value={month}
              onChange={(e) =>
                setMonth(e.target.value)
              }
              style={S.input}
            >
              {[
                ["01", "January"],
                ["02", "February"],
                ["03", "March"],
                ["04", "April"],
                ["05", "May"],
                ["06", "June"],
                ["07", "July"],
                ["08", "August"],
                ["09", "September"],
                ["10", "October"],
                ["11", "November"],
                ["12", "December"]
              ].map(([value, label]) => (
                <option
                  value={value}
                  key={value}
                >
                  {label}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) =>
                setYear(e.target.value)
              }
              style={S.input}
            >
              {Array.from(
                { length: 7 },
                (_, index) =>
                  today.getFullYear() -
                  3 +
                  index
              ).map((y) => (
                <option
                  value={y}
                  key={y}
                >
                  {y}
                </option>
              ))}
            </select>

            <button
              style={S.refreshBtn}
              onClick={load}
              disabled={loading}
            >
              {loading
                ? "Loading..."
                : "Refresh"}
            </button>

          </div>
        </header>

        {error && (
          <div style={S.error}>
            {error}
          </div>
        )}

        {message && (
          <div style={S.success}>
            {message}
          </div>
        )}

        <section style={S.cards}>

          <div style={S.card}>
            <div style={S.cardLabel}>
              Pending Overtime
            </div>

            <div style={S.cardValue}>
              {pendingOT}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardLabel}>
              Pending Cutting
            </div>

            <div style={S.cardValue}>
              {pendingCutting}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardLabel}>
              Approved Overtime
            </div>

            <div style={S.cardValue}>
              {approvedOT}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardLabel}>
              Approved Cutting
            </div>

            <div style={S.cardValue}>
              {approvedCutting}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardLabel}>
              Selected
            </div>

            <div style={S.cardValue}>
              {selected.length}
            </div>
          </div>

        </section>

        <section style={S.approvalBox}>

          <div>
            <b style={S.approvalTitle}>
              Approval Action
            </b>

            <div style={S.approvalOptions}>
              <label style={S.checkboxLabel}>
                OT:
                <select value={bulkOTChoice} onChange={(e) => setBulkOTChoice(e.target.value)} style={S.miniSelect}>
                  <option value="approve">Pay / Approve</option>
                  <option value="reject">Do Not Pay</option>
                  <option value="keep">No Change</option>
                </select>
              </label>
              <label style={S.checkboxLabel}>
                Cutting/Fine:
                <select value={bulkCuttingChoice} onChange={(e) => setBulkCuttingChoice(e.target.value)} style={S.miniSelect}>
                  <option value="approve">Deduct / Approve</option>
                  <option value="reject">Do Not Deduct</option>
                  <option value="keep">No Change</option>
                </select>
              </label>
              <span style={S.small}>Attendance report always shows calculated OT/Cutting; these choices only control salary.</span>
            </div>
          </div>

          <button
            style={S.approveButton}
            onClick={approveSelected}
            disabled={
              saving ||
              selected.length === 0
            }
          >
            {saving
              ? "Processing..."
              : `Approve Selected (${selected.length})`}
          </button>

        </section>

        <section style={S.panel}>

          <div style={S.panelHeader}>

            <div>
              <b style={S.panelTitle}>
                Attendance Adjustments
              </b>

              <div style={S.small}>
                {rows.length} records found
              </div>
            </div>

            <div style={S.tabs}>

              {[
                "All",
                "Pending",
                "Overtime",
                "Cutting",
                "Approved"
              ].map((item) => (
                <button
                  key={item}
                  onClick={() =>
                    setFilter(item)
                  }
                  style={
                    filter === item
                      ? S.activeTab
                      : S.tab
                  }
                >
                  {item}
                </button>
              ))}

            </div>

          </div>

          <div style={S.tableWrapper}>

            <div style={S.tableHead}>

              <div>
                <input
                  type="checkbox"
                  checked={
                    allFilteredSelected
                  }
                  onChange={toggleAll}
                />
              </div>

              <div>Employee</div>
              <div>Location</div>
              <div>Date</div>
              <div>Shift</div>
              <div>In</div>
              <div>Out</div>
              <div>OT</div>
              <div>Cutting</div>
              <div>OT Status</div>
              <div>Cutting Status</div>
              <div>Action</div>

            </div>

            {filteredRows.map((row) => {

              const employee =
                getEmployee(row);

              const shift =
                getShift(row);

              const hasOT =
                Number(
                  row.overtimeHours || 0
                ) > 0;

              const hasCutting =
                Number(
                  row.cuttingMinutes || 0
                ) > 0;

              const isSelected =
                selected.includes(row._id);

              return (
                <div
                  key={row._id}
                  style={{
                    ...S.tableRow,
                    background: isSelected
                      ? "#eff6ff"
                      : "#fff"
                  }}
                >

                  <div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        toggleOne(row._id)
                      }
                    />
                  </div>

                  <div>
                    <b>
                      {employee.name ||
                        "Unknown"}
                    </b>

                    <small style={S.code}>
                      {employee.employeeCode ||
                        "-"}
                    </small>
                  </div>

                  <div>
                    {row.workLocation ||
                      employee.workLocation ||
                      "-"}
                  </div>

                  <div>
                    {fmtDate(row.date)}
                  </div>

                  <div>
                    {row.shiftName ||
                      shift.name ||
                      "-"}
                  </div>

                  <div>
                    {row.checkIn || "-"}
                  </div>

                  <div>
                    {row.checkOut || "-"}
                  </div>

                  <div
                    style={
                      hasOT
                        ? S.otValue
                        : S.zeroValue
                    }
                  >
                    {formatOT(
                      row.overtimeHours
                    )}
                  </div>

                  <div
                    style={
                      hasCutting
                        ? S.cuttingValue
                        : S.zeroValue
                    }
                  >
                    {formatCutting(
                      row.cuttingMinutes
                    )}
                  </div>

                  <div>
                    {hasOT ? (
                      row.overtimeApproved ? (
                        <span
                          style={S.approved}
                        >
                          Approved
                        </span>
                      ) : (
                        <span
                          style={S.pending}
                        >
                          Pending
                        </span>
                      )
                    ) : (
                      <span
                        style={S.notRequired}
                      >
                        -
                      </span>
                    )}
                  </div>

                  <div>
                    {hasCutting ? (
                      row.cuttingApproved ? (
                        <span
                          style={S.approved}
                        >
                          Approved
                        </span>
                      ) : (
                        <span
                          style={S.pending}
                        >
                          Pending
                        </span>
                      )
                    ) : (
                      <span
                        style={S.notRequired}
                      >
                        -
                      </span>
                    )}
                  </div>

                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {hasOT && (
                      <button type="button" style={row.overtimeApproved ? S.approvedButton : S.singleApprove} onClick={() => setSingleAdjustment(row, "ot", !row.overtimeApproved)} disabled={saving}>
                        {row.overtimeApproved ? "OT: Approved" : "OT: Do Not Pay"}
                      </button>
                    )}
                    {hasCutting && (
                      <button type="button" style={row.cuttingApproved ? S.approvedButton : S.singleApprove} onClick={() => setSingleAdjustment(row, "cutting", !row.cuttingApproved)} disabled={saving}>
                        {row.cuttingApproved ? "Fine: Approved" : "Fine: Do Not Deduct"}
                      </button>
                    )}
                    {!hasOT && !hasCutting && <span style={S.doneText}>No adjustment</span>}
                  </div>

                </div>
              );
            })}

            {!loading &&
              !filteredRows.length && (
                <div style={S.empty}>
                  No payroll approval records
                  found for this month.
                </div>
              )}

            {loading && (
              <div style={S.empty}>
                Loading payroll approvals...
              </div>
            )}

          </div>

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
    color: "#172033"
  },

  container: {
    maxWidth: 1600,
    margin: "0 auto"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18
  },

  title: {
    margin: 0,
    fontSize: 28
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#667085"
  },

  filters: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap"
  },

  input: {
    height: 40,
    border: "1px solid #d8dee9",
    borderRadius: 8,
    padding: "0 10px",
    background: "#fff"
  },

  refreshBtn: {
    height: 40,
    border: "1px solid #d8dee9",
    borderRadius: 8,
    padding: "0 15px",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer"
  },

  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",
    gap: 12,
    marginBottom: 16
  },

  card: {
    background: "#fff",
    border: "1px solid #e3e7ef",
    borderRadius: 12,
    padding: 17
  },

  cardLabel: {
    color: "#667085",
    fontSize: 13
  },

  cardValue: {
    fontSize: 27,
    fontWeight: 700,
    marginTop: 7
  },

  approvalBox: {
    background: "#fff",
    border: "1px solid #e3e7ef",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap"
  },

  approvalTitle: {
    fontSize: 17
  },

  approvalOptions: {
    display: "flex",
    gap: 20,
    marginTop: 10,
    flexWrap: "wrap"
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 14,
    fontWeight: 600
  },

  miniSelect: {
    border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 9px",
    background: "#fff", fontWeight: 700
  },

  approvedButton: {
    height: 34, border: "1px solid #15803d", borderRadius: 7, padding: "0 9px",
    background: "#dcfce7", color: "#166534", fontWeight: 700, cursor: "pointer"
  },

  approveButton: {
    height: 44,
    border: 0,
    borderRadius: 9,
    padding: "0 20px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer"
  },

  panel: {
    background: "#fff",
    border: "1px solid #e3e7ef",
    borderRadius: 12,
    overflow: "hidden"
  },

  panelHeader: {
    padding: 16,
    borderBottom: "1px solid #e7ebf1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap"
  },

  panelTitle: {
    fontSize: 19
  },

  small: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12
  },

  tabs: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap"
  },

  tab: {
    border: "1px solid #d8dee9",
    background: "#fff",
    borderRadius: 7,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 600
  },

  activeTab: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 7,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 700
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto"
  },

  tableHead: {
    minWidth: 1250,
    display: "grid",
    gridTemplateColumns:
      "40px 1.5fr 1fr 1fr 1.1fr .7fr .7fr .8fr .9fr 1fr 1fr 1fr",
    gap: 10,
    padding: "12px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#667085"
  },

  tableRow: {
    minWidth: 1250,
    display: "grid",
    gridTemplateColumns:
      "40px 1.5fr 1fr 1fr 1.1fr .7fr .7fr .8fr .9fr 1fr 1fr 1fr",
    gap: 10,
    padding: "13px 16px",
    borderTop: "1px solid #edf0f4",
    alignItems: "center",
    fontSize: 13
  },

  code: {
    display: "block",
    marginTop: 3,
    color: "#667085",
    fontSize: 11
  },

  otValue: {
    fontWeight: 700,
    color: "#7c3aed"
  },

  cuttingValue: {
    fontWeight: 700,
    color: "#dc2626"
  },

  zeroValue: {
    color: "#98a2b3"
  },

  approved: {
    display: "inline-block",
    padding: "5px 8px",
    borderRadius: 6,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 700,
    fontSize: 11
  },

  pending: {
    display: "inline-block",
    padding: "5px 8px",
    borderRadius: 6,
    background: "#fff4e5",
    color: "#b54708",
    fontWeight: 700,
    fontSize: 11
  },

  notRequired: {
    color: "#98a2b3"
  },

  singleApprove: {
    height: 34,
    border: 0,
    borderRadius: 7,
    padding: "0 11px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer"
  },

  doneText: {
    color: "#15803d",
    fontWeight: 700,
    fontSize: 12
  },

  empty: {
    padding: 45,
    textAlign: "center",
    color: "#667085"
  },

  error: {
    padding: 12,
    background: "#fee4e2",
    color: "#b42318",
    borderRadius: 8,
    marginBottom: 12
  },

  success: {
    padding: 12,
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 8,
    marginBottom: 12
  }
};
