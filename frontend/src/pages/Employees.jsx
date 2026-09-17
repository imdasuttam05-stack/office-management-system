import React, { useEffect, useMemo, useState } from "react";
import { hrApi } from "../lib/hrApi.js";

const initialForm = {
  employeeCode: "", companyName: "", name: "", fatherName: "", email: "", mobile: "",
  dateOfBirth: "", gender: "", address: "", department: "", designation: "", location: "",
  employeeType: "Permanent", joiningDate: new Date().toISOString().slice(0, 10),
  grossSalary: "", basicSalary: "", hra: "", da: "", conveyance: "", otherAllowance: "",
  professionalTax: "", otherDeduction: "", pfApplicable: true, pfNumber: "", pfRate: "",
  pfAmount: "", esiApplicable: false, esiNumber: "", esiRate: "", esiAmount: "",
  aadhaarNo: "", panNo: "", uanNo: "", bankName: "", accountHolderName: "", accountNumber: "",
  ifscCode: "", branchName: "", accountType: "", payrollManual: false,
};

function Field({ label, name, type = "text", value, onChange, required = false, children }) {
  return <label style={S.label}><span>{label}{required ? " *" : ""}</span>{children || <input name={name} type={type} value={value ?? ""} onChange={onChange} required={required} style={S.input} />}</label>;
}
function SelectField({ label, name, value, onChange, options, required = false }) {
  return <Field label={label} name={name} value={value} onChange={onChange} required={required}><select name={name} value={value} onChange={onChange} required={required} style={S.input}><option value="">Select {label}</option>{options.map(x => <option key={x} value={x}>{x}</option>)}</select></Field>;
}
function MoneyField({ label, name, value, onChange, readOnly = false }) { return <Field label={label} name={name} type="number" value={value} onChange={onChange}><input name={name} type="number" min="0" step="0.01" value={value ?? ""} onChange={onChange} readOnly={readOnly} style={{ ...S.input, background: readOnly ? "#f4f6f8" : "#fff" }} /></Field>; }
function CheckField({ label, name, checked, onChange }) { return <label style={S.check}><input type="checkbox" name={name} checked={checked} onChange={onChange} /><span>{label}</span></label>; }
function Section({ title, children }) { return <section style={S.section}><h2 style={S.sectionTitle}>{title}</h2><div style={S.grid}>{children}</div></section>; }

