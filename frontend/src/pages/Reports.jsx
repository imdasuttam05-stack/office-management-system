import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hrApi } from "../lib/hrApi.js";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const two = (n) => String(n).padStart(2, "0");
const fmtDate = (value) => value ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "-";
const fmtHours = (decimal) => {
  const mins = Math.round(Number(decimal || 0) * 60);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};
const fmtMinutes = (mins) => `${Math.floor(Number(mins || 0) / 60)}h ${Number(mins || 0) % 60}m`;

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printHtml(title, body, extra = "") {
  const w = window.open("", "_blank", "width=1200,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    *{box-sizing:border-box}body{margin:0;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#172033;background:#fff}h1,h2,h3,p{margin:0}.print-head{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #1d4f91;padding-bottom:16px;margin-bottom:18px}.muted{color:#667085}.table{width:100%;border-collapse:collapse;margin-top:12px}.table th,.table td{border:1px solid #d9e2ec;padding:8px 7px;font-size:11px;text-align:left;vertical-align:top}.table th{background:#eef4fb;font-weight:700}.right{text-align:right!important}.center{text-align:center!important}.card{border:1px solid #d9e2ec;border-radius:10px;padding:14px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.kpi{border:1px solid #d9e2ec;padding:12px;border-radius:8px}.kpi b{display:block;font-size:18px}.kpi span{font-size:11px;color:#667085}.small{font-size:11px;color:#667085}@page{size:A4 landscape;margin:10mm} @media print{body{padding:0}.no-print{display:none!important}}${extra}</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export default function Reports() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [tab, setTab] = useState(path.includes("salary") || path.includes("payroll") ? "salary" : "attendance");

  useEffect(() => {
    setTab(path.includes("salary") || path.includes("payroll") ? "salary" : "attendance");
  }, [path]);

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <header style={S.header}>
          <div>
            <div style={S.kicker}>OFFICE MANAGEMENT • REPORT CENTER</div>
            <h1 style={S.title}>Reports & Payroll</h1>
            <p style={S.subtitle}>Company-wise, daily, monthly and staff-wise reports with Excel export and print-ready PDF.</p>
          </div>
          <div style={S.headerActions}>
            <button type="button" style={tab === "attendance" ? S.tabActive : S.tab} onClick={() => { setTab("attendance"); navigate("/reports/attendance"); }}>Attendance</button>
            <button type="button" style={tab === "salary" ? S.tabActive : S.tab} onClick={() => { setTab("salary"); navigate("/reports/salary"); }}>Salary / Payroll</button>
          </div>
        </header>

        {tab === "attendance" ? <AttendanceReports /> : <SalaryReports />}
      </div>
    </main>
  );
}

