import React, { useEffect, useMemo, useState } from "react";
import { hrApi } from "../lib/hrApi.js";
import { sendSalarySlipToWhatsApp } from "../lib/whatsappSalarySlip.js";

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const numberValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getEmployeeName = (row, detailed) =>
  detailed?.slip?.employeeName ||
  detailed?.employee?.name ||
  detailed?.name ||
  row?.employeeId?.name ||
  row?.employee?.name ||
  "Employee";

const getEmployeeCode = (row, detailed) =>
  detailed?.slip?.employeeCode ||
  detailed?.employee?.employeeCode ||
  detailed?.employeeCode ||
  row?.employeeId?.employeeCode ||
  row?.employee?.employeeCode ||
  "";

const getEmployeePhone = (row, detailed) =>
  detailed?.slip?.mobile ||
  detailed?.slip?.phone ||
  detailed?.employee?.mobile ||
  detailed?.employee?.phone ||
  detailed?.mobile ||
  detailed?.phone ||
  row?.employeeId?.mobile ||
  row?.employeeId?.phone ||
  row?.employeeId?.mobileNumber ||
  row?.employee?.mobile ||
  row?.employee?.phone ||
  row?.employee?.mobileNumber ||
  "";

const normalizePhone = (value) => {
  let phone = String(value || "").replace(/\D/g, "");

  if (phone.length === 10) {
    phone = `91${phone}`;
  }

  if (phone.startsWith("0091")) {
    phone = phone.substring(2);
  }

  return phone;
};