export default function Employees() {
  const [rows, setRows] = useState([]), [form, setForm] = useState(initialForm), [options, setOptions] = useState({ companies: [], departmentOptions: [], designationOptions: [], employeeTypeOptions: [], settings: {} });
  const [rates, setRates] = useState({ basicPercent: 50, hraPercent: 20, daPercent: 10, conveyancePercent: 5, pfPercent: 12, esiPercent: 0.75 });
  const [newCompany, setNewCompany] = useState(""), [showCompany, setShowCompany] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [saving, setSaving] = useState(false), [savingRates, setSavingRates] = useState(false);

  async function load() {
    try { setError(""); const [e, o] = await Promise.all([hrApi.employees(), hrApi.options()]); setRows(e.employees || []); setOptions(o); setRates(o.settings || rates); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const gross = Number(form.grossSalary || 0);
  const calculated = useMemo(() => ({
    basic: +(gross * Number(rates.basicPercent || 0) / 100).toFixed(2),
    hra: +(gross * Number(rates.hraPercent || 0) / 100).toFixed(2),
    da: +(gross * Number(rates.daPercent || 0) / 100).toFixed(2),
    conveyance: +(gross * Number(rates.conveyancePercent || 0) / 100).toFixed(2),
    pf: form.pfApplicable ? +(gross * Number(rates.pfPercent || 0) / 100).toFixed(2) : 0,
    esi: form.esiApplicable ? +(gross * Number(rates.esiPercent || 0) / 100).toFixed(2) : 0,
  }), [gross, rates, form.pfApplicable, form.esiApplicable]);

  const update = e => { const { name, value, type, checked } = e.target; setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value })); setError(""); setMessage(""); };
  const updateRate = e => setRates(p => ({ ...p, [e.target.name]: e.target.value }));

  async function saveRates() {
    setSavingRates(true); setError("");
    try { const body = Object.fromEntries(Object.entries(rates).map(([k,v]) => [k, Number(v || 0)])); const result = await hrApi.saveOptions(body); setRates(result.settings); setMessage("Payroll percentages saved for all employees."); }
    catch (e) { setError(e.message); } finally { setSavingRates(false); }
  }
  async function addCompany() {
    if (!newCompany.trim()) return;
    try { await hrApi.createCompany(newCompany.trim()); setNewCompany(""); setShowCompany(false); await load(); setMessage("Company added successfully."); }
    catch (e) { setError(e.message); }
  }
  async function save(e) {
    e.preventDefault(); setError(""); setMessage(""); setSaving(true);
    try {
      const body = { ...form, basicSalary: calculated.basic, hra: calculated.hra, da: calculated.da, conveyance: calculated.conveyance, pfRate: Number(rates.pfPercent), pfAmount: calculated.pf, esiRate: Number(rates.esiPercent), esiAmount: calculated.esi, grossSalary: gross };
      ["grossSalary","basicSalary","hra","da","conveyance","otherAllowance","professionalTax","otherDeduction","pfRate","pfAmount","esiRate","esiAmount"].forEach(k => body[k] = Number(body[k] || 0));
      if (!body.dateOfBirth) delete body.dateOfBirth; if (!body.employeeCode) delete body.employeeCode;
      await hrApi.createEmployee(body); setForm(initialForm); setMessage("Employee added successfully."); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return <main style={S.page}>
    <div style={S.header}><div><h1 style={S.h1}>Employee Master</h1><p style={S.sub}>Company, employee, salary, PF/ESI and bank details</p></div></div>
    {error && <div style={S.error}>{error}</div>}{message && <div style={S.success}>{message}</div>}

    <section style={S.card}><div style={S.rateHeader}><div><h2 style={S.sectionTitle}>Common Payroll % Settings</h2><p style={S.help}>These rates are common for all employees. Change once, then the same rates will calculate automatically.</p></div><button type="button" onClick={saveRates} disabled={savingRates} style={S.btn}>{savingRates ? "Saving..." : "Save Rates"}</button></div>
      <div style={S.grid}>{[["Basic %","basicPercent"],["HRA %","hraPercent"],["DA %","daPercent"],["Conveyance %","conveyancePercent"],["PF %","pfPercent"],["ESI %","esiPercent"]].map(([label,name]) => <Field key={name} label={label} name={name} type="number" value={rates[name]} onChange={updateRate}/>)}</div>
    </section>

    <form onSubmit={save} style={S.card}>
      <Section title="Personal & Company Details">
        <Field label="Employee ID" name="employeeCode" value={form.employeeCode} onChange={update}/>
        <Field label="Company Name" name="companyName" value={form.companyName} onChange={update} required><select name="companyName" value={form.companyName} onChange={update} required style={S.input}><option value="">Select Company</option>{options.companies.map(x => <option key={x}>{x}</option>)}</select></Field>
        <div style={S.inlineAction}><button type="button" onClick={() => setShowCompany(v => !v)} style={S.smallBtn}>+ Add Company</button>{showCompany && <div style={S.addRow}><input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="New company name" style={S.input}/><button type="button" onClick={addCompany} style={S.smallBtn}>Save</button></div>}</div>
        <Field label="Employee Name" name="name" value={form.name} onChange={update} required/><Field label="Father / Husband Name" name="fatherName" value={form.fatherName} onChange={update}/><Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update}/><SelectField label="Gender" name="gender" value={form.gender} onChange={update} options={["Male","Female","Other"]}/><Field label="Mobile No." name="mobile" value={form.mobile} onChange={update}/><Field label="Email" name="email" type="email" value={form.email} onChange={update}/><Field label="Joining Date" name="joiningDate" type="date" value={form.joiningDate} onChange={update} required/>
        <SelectField label="Department" name="department" value={form.department} onChange={update} options={options.departmentOptions}/><SelectField label="Designation" name="designation" value={form.designation} onChange={update} options={options.designationOptions}/><Field label="Location" name="location" value={form.location} onChange={update}/><SelectField label="Employee Type" name="employeeType" value={form.employeeType} onChange={update} options={options.employeeTypeOptions}/>
        <label style={{ ...S.label, gridColumn: "1 / -1" }}><span>Address</span><textarea name="address" value={form.address} onChange={update} style={{ ...S.input, minHeight: 70 }}/></label>
      </Section>

      <Section title="Salary & Payroll"><MoneyField label="Gross Salary" name="grossSalary" value={form.grossSalary} onChange={update} required/><MoneyField label={`Basic (${rates.basicPercent}%)`} name="basicSalary" value={calculated.basic} onChange={() => {}} readOnly/><MoneyField label={`HRA (${rates.hraPercent}%)`} name="hra" value={calculated.hra} onChange={() => {}} readOnly/><MoneyField label={`DA (${rates.daPercent}%)`} name="da" value={calculated.da} onChange={() => {}} readOnly/><MoneyField label={`Conveyance (${rates.conveyancePercent}%)`} name="conveyance" value={calculated.conveyance} onChange={() => {}} readOnly/><MoneyField label="Other Allowance (Manual)" name="otherAllowance" value={form.otherAllowance} onChange={update}/><MoneyField label="Professional Tax (Manual)" name="professionalTax" value={form.professionalTax} onChange={update}/><MoneyField label="Other Deduction (Manual)" name="otherDeduction" value={form.otherDeduction} onChange={update}/>
        <CheckField label={`PF Applicable — ${rates.pfPercent}% = ₹${calculated.pf.toLocaleString("en-IN")}`} name="pfApplicable" checked={form.pfApplicable} onChange={update}/><Field label="PF Number" name="pfNumber" value={form.pfNumber} onChange={update}/><CheckField label={`ESI Applicable — ${rates.esiPercent}% = ₹${calculated.esi.toLocaleString("en-IN")}`} name="esiApplicable" checked={form.esiApplicable} onChange={update}/><Field label="ESI Number" name="esiNumber" value={form.esiNumber} onChange={update}/>
        <div style={S.summary}><span>Gross Salary</span><b>₹{gross.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></div>
      </Section>

      <Section title="Statutory / Identity Details"><Field label="Aadhaar No." name="aadhaarNo" value={form.aadhaarNo} onChange={update}/><Field label="PAN No." name="panNo" value={form.panNo} onChange={update}/><Field label="UAN No." name="uanNo" value={form.uanNo} onChange={update}/></Section>
      <Section title="Bank Details"><Field label="Bank Name" name="bankName" value={form.bankName} onChange={update}/><Field label="Account Holder Name" name="accountHolderName" value={form.accountHolderName} onChange={update}/><Field label="Account Number" name="accountNumber" value={form.accountNumber} onChange={update}/><Field label="IFSC Code" name="ifscCode" value={form.ifscCode} onChange={update}/><Field label="Branch" name="branchName" value={form.branchName} onChange={update}/><SelectField label="Account Type" name="accountType" value={form.accountType} onChange={update} options={["Savings","Current","Salary"]}/></Section>
      <div style={S.actions}><button type="submit" disabled={saving || !options.companies.length} style={S.btn}>{saving ? "Saving..." : "+ Add Employee"}</button><button type="button" onClick={() => setForm(initialForm)} style={S.cancel}>Clear</button>{!options.companies.length && <span style={S.warning}>Add a Company first.</span>}</div>
    </form>

    <section style={S.card}><h2 style={S.sectionTitle}>Employee List ({rows.length})</h2><div style={{ overflowX: "auto" }}><table style={S.table}><thead><tr><th>Company</th><th>Employee ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Gross</th><th>PF</th><th>ESI</th><th>Status</th></tr></thead><tbody>{rows.map(e => <tr key={e._id}><td>{e.companyName || "-"}</td><td>{e.employeeCode}</td><td>{e.name}</td><td>{e.department || "-"}</td><td>{e.designation || "-"}</td><td>₹{Number(e.grossSalary || 0).toLocaleString("en-IN")}</td><td>{e.pfApplicable ? `₹${Number(e.pfAmount || 0).toLocaleString("en-IN")}` : "No"}</td><td>{e.esiApplicable ? `₹${Number(e.esiAmount || 0).toLocaleString("en-IN")}` : "No"}</td><td>{e.status}</td></tr>)}{!rows.length && <tr><td colSpan="9" style={S.empty}>No employees found.</td></tr>}</tbody></table></div></section>
  </main>;
}

const S = { page:{padding:24,background:"#f5f7fb",minHeight:"100vh",fontFamily:"Arial,sans-serif",color:"#172033"},header:{display:"flex",justifyContent:"space-between",alignItems:"center"},h1:{margin:0,fontSize:28},sub:{color:"#667085",marginTop:6},card:{background:"#fff",padding:22,borderRadius:18,marginTop:18,boxShadow:"0 8px 24px rgba(15,23,42,.06)"},section:{paddingBottom:20,marginBottom:22,borderBottom:"1px solid #e8edf4"},sectionTitle:{margin:"0 0 16px",fontSize:18},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12},label:{display:"flex",flexDirection:"column",gap:6,fontSize:13,fontWeight:700},input:{width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #d9e1ec",borderRadius:9,background:"#fff",fontSize:14},check:{display:"flex",alignItems:"center",gap:8,padding:12,border:"1px solid #e5eaf1",borderRadius:9,fontSize:14},summary:{padding:12,borderRadius:9,background:"#f0f6ff",display:"flex",justifyContent:"space-between",alignItems:"center"},actions:{display:"flex",gap:10,marginTop:8,alignItems:"center",flexWrap:"wrap"},btn:{padding:"12px 20px",background:"#1d4f91",color:"#fff",border:0,borderRadius:10,fontWeight:700,cursor:"pointer"},cancel:{padding:"12px 20px",background:"#fff",color:"#344054",border:"1px solid #d0d5dd",borderRadius:10,fontWeight:700},smallBtn:{padding:"9px 12px",background:"#475569",color:"#fff",border:0,borderRadius:8,fontWeight:700,cursor:"pointer"},inlineAction:{display:"flex",flexDirection:"column",gap:8,justifyContent:"end"},addRow:{display:"flex",gap:6},rateHeader:{display:"flex",justifyContent:"space-between",gap:15,alignItems:"center",marginBottom:12},help:{color:"#667085",fontSize:13,margin:0},error:{background:"#fee4e2",color:"#b42318",padding:12,borderRadius:10,marginTop:16},success:{background:"#ecfdf3",color:"#027a48",padding:12,borderRadius:10,marginTop:16},warning:{color:"#b54708",fontWeight:700},table:{width:"100%",borderCollapse:"collapse",fontSize:13},empty:{textAlign:"center",padding:24,color:"#667085"}};