function AttendanceReports() {
  const now = new Date();
  const [mode, setMode] = useState("daily");
  const [from, setFrom] = useState(`${now.getFullYear()}-${two(now.getMonth() + 1)}-01`);
  const [to, setTo] = useState(`${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`);
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeIds, setEmployeeIds] = useState([]);
  const [status, setStatus] = useState("");
  const [options, setOptions] = useState({ employees: [], companies: [], departmentOptions: [] });
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    hrApi.options().then((r) => setOptions({
      employees: Array.isArray(r.employees) ? r.employees : [],
      companies: Array.isArray(r.companies) ? r.companies : [],
      departmentOptions: Array.isArray(r.departmentOptions) ? r.departmentOptions : [],
    })).catch((e) => setError(e.message));
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams({ mode, from, to });
    if (company) params.set("companyName", company);
    if (department) params.set("department", department);
    if (status) params.set("status", status);
    if (employeeIds.length) params.set("employeeIds", employeeIds.join(","));
    return `?${params.toString()}`;
  }, [mode, from, to, company, department, status, employeeIds]);

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await hrApi.attendanceReport(query);
      setRows(Array.isArray(r.rows) ? r.rows : []);
      setTotals(r.totals || {});
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [query]);

  function selectEmployees(e) {
    setEmployeeIds(Array.from(e.target.selectedOptions).map((o) => o.value));
  }

  async function exportExcel() {
    try {
      await hrApi.exportAttendanceReport(query, `attendance-${mode}-${from}-${to}.xlsx`);
    } catch (e) { setError(e.message); }
  }

  const monthly = mode === "monthly";
  const visibleRows = monthly ? rows : rows.filter((x) => !status || x.status === status);

  function printReport() {
    const tableRows = visibleRows.map((x) => monthly
      ? `<tr><td>${escapeHtml(x.employeeCode)}</td><td>${escapeHtml(x.employeeName)}</td><td>${escapeHtml(x.companyName)}</td><td>${escapeHtml(x.department)}</td><td>${x.presentDays||0}</td><td>${x.halfDays||0}</td><td>${x.absentDays||0}</td><td>${x.leaveDays||0}</td><td>${x.weekOffDays||0}</td><td>${x.holidayDays||0}</td><td>${x.payableDays||0}</td><td>${fmtHours(x.hours)}</td><td>${fmtHours(x.overtimeHours)}</td><td>${fmtMinutes(x.cuttingMinutes)}</td></tr>`
      : `<tr><td>${fmtDate(x.date)}</td><td>${escapeHtml(x.day)}</td><td>${escapeHtml(x.employeeCode)}</td><td>${escapeHtml(x.employeeName)}</td><td>${escapeHtml(x.companyName)}</td><td>${escapeHtml(x.status)}</td><td>${escapeHtml(x.checkIn || "-")}</td><td>${escapeHtml(x.checkOut || "-")}</td><td>${escapeHtml(x.shiftName || "-")}</td><td>${fmtHours(x.hours)}</td><td>${fmtHours(x.overtimeHours)}</td><td>${fmtMinutes(x.cuttingMinutes)}</td></tr>`
    ).join("");
    const headers = monthly
      ? "<th>Code</th><th>Employee</th><th>Company</th><th>Department</th><th>Present</th><th>HD</th><th>Absent</th><th>Leave</th><th>WO</th><th>Holiday</th><th>Paid Days</th><th>Hours</th><th>OT</th><th>Cutting</th>"
      : "<th>Date</th><th>Day</th><th>Code</th><th>Employee</th><th>Company</th><th>Status</th><th>IN</th><th>OUT</th><th>Shift</th><th>Hours</th><th>OT</th><th>Cutting</th>";
    printHtml("Attendance Report", `<div class="print-head"><div><h1>${monthly ? "Monthly Attendance Report" : "Daily Attendance Report"}</h1><p class="muted">${fmtDate(from)} to ${fmtDate(to)} ${company ? `• ${escapeHtml(company)}` : "• All Companies"}</p></div><div class="small">Generated ${new Date().toLocaleString("en-IN")}</div></div><div class="grid"><div class="kpi"><b>${totals.present||0}</b><span>Present</span></div><div class="kpi"><b>${totals.halfDay||0}</b><span>Half Day</span></div><div class="kpi"><b>${totals.absent||0}</b><span>Absent</span></div><div class="kpi"><b>${fmtHours(totals.otHours||0)}</b><span>OT</span></div></div><table class="table"><thead><tr>${headers}</tr></thead><tbody>${tableRows || `<tr><td colspan="14">No records</td></tr>`}</tbody></table>`);
  }

  return <section>
    <div style={S.filterCard}>
      <div style={S.filterTitle}>Attendance Report Filters</div>
      <div style={S.filters}>
        <label style={S.label}>Report Type<select style={S.input} value={mode} onChange={(e)=>setMode(e.target.value)}><option value="daily">Daily / Day-wise</option><option value="monthly">Monthly / Staff-wise</option></select></label>
        <label style={S.label}>From<input style={S.input} type="date" value={from} onChange={(e)=>setFrom(e.target.value)}/></label>
        <label style={S.label}>To<input style={S.input} type="date" value={to} onChange={(e)=>setTo(e.target.value)}/></label>
        <label style={S.label}>Company<select style={S.input} value={company} onChange={(e)=>setCompany(e.target.value)}><option value="">All Companies</option>{options.companies.map(c=><option key={c}>{c}</option>)}</select></label>
        <label style={S.label}>Department<select style={S.input} value={department} onChange={(e)=>setDepartment(e.target.value)}><option value="">All Departments</option>{options.departmentOptions.map(c=><option key={c}>{c}</option>)}</select></label>
        <label style={S.label}>Status<select style={S.input} value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">All Status</option><option>Present</option><option>Half Day</option><option>Absent</option><option>Leave</option><option>Week Off</option></select></label>
        <label style={{...S.label, gridColumn:"span 2"}}>Staff — single / multi-select<select multiple size={4} style={{...S.input,minHeight:92}} value={employeeIds} onChange={selectEmployees}>{options.employees.filter(e=>!company || e.companyName===company).map(e=><option key={e._id} value={e._id}>{e.employeeCode} — {e.name}</option>)}</select></label>
      </div>
      <div style={S.actions}><button type="button" style={S.primary} onClick={load}>{loading ? "Loading…" : "Run Report"}</button><button type="button" style={S.secondary} onClick={exportExcel}>↓ Excel</button><button type="button" style={S.secondary} onClick={printReport}>🖨 Print / Save PDF</button></div>
    </div>

    {error && <div style={S.error}>{error}</div>}

    <div style={S.kpis}>
      <div style={S.kpi}><b>{rows.length}</b><span>{monthly ? "Staff" : "Attendance Rows"}</span></div>
      <div style={S.kpi}><b>{totals.present || 0}</b><span>Present</span></div>
      <div style={S.kpi}><b>{totals.absent || 0}</b><span>Absent</span></div>
      <div style={S.kpi}><b>{fmtHours(totals.hours || 0)}</b><span>Total Hours</span></div>
      <div style={S.kpi}><b>{fmtHours(totals.otHours || 0)}</b><span>Total OT</span></div>
      <div style={S.kpi}><b>{fmtMinutes(totals.cuttingMinutes || 0)}</b><span>Cutting</span></div>
    </div>

    <div style={S.tableCard}>
      <div style={S.tableHead}><h2>{monthly ? "Monthly Staff Summary" : "Daily Attendance"}</h2><span>{loading ? "Refreshing…" : `${visibleRows.length} rows`}</span></div>
      <div style={S.tableWrap}>
        <table style={S.table}><thead><tr>{monthly ? <><th>Employee</th><th>Company</th><th>Dept.</th><th>Present</th><th>HD</th><th>Absent</th><th>Leave</th><th>WO</th><th>Holiday</th><th>Paid Days</th><th>Hours</th><th>OT</th><th>Cutting</th></> : <><th>Date</th><th>Employee</th><th>Company</th><th>Status</th><th>IN</th><th>OUT</th><th>Shift</th><th>Hours</th><th>OT</th><th>Cutting</th></>}</tr></thead><tbody>
          {visibleRows.map((x,i)=><tr key={`${x.employeeId}-${x.date || i}`}>
            {monthly ? <><td><b>{x.employeeName}</b><small>{x.employeeCode}</small></td><td>{x.companyName || "-"}</td><td>{x.department || "-"}</td><td>{x.presentDays||0}</td><td>{x.halfDays||0}</td><td>{x.absentDays||0}</td><td>{x.leaveDays||0}</td><td>{x.weekOffDays||0}</td><td>{x.holidayDays||0}</td><td>{x.payableDays||0}</td><td>{fmtHours(x.hours)}</td><td>{fmtHours(x.overtimeHours)}</td><td>{fmtMinutes(x.cuttingMinutes)}</td></> : <><td>{fmtDate(x.date)}<small>{x.day}</small></td><td><b>{x.employeeName}</b><small>{x.employeeCode}</small></td><td>{x.companyName||"-"}</td><td><span style={statusStyle(x.status)}>{x.status}</span></td><td>{x.checkIn||"-"}</td><td>{x.checkOut||"-"}</td><td>{x.shiftName||"-"}</td><td>{fmtHours(x.hours)}</td><td>{fmtHours(x.overtimeHours)}</td><td>{fmtMinutes(x.cuttingMinutes)}</td></>}
          </tr>)}
          {!visibleRows.length && <tr><td colSpan={monthly ? 13 : 10} style={S.empty}>No records found for these filters.</td></tr>}
        </tbody></table>
      </div>
    </div>
  </section>;
}

