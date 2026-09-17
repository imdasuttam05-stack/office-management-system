import React, { useEffect, useMemo, useState } from "react";
import { hrApi } from "../lib/hrApi.js";

const initialForm = {
  employeeCode: "",
  name: "",
  fatherName: "",
  email: "",
  mobile: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  department: "",
  designation: "",
  location: "",
  employeeType: "Permanent",
  joiningDate: new Date().toISOString().slice(0, 10),
  basicSalary: "",
  hra: "",
  da: "",
  conveyance: "",
  otherAllowance: "",
  professionalTax: "",
  otherDeduction: "",
  pfApplicable: false,
  pfNumber: "",
  esiApplicable: false,
  esiNumber: "",
  aadhaarNo: "",
  panNo: "",
  uanNo: "",
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  branchName: "",
  accountType: "",
};

const moneyFields = ["basicSalary", "hra", "da", "conveyance", "otherAllowance", "professionalTax", "otherDeduction"];

function Field({ label, name, type = "text", value, onChange, required = false, children }) {
  return (
    <label style={S.label}>
      <span>{label}{required ? " *" : ""}</span>
      {children || (
        <input
          name={name}
          type={type}
          value={value ?? ""}
          onChange={onChange}
          required={required}
          style={S.input}
        />
      )}
    </label>
  );
}