export default function PayrollReport() {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sharingId, setSharingId] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await hrApi.salaryReport(
        `?month=${month}&year=${year}`
      );

      setRows(
        Array.isArray(response?.salaries)
          ? response.salaries
          : Array.isArray(response)
          ? response
          : []
      );
    } catch (e) {
      console.error("Payroll report load error:", e);

      setRows([]);

      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Unable to load payroll report."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month, year]);

  const total = useMemo(() => {
    return rows.reduce(
      (a, x) => ({
        ot:
          a.ot +
          numberValue(
            x?.overtimeAmount ??
              x?.approvedOvertimeAmount ??
              x?.otAmount
          ),

        cut:
          a.cut +
          numberValue(
            x?.cuttingAmount ??
              x?.approvedCuttingAmount ??
              x?.cutAmount
          ),

        gross:
          a.gross +
          numberValue(x?.grossSalary ?? x?.gross),

        net:
          a.net +
          numberValue(
            x?.netSalary ??
              x?.netPayable ??
              x?.net
          ),
      }),
      {
        ot: 0,
        cut: 0,
        gross: 0,
        net: 0,
      }
    );
  }, [rows]);

  async function sendWhatsApp(row) {
    if (!row?._id) {
      setError("Salary record ID is missing.");
      return;
    }

    try {
      setSharingId(row._id);
      setError("");
      setMessage("");

      const detailed =
        await hrApi.detailedSalarySlip(row._id);

      const employeeName =
        getEmployeeName(row, detailed);

      const employeeCode =
        getEmployeeCode(row, detailed);

      const employeePhone =
        normalizePhone(
          getEmployeePhone(row, detailed)
        );

      const employeeId =
        row?.employeeId?._id ||
        row?.employeeId ||
        row?.employee?._id ||
        detailed?.employee?._id ||
        detailed?.employeeId ||
        "";

      await sendSalarySlipToWhatsApp({
        salary: row,
        detailed,
        employeeId,
        employeeName,
        employeeCode,
        employeePhone,
        phone: employeePhone,
        month,
        year,
      });

      setMessage(
        `Salary slip PDF prepared and WhatsApp opened for ${employeeName}.`
      );
    } catch (e) {
      console.error(
        "WhatsApp salary slip error:",
        e
      );

      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Unable to prepare salary slip for WhatsApp."
      );
    } finally {
      setSharingId("");
    }
  }

  const monthName =
    new Date(
      2000,
      month - 1,
      1
    ).toLocaleString("en-IN", {
      month: "long",
    });

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <header style={S.head}>
          <div>
            <div style={S.eyebrow}>
              OFFICE MANAGEMENT • REPORT CENTER
            </div>

            <h1 style={S.title}>
              Payroll Report
            </h1>

            <p style={S.subtitle}>
              Company-wise, monthly and staff-wise
              payroll report with salary slip sharing.
            </p>
          </div>

          <div style={S.filters}>
            <div style={S.filterGroup}>
              <label style={S.label}>
                Month
              </label>

              <select
                style={S.input}
                value={month}
                onChange={(e) =>
                  setMonth(
                    Number(e.target.value)
                  )
                }
              >
                {Array.from(
                  { length: 12 },
                  (_, i) => (
                    <option
                      key={i + 1}
                      value={i + 1}
                    >
                      {new Date(
                        2000,
                        i,
                        1
                      ).toLocaleString(
                        "en-IN",
                        {
                          month: "long",
                        }
                      )}
                    </option>
                  )
                )}
              </select>
            </div>

            <div style={S.filterGroup}>
              <label style={S.label}>
                Year
              </label>

              <input
                style={S.input}
                type="number"
                min="2000"
                max="2100"
                value={year}
                onChange={(e) =>
                  setYear(
                    Number(e.target.value)
                  )
                }
              />
            </div>

            <button
              type="button"
              style={S.refreshButton}
              onClick={load}
              disabled={loading}
            >
              {loading
                ? "Loading..."
                : "Refresh"}
            </button>
          </div>
        </header>

        <div style={S.period}>
          Payroll Period:{" "}
          <strong>
            {monthName} {year}
          </strong>
        </div>

        {message && (
          <div style={S.success}>
            ✓ {message}
          </div>
        )}

        {error && (
          <div style={S.err}>
            ! {error}
          </div>
        )}

        <div style={S.cards}>
          <div style={S.card}>
            <span style={S.cardLabel}>
              Employees
            </span>

            <b style={S.cardValue}>
              {rows.length}
            </b>
          </div>

          <div style={S.card}>
            <span style={S.cardLabel}>
              Approved OT Amount
            </span>

            <b style={S.cardValue}>
              {money(total.ot)}
            </b>
          </div>

          <div style={S.card}>
            <span style={S.cardLabel}>
              Cutting Deduction
            </span>

            <b style={S.cardValue}>
              {money(total.cut)}
            </b>
          </div>

          <div style={S.card}>
            <span style={S.cardLabel}>
              Net Payable
            </span>

            <b style={S.netValue}>
              {money(total.net)}
            </b>
          </div>
        </div>

        <section style={S.tableWrapper}>
          <div style={S.tableHeader}>
            <div>
              <h2 style={S.tableTitle}>
                Salary Register
              </h2>

              <span
                style={S.tableSubtitle}
              >
                {rows.length} employee
                {rows.length === 1
                  ? ""
                  : "s"} found
              </span>
            </div>
          </div>

          <div style={S.tableScroll}>
            <div style={S.table}>
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

              {loading && (
                <div style={S.loading}>
                  Loading payroll records...
                </div>
              )}

              {!loading &&
                rows.map((x) => {
                  const employeeName =
                    x?.employeeId?.name ||
                    x?.employee?.name ||
                    "-";

                  const employeeCode =
                    x?.employeeId
                      ?.employeeCode ||
                    x?.employee
                      ?.employeeCode ||
                    "";

                  const cuttingMinutes =
                    numberValue(
                      x?.cuttingMinutes
                    );

                  const cuttingHours =
                    Math.floor(
                      cuttingMinutes / 60
                    );

                  const remainingMinutes =
                    cuttingMinutes % 60;

                  const isSharing =
                    sharingId === x._id;

                  const overtimeHours =
                    numberValue(
                      x?.overtimeHours ??
                        x?.otHours
                    );

                  const overtimeAmount =
                    numberValue(
                      x?.overtimeAmount ??
                        x?.approvedOvertimeAmount ??
                        x?.otAmount
                    );

                  const cuttingAmount =
                    numberValue(
                      x?.cuttingAmount ??
                        x?.approvedCuttingAmount ??
                        x?.cutAmount
                    );

                  const gross =
                    numberValue(
                      x?.grossSalary ??
                        x?.gross
                    );

                  const net =
                    numberValue(
                      x?.netSalary ??
                        x?.netPayable ??
                        x?.net
                    );

                  return (
                    <div
                      style={S.tr}
                      key={x._id}
                    >
                      <span
                        style={
                          S.employeeCell
                        }
                      >
                        <b
                          style={
                            S.employeeName
                          }
                        >
                          {employeeName}
                        </b>

                        {employeeCode && (
                          <small
                            style={
                              S.employeeCode
                            }
                          >
                            {employeeCode}
                          </small>
                        )}
                      </span>

                      <span>
                        {numberValue(
                          x?.presentDays
                        )}
                      </span>

                      <span>
                        {overtimeHours.toFixed(
                          2
                        )}{" "}
                        h
                      </span>

                      <span>
                        {money(
                          overtimeAmount
                        )}
                      </span>

                      <span>
                        {cuttingHours}h{" "}
                        {String(
                          remainingMinutes
                        ).padStart(
                          2,
                          "0"
                        )}
                        m
                      </span>

                      <span>
                        {money(gross)}
                      </span>

                      <strong
                        style={
                          S.netCell
                        }
                      >
                        {money(net)}
                      </strong>

                      <button
                        type="button"
                        style={{
                          ...S.whatsapp,
                          ...(isSharing
                            ? S.whatsappDisabled
                            : {}),
                        }}
                        onClick={() =>
                          sendWhatsApp(x)
                        }
                        disabled={
                          isSharing
                        }
                      >
                        {isSharing
                          ? "Preparing..."
                          : "WA • WhatsApp"}
                      </button>
                    </div>
                  );
                })}

              {!loading &&
                rows.length === 0 && (
                  <div style={S.empty}>
                    <div
                      style={
                        S.emptyTitle
                      }
                    >
                      No salary records
                      found
                    </div>

                    <div
                      style={
                        S.emptyText
                      }
                    >
                      No payroll data is
                      available for{" "}
                      <strong>
                        {monthName}{" "}
                        {year}
                      </strong>
                      .
                    </div>
                  </div>
                )}
            </div>
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
    fontFamily:
      "Inter, Arial, sans-serif",
    boxSizing: "border-box",
  },

  wrap: {
    maxWidth: 1500,
    margin: "0 auto",
  },

  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 14,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.2,
    color: "#667085",
    marginBottom: 7,
  },

  title: {
    margin: 0,
    fontSize: 30,
    color: "#101828",
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#667085",
    fontSize: 14,
  },

  filters: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },

  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  label: {
    fontSize: 11,
    fontWeight: 700,
    color: "#667085",
  },

  input: {
    minWidth: 130,
    height: 42,
    padding: "0 12px",
    border: "1px solid #d0d5dd",
    borderRadius: 9,
    background: "#fff",
    boxSizing: "border-box",
  },

  refreshButton: {
    height: 42,
    padding: "0 16px",
    border: 0,
    borderRadius: 9,
    background: "#101828",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },

  period: {
    background: "#fff",
    border: "1px solid #eaecf0",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 14,
    color: "#667085",
    fontSize: 13,
  },

  success: {
    background: "#ecfdf3",
    color: "#027a48",
    border: "1px solid #abefc6",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    fontSize: 13,
    fontWeight: 600,
  },

  err: {
    background: "#fef3f2",
    color: "#b42318",
    border: "1px solid #fecdca",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    fontSize: 13,
    fontWeight: 600,
  },

  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 16,
  },

  card: {
    background: "#fff",
    border: "1px solid #eaecf0",
    borderRadius: 14,
    padding: 18,
    boxShadow:
      "0 5px 18px rgba(15,23,42,.05)",
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  cardLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: 600,
  },

  cardValue: {
    color: "#101828",
    fontSize: 21,
  },

  netValue: {
    color: "#067647",
    fontSize: 21,
  },

  tableWrapper: {
    background: "#fff",
    border: "1px solid #eaecf0",
    borderRadius: 14,
    overflow: "hidden",
  },

  tableHeader: {
    padding: "16px 18px",
    borderBottom:
      "1px solid #eaecf0",
  },

  tableTitle: {
    margin: 0,
    color: "#101828",
    fontSize: 17,
  },

  tableSubtitle: {
    display: "block",
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
  },

  tableScroll: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    minWidth: 1100,
  },

  th: {
    display: "grid",
    gridTemplateColumns:
      "1.6fr .65fr .85fr 1fr 1fr 1fr 1.1fr 1fr",
    gap: 10,
    padding: 13,
    background: "#f2f4f7",
    color: "#475467",
    fontWeight: 800,
    fontSize: 12,
    alignItems: "center",
  },

  tr: {
    display: "grid",
    gridTemplateColumns:
      "1.6fr .65fr .85fr 1fr 1fr 1fr 1.1fr 1fr",
    gap: 10,
    padding: 13,
    borderTop:
      "1px solid #eef2f6",
    alignItems: "center",
    color: "#344054",
    fontSize: 13,
  },

  employeeCell: {
    display: "flex",
    flexDirection: "column",
  },

  employeeName: {
    color: "#101828",
    fontSize: 13,
  },

  employeeCode: {
    color: "#667085",
    marginTop: 3,
    fontSize: 11,
  },

  netCell: {
    color: "#067647",
    fontSize: 13,
  },

  whatsapp: {
    border: 0,
    borderRadius: 8,
    minHeight: 36,
    padding: "7px 10px",
    background: "#e9f9ef",
    color: "#16803a",
    cursor: "pointer",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  whatsappDisabled: {
    opacity: 0.6,
    cursor: "wait",
  },

  loading: {
    padding: 35,
    textAlign: "center",
    color: "#667085",
  },

  empty: {
    padding: 45,
    textAlign: "center",
    color: "#667085",
  },

  emptyTitle: {
    color: "#344054",
    fontWeight: 800,
    fontSize: 15,
    marginBottom: 5,
  },

  emptyText: {
    fontSize: 13,
  },
};