function statusStyle(status) {
  const map = { Present: { background: "#e7f6ed", color: "#127a43" }, Absent: { background: "#fff0f0", color: "#b42318" }, "Half Day": { background: "#fff6db", color: "#9a6700" }, Leave: { background: "#edf4ff", color: "#1d4f91" }, "Week Off": { background: "#f0f1f4", color: "#5c6472" } };
  return { ...(map[status] || map["Week Off"]), padding: "5px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 };
}

function SalaryReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [company, setCompany] = useState("");
  const [employeeIds, setEmployeeIds] = useState([]);
  const [options, setOptions] = useState({ employees: [], companies: [] });
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [slip, setSlip] = useState(null);

  useEffect(() => {
    hrApi.options().then((r)=>setOptions({ employees:Array.isArray(r.employees)?r.employees:[], companies:Array.isArray(r.companies)?r.companies:[] })).catch((e)=>setError(e.message));
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams({ month, year });
    if (company) p.set("companyName", company);
    if (employeeIds.length) p.set("employeeIds", employeeIds.join(","));
    return `?${p.toString()}`;
  }, [month, year, company, employeeIds]);

  async function load({ ensureGenerated = true } = {}) {
    try {
      setError("");
      let r = await hrApi.salaryReport(query);
      let salaries = Array.isArray(r.salaries) ? r.salaries : [];

      // The payroll report should not remain empty merely because Salary
      // documents have not been generated yet. When the selected month has
      // no (or incomplete) payroll records, generate them for the selected
      // company/staff and fetch the report again.
      if (ensureGenerated) {
        const candidateCount = options.employees.filter((e) => !company || e.companyName === company).length;
        const expectedCount = employeeIds.length || candidateCount;
        if (expectedCount > 0 && salaries.length < expectedCount) {
          await hrApi.generateSalary({
            month,
            year,
            companyName: company || undefined,
            employeeIds: employeeIds.length ? employeeIds : undefined,
          });
          r = await hrApi.salaryReport(query);
          salaries = Array.isArray(r.salaries) ? r.salaries : [];
        }
      }

      setRows(salaries);
    } catch(e) {
      setError(e.message);
    }
  }

  useEffect(()=>{load({ ensureGenerated: true })},[query, options.employees.length]);

  async function openSlip(id) {
    try { const r = await hrApi.detailedSalarySlip(id); setSlip(r.slip); } catch(e) { setError(e.message); }
  }
  async function exportSalary() {
    try { await hrApi.exportSalaryReport(query, `salary-report-${month}-${year}.xlsx`); } catch(e) { setError(e.message); }
  }

  const totals = rows.reduce((a,s)=>({gross:a.gross+Number(s.grossSalary||0), net:a.net+Number(s.netSalary||0), ot:a.ot+Number(s.overtimeAmount||s.overtimeApprovedAmount||0), cut:a.cut+Number(s.cuttingAmount||0)}),{gross:0,net:0,ot:0,cut:0});

  function printSlip(overrides = {}) {
    if (!slip) return;
    const e = slip.earnings, d = slip.deductions, t = slip.totals;
    const printCompanyName = overrides.companyName || slip.companyName || "Company";
    const printCompanyAddress = overrides.companyAddress || slip.companyAddress || "Company Address";
    printHtml("Salary Slip", `<div class="slip"><div class="print-slip-head"><h1>${escapeHtml(printCompanyName)}</h1><p>${escapeHtml(printCompanyAddress)}</p><h2>Salary Slip - ${escapeHtml(slip.monthLabel)}</h2></div><table class="employee-info"><tbody><tr><td>Employee's Name</td><td>${escapeHtml(slip.employeeName)}</td><td>UAN No.</td><td>${escapeHtml(slip.uanNo)}</td></tr><tr><td>Designation</td><td>${escapeHtml(slip.designation)}</td><td>ESIC No.</td><td>${escapeHtml(slip.esiNo)}</td></tr><tr><td>DOB</td><td>${escapeHtml(slip.dob)}</td><td>Days</td><td>${slip.days}</td></tr><tr><td>DOJ</td><td>${escapeHtml(slip.doj)}</td><td>Paid Days</td><td>${slip.paidDays}</td></tr><tr><td>Bank Name</td><td>${escapeHtml(slip.bankName)}</td><td>LOP</td><td>${slip.lop}</td></tr><tr><td>IFSC Code</td><td>${escapeHtml(slip.ifscCode)}</td><td>Account No.</td><td>${escapeHtml(slip.accountNo)}</td></tr></tbody></table><table class="salary-breakdown"><thead><tr><th colspan="2">Actuals</th><th colspan="2">Earnings</th><th colspan="2">Deductions</th></tr></thead><tbody><tr><td>Basic</td><td class="right">${money(e.basic)}</td><td>Basic</td><td class="right">${money(e.basic)}</td><td>ESI Employee</td><td class="right">${money(d.esi)}</td></tr><tr><td>HRA</td><td class="right">${money(e.hra)}</td><td>HRA</td><td class="right">${money(e.hra)}</td><td>PF Employee</td><td class="right">${money(d.pf)}</td></tr><tr><td>Conveyance</td><td class="right">${money(e.conveyance)}</td><td>Conveyance</td><td class="right">${money(e.conveyance)}</td><td>Professional Tax</td><td class="right">${money(d.professionalTax)}</td></tr><tr><td>Others</td><td class="right">${money(e.others)}</td><td>Others</td><td class="right">${money(e.others)}</td><td>Fine / Cutting</td><td class="right">${money(d.cutting)}</td></tr><tr><td>OT Approved</td><td class="right">${money(t.overtimeAmount)}</td><td>OT Approved</td><td class="right">${money(t.overtimeAmount)}</td><td>Other / LOP</td><td class="right">${money(d.other)}</td></tr><tr class="total-row"><th>Total Rs.</th><th class="right">${money(t.earnings)}</th><th>Total Rs.</th><th class="right">${money(t.earnings)}</th><th>Total Rs.</th><th class="right">${money(t.deductions)}</th></tr></tbody></table><div class="net-card"><div><b>Total Net Payable</b><small>Net salary after approved deductions</small></div><b class="net-amount">${money(t.netPayable)}</b></div><div class="words-box"><b>In Words:</b> ${escapeHtml(slip.inWords)}</div>${(Number(t.overtimeApprovedHours||0)>0||Number(t.overtimeAmount||0)>0||Number(t.cuttingApprovedMinutes||0)>0||Number(t.cuttingAmount||0)>0)?`<div class="salary-meta">${(Number(t.overtimeApprovedHours||0)>0||Number(t.overtimeAmount||0)>0)?`<span><b>OT:</b> Actual ${fmtHours(t.overtimeHours)} · Approved ${fmtHours(t.overtimeApprovedHours)} · Amount ${money(t.overtimeAmount)}</span>`:""}${(Number(t.cuttingApprovedMinutes||0)>0||Number(t.cuttingAmount||0)>0)?`<span><b>Fine / Cutting:</b> Actual ${fmtMinutes(t.cuttingMinutes)} · Approved ${fmtMinutes(t.cuttingApprovedMinutes)} · Amount ${money(t.cuttingAmount)}</span>`:""}</div>`:""}</div>`, "@page{size:A4 portrait;margin:10mm}.slip{max-width:780px;margin:0 auto}.print-slip-head{text-align:center;border-bottom:2px solid #1d4f91;padding-bottom:12px;margin-bottom:14px}.print-slip-head h1{font-size:23px;margin:0;color:#172b4d}.print-slip-head p{margin:4px 0;color:#667085}.print-slip-head h2{margin:8px 0 0;font-size:17px}.employee-info,.salary-breakdown{width:100%;border-collapse:collapse}.employee-info{margin-top:8px}.employee-info td{border:1px solid #e3e8ef;padding:8px;font-size:11px}.employee-info td:nth-child(odd){background:#f7f9fc;font-weight:700;color:#344054}.salary-breakdown{margin-top:16px;border:1px solid #dfe6ef}.salary-breakdown th,.salary-breakdown td{border:1px solid #e3e8ef;padding:8px 7px;font-size:10.5px}.salary-breakdown th:nth-child(odd),.salary-breakdown td:nth-child(odd){width:15%}.salary-breakdown th:nth-child(even),.salary-breakdown td:nth-child(even){width:18%;text-align:right}.salary-breakdown thead th{background:#eef4fb;color:#17365d;text-align:center;font-size:12px}.salary-breakdown .right{text-align:right}.salary-breakdown .total-row{background:#f4f7fb}.net-card{margin-top:15px;padding:13px 15px;background:#eef5ff;border:1px solid #cfe0fa;border-radius:8px;display:flex;justify-content:space-between;align-items:center}.net-card small{display:block;color:#667085;font-size:9px;margin-top:2px}.net-amount{font-size:18px;color:#17365d}.words-box{margin-top:11px;padding:10px 12px;background:#fafbfd;border:1px solid #e7ebf0;border-radius:7px;font-size:10px}.salary-meta{margin-top:10px;padding-top:8px;border-top:1px dashed #d6dde8;display:flex;flex-wrap:wrap;gap:5px 12px;color:#667085;font-size:9px}");
  }

  return <section>
    <div style={S.filterCard}>
      <div style={S.filterTitle}>Salary / Payroll Report</div>
      <div style={S.filters}>
        <label style={S.label}>Month<select style={S.input} value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2000,i,1).toLocaleString("en-IN",{month:"long"})}</option>)}</select></label>
        <label style={S.label}>Year<input style={S.input} type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/></label>
        <label style={S.label}>Company<select style={S.input} value={company} onChange={e=>setCompany(e.target.value)}><option value="">All Companies</option>{options.companies.map(c=><option key={c}>{c}</option>)}</select></label>
        <label style={{...S.label,gridColumn:"span 2"}}>Staff — single / multi-select<select multiple size={4} style={{...S.input,minHeight:92}} value={employeeIds} onChange={e=>setEmployeeIds(Array.from(e.target.selectedOptions).map(o=>o.value))}>{options.employees.filter(e=>!company || e.companyName===company).map(e=><option key={e._id} value={e._id}>{e.employeeCode} — {e.name}</option>)}</select></label>
      </div>
      <div style={S.actions}><button type="button" style={S.primary} onClick={load}>Run Payroll Report</button><button type="button" style={S.secondary} onClick={exportSalary}>↓ Excel</button></div>
    </div>
    {error && <div style={S.error}>{error}</div>}
    <div style={S.kpis}><div style={S.kpi}><b>{rows.length}</b><span>Employees</span></div><div style={S.kpi}><b>{money(totals.gross)}</b><span>Gross</span></div><div style={S.kpi}><b>{money(totals.ot)}</b><span>OT Amount</span></div><div style={S.kpi}><b>{money(totals.cut)}</b><span>Cutting</span></div><div style={S.kpi}><b>{money(totals.net)}</b><span>Net Payable</span></div></div>
    <div style={S.tableCard}><div style={S.tableHead}><h2>Payroll Register</h2><span>{month}/{year}</span></div><div style={S.tableWrap}><table style={S.table}><thead><tr><th>Employee</th><th>Company</th><th>Present</th><th>HD</th><th>OT</th><th>OT Amount</th><th>Cutting</th><th>Gross</th><th>Net</th><th>Slip</th></tr></thead><tbody>{rows.map(s=><tr key={s._id}><td><b>{s.employeeId?.name||"-"}</b><small>{s.employeeId?.employeeCode||""}</small></td><td>{s.employeeId?.companyName||"-"}</td><td>{s.presentDays||0}</td><td>{s.halfDays||0}</td><td>{fmtHours(s.overtimeHours)}</td><td>{money(s.overtimeAmount||s.overtimeApprovedAmount)}</td><td>{fmtMinutes(s.cuttingMinutes)}</td><td>{money(s.grossSalary)}</td><td><b>{money(s.netSalary)}</b></td><td><button type="button" style={S.linkBtn} onClick={()=>openSlip(s._id)}>View Slip</button></td></tr>)}{!rows.length&&<tr><td colSpan={10} style={S.empty}>No payroll generated for this period.</td></tr>}</tbody></table></div></div>
    {slip && <SalarySlipModal slip={slip} onClose={()=>setSlip(null)} onPrint={printSlip} onExcel={()=>hrApi.exportSalarySlip(slip.salaryId, `salary-slip-${slip.employeeCode}-${month}-${year}.xlsx`).catch(e=>setError(e.message))} onEmail={async(to)=>{try{const r=await hrApi.sendSalarySlipEmail(slip.salaryId,to); alert(r.message || "Salary slip sent successfully.");}catch(e){setError(e.message);}}} />}
  </section>;
}