export default function Employees() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const gross = useMemo(
    () => moneyFields.slice(0, 5).reduce((sum, key) => sum + Number(form[key] || 0), 0),
    [form]
  );

  async function load() {
    try {
      setError("");
      const data = await hrApi.employees();
      setRows(Array.isArray(data.employees) ? data.employees : []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  const update = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setError("");
    setMessage("");
  };

  async function save(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const body = { ...form };
      moneyFields.forEach((key) => { body[key] = Number(body[key] || 0); });
      if (!body.dateOfBirth) delete body.dateOfBirth;
      if (!body.employeeCode) delete body.employeeCode;

      await hrApi.createEmployee(body);
      setForm(initialForm);
      setMessage("Employee added successfully.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Employee Master</h1>
          <p style={S.sub}>Complete employee, payroll, statutory and bank details</p>
        </div>
      </div>

      {error && <div style={S.error}>{error}</div>}
      {message && <div style={S.success}>{message}</div>}

      <form onSubmit={save} style={S.card}>
        <Section title="Personal Details">
          <Field label="Employee ID" name="employeeCode" value={form.employeeCode} onChange={update} />
          <Field label="Employee Name" name="name" value={form.name} onChange={update} required />
          <Field label="Father / Husband Name" name="fatherName" value={form.fatherName} onChange={update} />
          <Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update} />
          <Field label="Gender" name="gender" value={form.gender} onChange={update}>
            <select name="gender" value={form.gender} onChange={update} style={S.input}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>
          </Field>
          <Field label="Mobile No." name="mobile" value={form.mobile} onChange={update} />
          <Field label="Email" name="email" type="email" value={form.email} onChange={update} />
          <Field label="Joining Date" name="joiningDate" type="date" value={form.joiningDate} onChange={update} required />
          <Field label="Department" name="department" value={form.department} onChange={update} />
          <Field label="Designation" name="designation" value={form.designation} onChange={update} />
          <Field label="Location" name="location" value={form.location} onChange={update} />
          <Field label="Employee Type" name="employeeType" value={form.employeeType} onChange={update} />
          <label style={{ ...S.label, gridColumn: "1 / -1" }}><span>Address</span><textarea name="address" value={form.address} onChange={update} style={{ ...S.input, minHeight: 70 }} /></label>
        </Section>

        <Section title="Salary & Payroll">
          <MoneyField label="Basic Salary" name="basicSalary" value={form.basicSalary} onChange={update} required />
          <MoneyField label="HRA" name="hra" value={form.hra} onChange={update} />
          <MoneyField label="DA" name="da" value={form.da} onChange={update} />
          <MoneyField label="Conveyance" name="conveyance" value={form.conveyance} onChange={update} />
          <MoneyField label="Other Allowance" name="otherAllowance" value={form.otherAllowance} onChange={update} />
          <div style={S.summary}><span>Gross Salary</span><b>₹{gross.toLocaleString("en-IN")}</b></div>
          <MoneyField label="Professional Tax" name="professionalTax" value={form.professionalTax} onChange={update} />
          <MoneyField label="Other Deduction" name="otherDeduction" value={form.otherDeduction} onChange={update} />

          <CheckField label="PF Applicable" name="pfApplicable" checked={form.pfApplicable} onChange={update} />
          <Field label="PF Number" name="pfNumber" value={form.pfNumber} onChange={update} />
          <CheckField label="ESI Applicable" name="esiApplicable" checked={form.esiApplicable} onChange={update} />
          <Field label="ESI Number" name="esiNumber" value={form.esiNumber} onChange={update} />
        </Section>

        <Section title="Statutory / Identity Details">
          <Field label="Aadhaar No." name="aadhaarNo" value={form.aadhaarNo} onChange={update} />
          <Field label="PAN No." name="panNo" value={form.panNo} onChange={update} />
          <Field label="UAN No." name="uanNo" value={form.uanNo} onChange={update} />
        </Section>

        <Section title="Bank Details">
          <Field label="Bank Name" name="bankName" value={form.bankName} onChange={update} />
          <Field label="Account Holder Name" name="accountHolderName" value={form.accountHolderName} onChange={update} />
          <Field label="Account Number" name="accountNumber" value={form.accountNumber} onChange={update} />
          <Field label="IFSC Code" name="ifscCode" value={form.ifscCode} onChange={update} />
          <Field label="Branch" name="branchName" value={form.branchName} onChange={update} />
          <Field label="Account Type" name="accountType" value={form.accountType} onChange={update}>
            <select name="accountType" value={form.accountType} onChange={update} style={S.input}><option value="">Select</option><option>Savings</option><option>Current</option><option>Salary</option></select>
          </Field>
        </Section>

        <div style={S.actions}>
          <button type="submit" disabled={saving} style={S.btn}>{saving ? "Saving..." : "+ Add Employee"}</button>
          <button type="button" onClick={() => setForm(initialForm)} style={S.cancel}>Clear</button>
        </div>
      </form>

      <section style={S.card}>
        <h2 style={S.sectionTitle}>Employee List ({rows.length})</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead><tr><th>Employee ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Joining Date</th><th>Basic</th><th>PF</th><th>ESI</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e._id}>
                  <td>{e.employeeCode}</td><td>{e.name}</td><td>{e.department || "-"}</td><td>{e.designation || "-"}</td>
                  <td>{e.joiningDate ? new Date(e.joiningDate).toLocaleDateString("en-IN") : "-"}</td>
                  <td>₹{Number(e.basicSalary || 0).toLocaleString("en-IN")}</td><td>{e.pfApplicable ? "Yes" : "No"}</td><td>{e.esiApplicable ? "Yes" : "No"}</td><td>{e.status}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="9" style={S.empty}>No employees found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Section({ title, children }) {
  return <section style={S.section}><h2 style={S.sectionTitle}>{title}</h2><div style={S.grid}>{children}</div></section>;
}

function MoneyField({ label, name, value, onChange, required }) {
  return <Field label={label} name={name} type="number" value={value} onChange={onChange} required={required} />;
}

function CheckField({ label, name, checked, onChange }) {
  return <label style={S.check}><input type="checkbox" name={name} checked={checked} onChange={onChange} /><span>{label}</span></label>;
}

const S = {
  page: { padding: 24, background: "#f5f7fb", minHeight: "100vh", fontFamily: "Arial, sans-serif", color: "#172033" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  h1: { margin: 0, fontSize: 28 }, sub: { color: "#667085", marginTop: 6 },
  card: { background: "#fff", padding: 22, borderRadius: 18, marginTop: 18, boxShadow: "0 8px 24px rgba(15,23,42,.06)" },
  section: { paddingBottom: 20, marginBottom: 22, borderBottom: "1px solid #e8edf4" },
  sectionTitle: { margin: "0 0 16px", fontSize: 18 }, grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 },
  input: { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid #d9e1ec", borderRadius: 9, background: "#fff", fontSize: 14 },
  check: { display: "flex", alignItems: "center", gap: 8, padding: 12, border: "1px solid #e5eaf1", borderRadius: 9, fontSize: 14 },
  summary: { padding: 12, borderRadius: 9, background: "#f0f6ff", display: "flex", justifyContent: "space-between", alignItems: "center" },
  actions: { display: "flex", gap: 10, marginTop: 8 }, btn: { padding: "12px 20px", background: "#1d4f91", color: "#fff", border: 0, borderRadius: 10, fontWeight: 700, cursor: "pointer" },
  cancel: { padding: "12px 20px", background: "#fff", color: "#344054", border: "1px solid #d0d5dd", borderRadius: 10, fontWeight: 700 },
  error: { background: "#fee4e2", color: "#b42318", padding: 12, borderRadius: 10, marginTop: 16 },
  success: { background: "#ecfdf3", color: "#027a48", padding: 12, borderRadius: 10, marginTop: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  empty: { textAlign: "center", padding: 24, color: "#667085" },
};
