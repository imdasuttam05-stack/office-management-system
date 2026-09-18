import React, { useEffect, useMemo, useState } from "react";
import { hrApi } from "../lib/hrApi.js";

const initialForm = {
  employeeCode: "", companyName: "", state: "", pinCode: "", name: "", fatherName: "", email: "", mobile: "",
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

const PT_SLABS = {
  "West Bengal": [[10000,0],[15000,110],[25000,130],[40000,150],[Infinity,200]],
  "Maharashtra": [[7500,0],[10000,175],[Infinity,200]],
  "Karnataka": [[15000,0],[Infinity,200]],
  "Telangana": [[15000,0],[20000,150],[Infinity,200]],
  "Andhra Pradesh": [[15000,0],[20000,150],[Infinity,200]],
  "Tamil Nadu": [[21000,0],[30000,135],[45000,315],[60000,690],[75000,1025],[Infinity,1250]],
  "Gujarat": [[5999,0],[8999,20],[11999,40],[14999,60],[19999,80],[24999,100],[Infinity,200]],
};
function professionalTax(state, gross) {
  const slabs=PT_SLABS[state]; if(!slabs) return 0;
  return (slabs.find(([limit]) => gross <= limit) || [0,0])[1];
}

export default function Employees() {
  const [rows, setRows] = useState([]), [form, setForm] = useState(initialForm), [options, setOptions] = useState({ companies: [], departmentOptions: [], designationOptions: [], employeeTypeOptions: [], settings: {} });
  const [rates, setRates] = useState({ basicPercent: 60, hraPercent: 20, daPercent: 10, conveyancePercent: 5, otherAllowancePercent: 0, gratuityPercent: 4.81, pfPercent: 12, esiPercent: 0.75, employerPfPercent: 12, employerEsiPercent: 3.25, hraBase: "gross", daBase: "gross", conveyanceBase: "gross", otherAllowanceBase: "gross", gratuityBase: "basic", pfBase: "gross", pfCeilingEnabled: true, pfWageCeiling: 15000, esiBase: "gross", esiCeilingEnabled: true, esiWageCeiling: 21000 });
  const [newCompany, setNewCompany] = useState(""); const [editingId, setEditingId] = useState(null), [showCompany, setShowCompany] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [saving, setSaving] = useState(false), [savingRates, setSavingRates] = useState(false);

  async function load() {
    try { setError(""); const [e, o] = await Promise.all([hrApi.employees(), hrApi.options()]); setRows(e.employees || []); setOptions(o); setRates(o.settings || rates); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const gross = Number(form.grossSalary || 0);
  const calculated = useMemo(() => {
    const basic = +(gross * Number(rates.basicPercent || 0) / 100).toFixed(2);
    const baseAmount = (base) => base === "basic" ? basic : base === "basicDa" ? basic + da : gross;
    const daBase = rates.daBase === "basic" ? basic : gross;
    const da = +(daBase * Number(rates.daPercent || 0) / 100).toFixed(2);
    const calcBase = (base) => base === "basic" ? basic : base === "basicDa" ? basic + da : gross;
    const hra = +(calcBase(rates.hraBase) * Number(rates.hraPercent || 0) / 100).toFixed(2);
    const conveyance = +(calcBase(rates.conveyanceBase) * Number(rates.conveyancePercent || 0) / 100).toFixed(2);
    const otherAllowance = +(calcBase(rates.otherAllowanceBase) * Number(rates.otherAllowancePercent || 0) / 100).toFixed(2);
    const pfWage = calcBase(rates.pfBase);
    const pfBase = rates.pfCeilingEnabled ? Math.min(pfWage, Number(rates.pfWageCeiling || 0)) : pfWage;
    const pf = form.pfApplicable ? +(pfBase * Number(rates.pfPercent || 0) / 100).toFixed(2) : 0;
    const esiWage = calcBase(rates.esiBase);
    const esiEligible = !rates.esiCeilingEnabled || esiWage <= Number(rates.esiWageCeiling || 0);
    const esi = form.esiApplicable && esiEligible ? +(esiWage * Number(rates.esiPercent || 0) / 100).toFixed(2) : 0;
    const employerPf = form.pfApplicable ? +(pfBase * Number(rates.employerPfPercent || 0) / 100).toFixed(2) : 0;
    const employerEsi = form.esiApplicable && esiEligible ? +(esiWage * Number(rates.employerEsiPercent || 0) / 100).toFixed(2) : 0;
    const gratuityBase = rates.gratuityBase === "gross" ? gross : rates.gratuityBase === "basicDa" ? basic + da : basic;
    const gratuity = +(gratuityBase * Number(rates.gratuityPercent || 0) / 100).toFixed(2);
    const pt = professionalTax(form.state, gross);
    const ctc = +(gross + employerPf + employerEsi + gratuity).toFixed(2);
    return { basic, hra, da, conveyance, otherAllowance, pf, esi, employerPf, employerEsi, gratuity, pt, ctc, pfWage, pfBase, esiWage, esiEligible };
  }, [gross, rates, form.pfApplicable, form.esiApplicable, form.state]);

  const update = e => { const { name, value, type, checked } = e.target; setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value })); setError(""); setMessage(""); };

  const updateRate = e => setRates(p => ({ ...p, [e.target.name]: e.target.value }));

  async function saveRates() {
    setSavingRates(true); setError("");
    try { const body = { ...rates }; Object.keys(body).forEach(k => { if (k.endsWith("Percent") || k.endsWith("Ceiling")) body[k] = Number(body[k] || 0); }); const result = await hrApi.saveOptions(body); setRates(result.settings); setMessage("Payroll percentages saved for all employees."); }
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
      const body = { ...form, basicSalary: calculated.basic, hra: calculated.hra, da: calculated.da, conveyance: calculated.conveyance, otherAllowance: calculated.otherAllowance, professionalTax: calculated.pt, pfRate: Number(rates.pfPercent), pfAmount: calculated.pf, esiRate: Number(rates.esiPercent), esiAmount: calculated.esi, employerPfRate: Number(rates.employerPfPercent), employerPfAmount: calculated.employerPf, employerEsiRate: Number(rates.employerEsiPercent), employerEsiAmount: calculated.employerEsi, gratuityPercent: Number(rates.gratuityPercent), gratuityAmount: calculated.gratuity, ctc: calculated.ctc, grossSalary: gross };
      ["grossSalary","basicSalary","hra","da","conveyance","otherAllowance","professionalTax","otherDeduction","pfRate","pfAmount","esiRate","esiAmount","employerPfRate","employerPfAmount","employerEsiRate","employerEsiAmount","gratuityPercent","gratuityAmount","ctc"].forEach(k => body[k] = Number(body[k] || 0));
      if (!body.dateOfBirth) delete body.dateOfBirth; if (!body.employeeCode) delete body.employeeCode;
      if (editingId) { await hrApi.updateEmployee(editingId, body); setMessage("Employee updated successfully."); } else { await hrApi.createEmployee(body); setMessage("Employee added successfully."); } setEditingId(null); setForm(initialForm); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  useEffect(() => {
    const pin=String(form.pinCode||"").replace(/\D/g,"");
    if(pin.length!==6) return;
    const timer=setTimeout(async()=>{ try { const r=await fetch(`https://api.postalpincode.in/pincode/${pin}`); const d=await r.json(); const po=d?.[0]?.PostOffice?.[0]; if(po) setForm(p=>({...p,address:[po.Name,po.District,po.State].filter(Boolean).join(", "),state:po.State || p.state})); } catch {} },300);
    return()=>clearTimeout(timer);
  },[form.pinCode]);

  useEffect(() => {
    const ifsc=String(form.ifscCode||"").trim().toUpperCase(); if(ifsc.length<5) return;
    const timer=setTimeout(async()=>{ try { const r=await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`); if(!r.ok) return; const d=await r.json(); setForm(p=>({...p,bankName:d.BANK || p.bankName,branchName:d.BRANCH || p.branchName})); } catch {} },350);
    return()=>clearTimeout(timer);
  },[form.ifscCode]);

  function startEdit(e) {
    setEditingId(e._id);
    setForm({...initialForm, ...Object.fromEntries(Object.entries(e).map(([k,v])=>[k, v && typeof v === "string" && v.includes("T") ? v.slice(0,10) : v]))});
    window.scrollTo({top:0,behavior:"smooth"});
  }

  return <main style={S.page}>
    <div style={S.header}><div><h1 style={S.h1}>Employee Master</h1><p style={S.sub}>Company, employee, salary, PF/ESI and bank details</p></div></div>
    {error && <div style={S.error}>{error}</div>}{message && <div style={S.success}>{message}</div>}

    <section style={S.card}><div style={S.rateHeader}><div><h2 style={S.sectionTitle}>Common Payroll % Settings</h2><p style={S.help}>These rates are common for all employees. Change once, then the same rates will calculate automatically.</p></div><button type="button" onClick={saveRates} disabled={savingRates} style={S.btn}>{savingRates ? "Saving..." : "Save Rates"}</button></div>
      <div style={S.grid}>{[["Basic %","basicPercent"],["HRA %","hraPercent"],["DA %","daPercent"],["Conveyance %","conveyancePercent"],["Other Allowance %","otherAllowancePercent"],["Gratuity %","gratuityPercent"],["Employee PF %","pfPercent"],["Employee ESI %","esiPercent"],["Employer PF %","employerPfPercent"],["Employer ESI %","employerEsiPercent"]].map(([label,name]) => <Field key={name} label={label} name={name} type="number" value={rates[name]} onChange={updateRate}/>)}</div>
      <div style={{marginTop:18,padding:16,border:"1px solid #e5eaf1",borderRadius:12,background:"#fafcff"}}>
        <h3 style={{margin:"0 0 12px",fontSize:16}}>Calculation Rules</h3>
        <div style={S.grid}>
          {[['HRA Calculation Base','hraBase'],['DA Calculation Base','daBase'],['Conveyance Calculation Base','conveyanceBase'],['Other Allowance Base','otherAllowanceBase'],['Gratuity Calculation Base','gratuityBase'],['PF Calculation Base','pfBase'],['ESI Calculation Base','esiBase']].map(([label,name]) => <Field key={name} label={label} name={name} value={rates[name]} onChange={updateRate}><select name={name} value={rates[name]} onChange={updateRate} style={S.input}><option value="gross">Gross Salary</option><option value="basic">Basic Salary</option><option value="basicDa">Basic + DA</option></select></Field>)}
          <Field label="PF Maximum Wage" name="pfWageCeiling" type="number" value={rates.pfWageCeiling} onChange={updateRate}/>
          <Field label="ESI Wage Ceiling" name="esiWageCeiling" type="number" value={rates.esiWageCeiling} onChange={updateRate}/>
          <CheckField label={`PF Ceiling Apply (max ₹${Number(rates.pfWageCeiling || 0).toLocaleString("en-IN")})`} name="pfCeilingEnabled" checked={!!rates.pfCeilingEnabled} onChange={e=>setRates(p=>({...p,pfCeilingEnabled:e.target.checked}))}/>
          <CheckField label={`ESI Ceiling Apply (₹${Number(rates.esiWageCeiling || 0).toLocaleString("en-IN")})`} name="esiCeilingEnabled" checked={!!rates.esiCeilingEnabled} onChange={e=>setRates(p=>({...p,esiCeilingEnabled:e.target.checked}))}/>
        </div>
        <p style={S.help}>PF/ESI base and ceiling can be changed centrally. Current defaults use PF ₹15,000 and ESI ₹21,000.</p>
      </div>
    </section>

    <form onSubmit={save} style={S.card}>
      <Section title="Personal & Company Details">
        <Field label="Employee ID" name="employeeCode" value={form.employeeCode} onChange={update}/><SelectField label="State" name="state" value={form.state} onChange={update} options={options.states || []}/><Field label="PIN Code" name="pinCode" value={form.pinCode} onChange={update}/>
        <Field label="Company Name" name="companyName" value={form.companyName} onChange={update} required><select name="companyName" value={form.companyName} onChange={update} required style={S.input}><option value="">Select Company</option>{options.companies.map(x => <option key={x}>{x}</option>)}</select></Field>
        <div style={S.inlineAction}><button type="button" onClick={() => setShowCompany(v => !v)} style={S.smallBtn}>+ Add Company</button>{showCompany && <div style={S.addRow}><input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="New company name" style={S.input}/><button type="button" onClick={addCompany} style={S.smallBtn}>Save</button></div>}</div>
        <Field label="Employee Name" name="name" value={form.name} onChange={update} required/><Field label="Father / Husband Name" name="fatherName" value={form.fatherName} onChange={update}/><Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update}/><SelectField label="Gender" name="gender" value={form.gender} onChange={update} options={["Male","Female","Other"]}/><Field label="Mobile No." name="mobile" value={form.mobile} onChange={update}/><Field label="Email" name="email" type="email" value={form.email} onChange={update}/><Field label="Joining Date" name="joiningDate" type="date" value={form.joiningDate} onChange={update} required/>
        <SelectField label="Department" name="department" value={form.department} onChange={update} options={options.departmentOptions}/><SelectField label="Designation" name="designation" value={form.designation} onChange={update} options={options.designationOptions}/><Field label="Location" name="location" value={form.location} onChange={update}/><SelectField label="Employee Type" name="employeeType" value={form.employeeType} onChange={update} options={options.employeeTypeOptions}/>
        <label style={{ ...S.label, gridColumn: "1 / -1" }}><span>Address</span><textarea name="address" value={form.address} onChange={update} style={{ ...S.input, minHeight: 70 }}/></label>
      </Section>

      <Section title="Salary, Deductions, Gratuity & CTC">
        <MoneyField label="Gross Salary" name="grossSalary" value={form.grossSalary} onChange={update} required/>
        <MoneyField label={`Basic (${rates.basicPercent}%)`} name="basicSalary" value={calculated.basic} onChange={()=>{}} readOnly/>
        <MoneyField label={`HRA (${rates.hraPercent}%)`} name="hra" value={calculated.hra} onChange={()=>{}} readOnly/>
        <MoneyField label={`DA (${rates.daPercent}%)`} name="da" value={calculated.da} onChange={()=>{}} readOnly/>
        <MoneyField label={`Conveyance (${rates.conveyancePercent}%)`} name="conveyance" value={calculated.conveyance} onChange={()=>{}} readOnly/>
        <MoneyField label={`Other Allowance (${rates.otherAllowancePercent}%)`} name="otherAllowance" value={calculated.otherAllowance} onChange={()=>{}} readOnly/>
        <MoneyField label={`Employee PF (${rates.pfPercent}%)`} name="pfAmount" value={calculated.pf} onChange={()=>{}} readOnly/>
        <MoneyField label={`Employee ESI (${rates.esiPercent}%)`} name="esiAmount" value={calculated.esi} onChange={()=>{}} readOnly/>
        <MoneyField label="Professional Tax (Auto by State)" name="professionalTax" value={calculated.pt} onChange={()=>{}} readOnly/>
        <MoneyField label="Other Employee Deduction (Manual)" name="otherDeduction" value={form.otherDeduction} onChange={update}/>
        <MoneyField label={`Employer PF (${rates.employerPfPercent}%)`} name="employerPfAmount" value={calculated.employerPf} onChange={()=>{}} readOnly/>
        <MoneyField label={`Employer ESI (${rates.employerEsiPercent}%)`} name="employerEsiAmount" value={calculated.employerEsi} onChange={()=>{}} readOnly/>
        <MoneyField label={`Gratuity (${rates.gratuityPercent}% of ${rates.gratuityBase === "gross" ? "Gross" : rates.gratuityBase === "basicDa" ? "Basic + DA" : "Basic"})`} name="gratuityAmount" value={calculated.gratuity} onChange={()=>{}} readOnly/>
        <CheckField label="PF Applicable" name="pfApplicable" checked={form.pfApplicable} onChange={update}/><Field label="PF Number" name="pfNumber" value={form.pfNumber} onChange={update}/>
        <CheckField label="ESI Applicable" name="esiApplicable" checked={form.esiApplicable} onChange={update}/><Field label="ESI Number" name="esiNumber" value={form.esiNumber} onChange={update}/>
        <div style={S.summary}><span>Employee Deduction</span><b>₹{(calculated.pf + calculated.esi + calculated.pt + Number(form.otherDeduction||0)).toLocaleString("en-IN", {minimumFractionDigits:2})}</b></div>
        <div style={S.summary}><span>Employer Contribution + Gratuity</span><b>₹{(calculated.employerPf + calculated.employerEsi + calculated.gratuity).toLocaleString("en-IN", {minimumFractionDigits:2})}</b></div>
        <div style={{...S.summary, background:"#eaf7ef"}}><span>CTC</span><b>₹{calculated.ctc.toLocaleString("en-IN", {minimumFractionDigits:2})}</b></div>
      </Section>
      <Section title="Statutory / Identity Details"><Field label="Aadhaar No." name="aadhaarNo" value={form.aadhaarNo} onChange={update}/><Field label="PAN No." name="panNo" value={form.panNo} onChange={update}/><Field label="UAN No." name="uanNo" value={form.uanNo} onChange={update}/></Section>
      <Section title="Bank Details"><Field label="Bank Name" name="bankName" value={form.bankName} onChange={update}/><Field label="Account Holder Name" name="accountHolderName" value={form.accountHolderName} onChange={update}/><Field label="Account Number" name="accountNumber" value={form.accountNumber} onChange={update}/><Field label="IFSC Code" name="ifscCode" value={form.ifscCode} onChange={update}/><Field label="Branch" name="branchName" value={form.branchName} onChange={update}/><SelectField label="Account Type" name="accountType" value={form.accountType} onChange={update} options={["Savings","Current","Salary"]}/></Section>
      <div style={S.actions}><button type="submit" disabled={saving || !options.companies.length} style={S.btn}>{saving ? "Saving..." : (editingId ? "Update Employee" : "+ Add Employee")}</button><button type="button" onClick={() => { setEditingId(null); setForm(initialForm); }} style={S.cancel}>Clear</button>{!options.companies.length && <span style={S.warning}>Add a Company first.</span>}</div>
    </form>

    <section style={S.card}><h2 style={S.sectionTitle}>Employee List ({rows.length})</h2><div style={{ overflowX: "auto" }}><table style={S.table}><thead><tr><th>Company</th><th>Employee ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Gross</th><th>PF</th><th>ESI</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(e => <tr key={e._id}><td>{e.companyName || "-"}</td><td>{e.employeeCode}</td><td>{e.name}</td><td>{e.department || "-"}</td><td>{e.designation || "-"}</td><td>₹{Number(e.grossSalary || 0).toLocaleString("en-IN")}</td><td>{e.pfApplicable ? `₹${Number(e.pfAmount || 0).toLocaleString("en-IN")}` : "No"}</td><td>{e.esiApplicable ? `₹${Number(e.esiAmount || 0).toLocaleString("en-IN")}` : "No"}</td><td>{e.status}</td><td><button type="button" onClick={()=>startEdit(e)} style={S.smallBtn}>Edit</button></td></tr>)}{!rows.length && <tr><td colSpan="10" style={S.empty}>No employees found.</td></tr>}</tbody></table></div></section>
  </main>;
}

const S = { page:{padding:24,background:"#f5f7fb",minHeight:"100vh",fontFamily:"Arial,sans-serif",color:"#172033"},header:{display:"flex",justifyContent:"space-between",alignItems:"center"},h1:{margin:0,fontSize:28},sub:{color:"#667085",marginTop:6},card:{background:"#fff",padding:22,borderRadius:18,marginTop:18,boxShadow:"0 8px 24px rgba(15,23,42,.06)"},section:{paddingBottom:20,marginBottom:22,borderBottom:"1px solid #e8edf4"},sectionTitle:{margin:"0 0 16px",fontSize:18},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12},label:{display:"flex",flexDirection:"column",gap:6,fontSize:13,fontWeight:700},input:{width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #d9e1ec",borderRadius:9,background:"#fff",fontSize:14},check:{display:"flex",alignItems:"center",gap:8,padding:12,border:"1px solid #e5eaf1",borderRadius:9,fontSize:14},summary:{padding:12,borderRadius:9,background:"#f0f6ff",display:"flex",justifyContent:"space-between",alignItems:"center"},actions:{display:"flex",gap:10,marginTop:8,alignItems:"center",flexWrap:"wrap"},btn:{padding:"12px 20px",background:"#1d4f91",color:"#fff",border:0,borderRadius:10,fontWeight:700,cursor:"pointer"},cancel:{padding:"12px 20px",background:"#fff",color:"#344054",border:"1px solid #d0d5dd",borderRadius:10,fontWeight:700},smallBtn:{padding:"9px 12px",background:"#475569",color:"#fff",border:0,borderRadius:8,fontWeight:700,cursor:"pointer"},inlineAction:{display:"flex",flexDirection:"column",gap:8,justifyContent:"end"},addRow:{display:"flex",gap:6},rateHeader:{display:"flex",justifyContent:"space-between",gap:15,alignItems:"center",marginBottom:12},help:{color:"#667085",fontSize:13,margin:0},error:{background:"#fee4e2",color:"#b42318",padding:12,borderRadius:10,marginTop:16},success:{background:"#ecfdf3",color:"#027a48",padding:12,borderRadius:10,marginTop:16},warning:{color:"#b54708",fontWeight:700},table:{width:"100%",borderCollapse:"collapse",fontSize:13},empty:{textAlign:"center",padding:24,color:"#667085"}};