function SalarySlipModal({ slip, onClose, onPrint, onExcel, onEmail }) {
  const [companyName, setCompanyName] = useState(slip.companyName || "Company");
  const [companyAddress, setCompanyAddress] = useState(slip.companyAddress || localStorage.getItem("salarySlipCompanyAddress") || "");
  const e = slip.earnings, d = slip.deductions, t = slip.totals;

  function saveAddress() { localStorage.setItem("salarySlipCompanyAddress", companyAddress); }

  return <div style={S.modalBackdrop}><div style={S.modal}><div style={S.modalTop}><div><div style={S.kicker}>PAYROLL DOCUMENT</div><h2>Salary Slip Preview</h2></div><div style={S.actions}><button type="button" style={S.secondary} onClick={onExcel}>↓ Excel</button><button type="button" style={S.secondary} onClick={()=>{const email=window.prompt("Employee email address", slip.employeeEmail || ""); if(email) onEmail(email);}}>✉ Email Employee</button><button type="button" style={S.primary} onClick={()=>onPrint({ companyName, companyAddress })}>🖨 PDF / Print</button><button type="button" style={S.close} onClick={onClose}>×</button></div></div><div style={S.slipSettings}><label style={S.label}>Company Name<input style={S.input} value={companyName} onChange={e=>setCompanyName(e.target.value)}/></label><label style={{...S.label,flex:2}}>Company Address<input style={S.input} value={companyAddress} onChange={e=>setCompanyAddress(e.target.value)} onBlur={saveAddress}/></label></div><div style={S.slipPaper}><div style={{textAlign:"center",borderBottom:"2px solid #1d4f91",paddingBottom:14,marginBottom:14}}><h1 style={{margin:0,fontSize:24,color:"#172b4d"}}>{companyName}</h1><div style={{color:"#667085",marginTop:4}}>{companyAddress || "Company Address"}</div><h3 style={{marginTop:9}}>Salary Slip - Month: {slip.monthLabel}</h3></div><table style={S.slipTable}><tbody><tr><td>Employee's Name</td><td>{slip.employeeName}</td><td>UAN No.</td><td>{slip.uanNo}</td></tr><tr><td>Designation</td><td>{slip.designation}</td><td>ESIC No.</td><td>{slip.esiNo}</td></tr><tr><td>DOB</td><td>{slip.dob}</td><td>Days</td><td>{slip.days}</td></tr><tr><td>DOJ</td><td>{slip.doj}</td><td>Paid Days</td><td>{slip.paidDays}</td></tr><tr><td>Bank Name</td><td>{slip.bankName}</td><td>LOP</td><td>{slip.lop}</td></tr><tr><td>IFSC Code</td><td>{slip.ifscCode}</td><td>Account No.</td><td>{slip.accountNo}</td></tr></tbody></table><table style={{...S.slipTable, ...S.salaryBreakdown, marginTop:14}}><thead><tr><th colSpan={2} style={{textAlign:"center"}}>Actuals</th><th colSpan={2} style={{textAlign:"center"}}>Earnings</th><th colSpan={2} style={{textAlign:"center"}}>Deductions</th></tr></thead><tbody><tr><td>Basic</td><td style={S.right}>{money(e.basic)}</td><td>Basic</td><td style={S.right}>{money(e.basic)}</td><td>ESI Employee</td><td style={S.right}>{money(d.esi)}</td></tr><tr><td>HRA</td><td style={S.right}>{money(e.hra)}</td><td>HRA</td><td style={S.right}>{money(e.hra)}</td><td>PF Employee</td><td style={S.right}>{money(d.pf)}</td></tr><tr><td>Conveyance</td><td style={S.right}>{money(e.conveyance)}</td><td>Conveyance</td><td style={S.right}>{money(e.conveyance)}</td><td>Professional Tax</td><td style={S.right}>{money(d.professionalTax)}</td></tr><tr><td>Others</td><td style={S.right}>{money(e.others)}</td><td>Others</td><td style={S.right}>{money(e.others)}</td><td>Fine / Cutting</td><td style={S.right}>{money(d.cutting)}</td></tr><tr><td>OT Approved</td><td style={S.right}>{money(t.overtimeAmount)}</td><td>OT Approved</td><td style={S.right}>{money(t.overtimeAmount)}</td><td>Other / LOP</td><td style={S.right}>{money(d.other)}</td></tr><tr style={S.totalRow}><th>Total Rs.</th><th style={S.right}>{money(t.earnings)}</th><th>Total Rs.</th><th style={S.right}>{money(t.earnings)}</th><th>Total Rs.</th><th style={S.right}>{money(t.deductions)}</th></tr></tbody></table><div style={S.netBox}><div><span style={S.netLabel}>Total Net Payable</span><small style={S.netSub}>Net salary after approved deductions</small></div><b style={S.netAmount}>{money(t.netPayable)}</b></div><div style={S.wordsBox}><b>In Words:</b> {slip.inWords}</div>{(Number(t.overtimeApprovedHours||0)>0 || Number(t.overtimeAmount||0)>0 || Number(t.cuttingApprovedMinutes||0)>0 || Number(t.cuttingAmount||0)>0) && <div style={S.salaryMeta}>{(Number(t.overtimeApprovedHours||0)>0 || Number(t.overtimeAmount||0)>0) && <span><b>OT:</b> Actual {fmtHours(t.overtimeHours)} · Approved {fmtHours(t.overtimeApprovedHours)} · Amount {money(t.overtimeAmount)}</span>}{(Number(t.cuttingApprovedMinutes||0)>0 || Number(t.cuttingAmount||0)>0) && <span><b>Fine / Cutting:</b> Actual {fmtMinutes(t.cuttingMinutes)} · Approved {fmtMinutes(t.cuttingApprovedMinutes)} · Amount {money(t.cuttingAmount)}</span>}</div>}</div></div></div>
}

const S = {
  page:{minHeight:"100vh",background:"linear-gradient(135deg,#f4f7fb 0%,#eef3f9 100%)",padding:"26px 20px",fontFamily:"Inter,Arial,sans-serif",color:"#172033"},
  wrap:{maxWidth:1480,margin:"0 auto"},
  header:{display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-end",marginBottom:22},
  kicker:{fontSize:11,fontWeight:800,letterSpacing:1.3,color:"#245a96",marginBottom:6},
  title:{fontSize:30,margin:0},
  subtitle:{margin:"7px 0 0",color:"#667085"},
  headerActions:{display:"flex",gap:8},
  tab:{border:"1px solid #d5dce7",background:"#fff",padding:"10px 14px",borderRadius:10,fontWeight:700,color:"#475467",cursor:"pointer"},
  tabActive:{border:"1px solid #1d4f91",background:"#1d4f91",color:"#fff",padding:"10px 14px",borderRadius:10,fontWeight:700,cursor:"pointer"},
  filterCard:{background:"#fff",border:"1px solid #dfe5ee",borderRadius:16,padding:18,boxShadow:"0 10px 28px rgba(16,24,40,.06)"},
  filterTitle:{fontSize:16,fontWeight:800,marginBottom:13},
  filters:{display:"grid",gridTemplateColumns:"repeat(6,minmax(120px,1fr))",gap:12},
  label:{display:"flex",flexDirection:"column",gap:6,fontSize:12,fontWeight:700,color:"#475467"},
  input:{padding:"10px 11px",border:"1px solid #d0d7e2",borderRadius:9,background:"#fff",fontSize:13,color:"#172033",outline:"none"},
  actions:{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14,flexWrap:"wrap"},
  primary:{border:0,background:"#1d4f91",color:"#fff",padding:"10px 14px",borderRadius:9,fontWeight:800,cursor:"pointer"},
  secondary:{border:"1px solid #d5dce7",background:"#fff",color:"#1d3557",padding:"10px 14px",borderRadius:9,fontWeight:800,cursor:"pointer"},
  error:{marginTop:14,background:"#fff0f0",color:"#b42318",border:"1px solid #f3c4c4",padding:12,borderRadius:10},
  kpis:{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,margin:"15px 0"},
  kpi:{background:"#fff",border:"1px solid #dfe5ee",borderRadius:13,padding:"13px 14px",boxShadow:"0 7px 18px rgba(16,24,40,.04)"},
  tableCard:{background:"#fff",border:"1px solid #dfe5ee",borderRadius:16,overflow:"hidden",boxShadow:"0 10px 28px rgba(16,24,40,.05)"},
  tableHead:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",borderBottom:"1px solid #e7ebf0"},
  tableWrap:{overflowX:"auto"},
  table:{width:"100%",borderCollapse:"collapse",fontSize:12},
  empty:{textAlign:"center",padding:35,color:"#667085"},
  linkBtn:{border:0,background:"#edf4ff",color:"#1d4f91",padding:"7px 10px",borderRadius:8,fontWeight:800,cursor:"pointer"},
  modalBackdrop:{position:"fixed",inset:0,background:"rgba(15,23,42,.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:18,zIndex:50},
  modal:{background:"#fff",width:"min(1060px,96vw)",maxHeight:"92vh",overflow:"auto",borderRadius:18,boxShadow:"0 25px 70px rgba(0,0,0,.3)"},
  modalTop:{position:"sticky",top:0,zIndex:2,background:"#fff",display:"flex",justifyContent:"space-between",gap:12,padding:16,borderBottom:"1px solid #e7ebf0"},
  close:{border:0,background:"#f2f4f7",fontSize:24,width:42,height:42,borderRadius:9,cursor:"pointer"},
  slipSettings:{display:"flex",gap:10,padding:"14px 18px",background:"#f8fafc"},
  slipPaper:{margin:18,padding:22,border:"1px solid #dce3ec",borderRadius:12,background:"#fff"},
  slipTable:{width:"100%",borderCollapse:"collapse",fontSize:12},
  salaryBreakdown:{border:"1px solid #dfe6ef",borderRadius:12,overflow:"hidden"},
  right:{textAlign:"right"},
  totalRow:{background:"#f4f7fb"},
  netBox:{marginTop:15,padding:"14px 16px",background:"linear-gradient(90deg,#f4f8ff,#eef5ff)",border:"1px solid #cfe0fa",borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:15},
  netLabel:{display:"block",fontWeight:800},
  netSub:{display:"block",marginTop:3,color:"#667085",fontSize:10},
  netAmount:{fontSize:20,color:"#17365d"},
  wordsBox:{marginTop:12,padding:"11px 13px",background:"#fafbfd",border:"1px solid #e7ebf0",borderRadius:9,fontSize:12},
  salaryMeta:{marginTop:12,paddingTop:10,borderTop:"1px dashed #d6dde8",display:"flex",flexWrap:"wrap",gap:"7px 16px",fontSize:10,color:"#667085"},
};
