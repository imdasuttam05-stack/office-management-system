import React, { useEffect, useMemo, useState } from "react";
import { hrApi } from "../lib/hrApi.js";

const initialForm = {
  employeeCode: "", companyName: "", state: "", pinCode: "", name: "", fatherName: "", email: "", mobile: "",
  dateOfBirth: "", gender: "", address: "", department: "", designation: "", workLocation: "",
  employeeType: "Permanent", shiftId: "", joiningDate: new Date().toISOString().slice(0, 10),
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
  const [rows, setRows] = useState([]), [form, setForm] = useState(initialForm), [shifts, setShifts] = useState([]), [options, setOptions] = useState({ companies: [], departmentOptions: [], designationOptions: [], employeeTypeOptions: [], states: [], settings: {} });
  const [rates, setRates] = useState({ basicPercent: 60, hraPercent: 20, daPercent: 10, conveyancePercent: 5, otherAllowancePercent: 0, gratuityPercent: 4.81, pfPercent: 12, esiPercent: 0.75, employerPfPercent: 12, employerEsiPercent: 3.25, hraBase: "gross", daBase: "gross", conveyanceBase: "gross", otherAllowanceBase: "gross", gratuityBase: "basic", pfBase: "gross", pfCeilingEnabled: true, pfWageCeiling: 15000, esiBase: "gross", esiCeilingEnabled: true, esiWageCeiling: 21000 });
  const [newCompany, setNewCompany] = useState(""); const [editingId, setEditingId] = useState(null), [showCompany, setShowCompany] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [saving, setSaving] = useState(false), [savingRates, setSavingRates] = useState(false);
  const [stateRuleState, setStateRuleState] = useState("");
  const [selectedIds, setSelectedIds] = useState([]), [search, setSearch] = useState(""), [statusFilter, setStatusFilter] = useState("All");
  const [taskOpen, setTaskOpen] = useState(false), [letterOpen, setLetterOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "Medium", dueDate: "" });
  const [letterTypes, setLetterTypes] = useState([]), [letterForm, setLetterForm] = useState({ employeeId: "", type: "Offer Letter", subject: "", body: "" });
  const [letterPreview, setLetterPreview] = useState(""), [sendingLetter, setSendingLetter] = useState(false);
  const [stateRuleDraft, setStateRuleDraft] = useState({});

  async function load() {
    try { setError(""); const [e, o, sh] = await Promise.all([hrApi.employees(), hrApi.options(), hrApi.shifts()]); setRows(e.employees || []); setOptions(o); setShifts(sh.shifts || []); setRates(o.settings || rates); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const gross = Number(form.grossSalary || 0);
  const calcRates = useMemo(() => {
    const override = form.state && options.settings?.stateRules?.[form.state];
    return override ? { ...rates, ...override } : rates;
  }, [rates, options.settings?.stateRules, form.state]);
  const calculated = useMemo(() => {
    const basic = +(gross * Number(calcRates.basicPercent || 0) / 100).toFixed(2);
    let da = 0;
    const baseAmount = (base) => base === "basic" ? basic : base === "basicDa" ? basic + da : gross;
    const daBase = calcRates.daBase === "basic" ? basic : calcRates.daBase === "basicDa" ? basic : gross;
    da = +(daBase * Number(calcRates.daPercent || 0) / 100).toFixed(2);
    const calcBase = (base) => base === "basic" ? basic : base === "basicDa" ? basic + da : gross;
    const hra = +(calcBase(calcRates.hraBase) * Number(calcRates.hraPercent || 0) / 100).toFixed(2);
    const conveyance = +(calcBase(calcRates.conveyanceBase) * Number(calcRates.conveyancePercent || 0) / 100).toFixed(2);
    const otherAllowance = +(calcBase(calcRates.otherAllowanceBase) * Number(calcRates.otherAllowancePercent || 0) / 100).toFixed(2);
    const pfWage = calcBase(calcRates.pfBase);
    const pfBase = calcRates.pfCeilingEnabled ? Math.min(pfWage, Number(calcRates.pfWageCeiling || 0)) : pfWage;
    const pf = form.pfApplicable ? +(pfBase * Number(calcRates.pfPercent || 0) / 100).toFixed(2) : 0;
    const esiWage = calcBase(calcRates.esiBase);
    const esiEligible = !calcRates.esiCeilingEnabled || esiWage <= Number(calcRates.esiWageCeiling || 0);
    const esi = form.esiApplicable && esiEligible ? +(esiWage * Number(calcRates.esiPercent || 0) / 100).toFixed(2) : 0;
    const employerPf = form.pfApplicable ? +(pfBase * Number(calcRates.employerPfPercent || 0) / 100).toFixed(2) : 0;
    const employerEsi = form.esiApplicable && esiEligible ? +(esiWage * Number(calcRates.employerEsiPercent || 0) / 100).toFixed(2) : 0;
    const gratuityBase = calcRates.gratuityBase === "gross" ? gross : calcRates.gratuityBase === "basicDa" ? basic + da : basic;
    const gratuity = +(gratuityBase * Number(calcRates.gratuityPercent || 0) / 100).toFixed(2);
    const pt = professionalTax(form.state, gross);
    const ctc = +(gross + employerPf + employerEsi + gratuity).toFixed(2);
    return { basic, hra, da, conveyance, otherAllowance, pf, esi, employerPf, employerEsi, gratuity, pt, ctc, pfWage, pfBase, esiWage, esiEligible };
  }, [gross, calcRates, form.pfApplicable, form.esiApplicable, form.state]);

  const update = e => { const { name, value, type, checked } = e.target; setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : value })); setError(""); setMessage(""); };

  const updateRate = e => setRates(p => ({ ...p, [e.target.name]: e.target.value }));
  const updateStateRule = e => { const { name, value, type, checked } = e.target; setStateRuleDraft(p => ({ ...p, [name]: type === "checkbox" ? checked : value })); };
  function selectStateRule(state) {
    setStateRuleState(state);
    const existing = options.settings?.stateRules?.[state];
    setStateRuleDraft(existing ? { ...rates, ...existing } : { ...rates });
  }
  function applyStateRule() {
    if (!stateRuleState) return;
    const next = { ...(options.settings?.stateRules || {}), [stateRuleState]: { ...stateRuleDraft } };
    setOptions(p => ({ ...p, settings: { ...p.settings, stateRules: next } }));
    setMessage(`${stateRuleState} payroll rule prepared. Click Save Rates to save it.`);
  }
  function clearStateRule() {
    if (!stateRuleState) return;
    const next = { ...(options.settings?.stateRules || {}) }; delete next[stateRuleState];
    setOptions(p => ({ ...p, settings: { ...p.settings, stateRules: next } }));
    setStateRuleDraft({ ...rates });
    setMessage(`${stateRuleState} override removed; it will use Common Rules.`);
  }

  async function saveRates() {
    setSavingRates(true); setError("");
    try { const body = { ...rates, stateRules: options.settings?.stateRules || {} }; Object.keys(body).forEach(k => { if (k.endsWith("Percent") || k.endsWith("Ceiling")) body[k] = Number(body[k] || 0); }); Object.entries(body.stateRules || {}).forEach(([state, rule]) => { Object.keys(rule).forEach(k => { if (k.endsWith("Percent") || k.endsWith("Ceiling")) rule[k] = Number(rule[k] || 0); }); }); const result = await hrApi.saveOptions(body); setRates(result.settings); setOptions(p => ({ ...p, settings: result.settings })); setMessage("Common and state-wise payroll rules saved."); }
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
      const body = { ...form, basicSalary: calculated.basic, hra: calculated.hra, da: calculated.da, conveyance: calculated.conveyance, otherAllowance: calculated.otherAllowance, professionalTax: calculated.pt, pfRate: Number(calcRates.pfPercent), pfAmount: calculated.pf, esiRate: Number(calcRates.esiPercent), esiAmount: calculated.esi, employerPfRate: Number(calcRates.employerPfPercent), employerPfAmount: calculated.employerPf, employerEsiRate: Number(calcRates.employerEsiPercent), employerEsiAmount: calculated.employerEsi, gratuityPercent: Number(calcRates.gratuityPercent), gratuityAmount: calculated.gratuity, ctc: calculated.ctc, grossSalary: gross };
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

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(e => {
      const matchesStatus = statusFilter === "All" || (e.status || "Active") === statusFilter;
      const hay = [e.employeeCode, e.name, e.companyName, e.department, e.designation, e.mobile, e.email].join(" ").toLowerCase();
      return matchesStatus && (!q || hay.includes(q));
    });
  }, [rows, search, statusFilter]);

  const toggleSelected = id => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const selectAllVisible = () => {
    const ids = visibleRows.map(x => x._id);
    setSelectedIds(p => ids.every(id => p.includes(id)) ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])]);
  };
  const changeEmployeeStatus = async (employee) => {
    const next = employee.status === "Inactive" ? "Active" : "Inactive";
    try { await hrApi.updateEmployee(employee._id, { status: next }); setRows(p => p.map(x => x._id === employee._id ? { ...x, status: next } : x)); setMessage(`${employee.name} is now ${next}.`); }
    catch (e) { setError(e.message); }
  };
  const openTask = () => { if (!selectedIds.length) return setError("Select at least one employee for the task."); setTaskOpen(true); setError(""); };
  const saveTask = async () => {
    if (!taskForm.title.trim()) return setError("Task title is required.");
    try { await hrApi.createEmployeeTask({ ...taskForm, employeeIds: selectedIds }); setTaskForm({ title: "", description: "", priority: "Medium", dueDate: "" }); setTaskOpen(false); setMessage(`Task assigned to ${selectedIds.length} employee(s).`); } catch (e) { setError(e.message); }
  };
  const openLetter = async (employeeId = selectedIds[0]) => {
    if (!employeeId) return setError("Select one employee for the letter.");
    try {
      const r = await hrApi.employeeLetterTypes();
      const type = (r.types || ["Offer Letter"])[0];
      const preview = await hrApi.previewEmployeeLetter({ employeeId, type });
      setLetterTypes(r.types || []);
      setLetterForm({ employeeId, type, subject: preview.subject || "", body: preview.body || "" });
      setLetterPreview(preview.html || "");
      setLetterOpen(true); setError("");
    } catch (e) { setError(e.message); }
  };
  const loadLetterTemplate = async (type) => {
    const employeeId = letterForm.employeeId;
    if (!employeeId) return;
    try { const r = await hrApi.previewEmployeeLetter({ employeeId, type }); setLetterForm(p => ({ ...p, type, subject: r.subject || "", body: r.body || "" })); setLetterPreview(r.html || ""); } catch (e) { setError(e.message); }
  };
  const sendLetter = async () => {
    if (!letterForm.employeeId) return;
    setSendingLetter(true); setError("");
    try { await hrApi.sendEmployeeLetter(letterForm); setLetterOpen(false); setMessage("Letter sent successfully to employee email."); } catch (e) { setError(e.message); } finally { setSendingLetter(false); }
  };

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
      <div style={{marginTop:18,padding:16,border:"1px solid #dbe5f0",borderRadius:12,background:"#f8fbff"}}>
        <h3 style={{margin:"0 0 6px",fontSize:16}}>State-wise Payroll Rules</h3>
        <p style={S.help}>Employee create/edit screen-er State select korlei oi State-er rule automatically apply hobe. State-er alada rule na thakle Common Rules use hobe.</p>
        <div style={{...S.grid, marginTop:12}}>
          <SelectField label="Rule State" name="ruleState" value={stateRuleState} onChange={e=>selectStateRule(e.target.value)} options={options.states || []}/>
          {[['Basic %','basicPercent'],['HRA %','hraPercent'],['DA %','daPercent'],['Conveyance %','conveyancePercent'],['Other Allowance %','otherAllowancePercent'],['Gratuity %','gratuityPercent'],['Employee PF %','pfPercent'],['Employee ESI %','esiPercent'],['Employer PF %','employerPfPercent'],['Employer ESI %','employerEsiPercent']].map(([label,name]) => <Field key={name} label={label} name={name} type="number" value={stateRuleDraft[name] ?? ""} onChange={updateStateRule}/>)}
          {[['HRA Base','hraBase'],['DA Base','daBase'],['Conveyance Base','conveyanceBase'],['Other Allowance Base','otherAllowanceBase'],['Gratuity Base','gratuityBase'],['PF Base','pfBase'],['ESI Base','esiBase']].map(([label,name]) => <Field key={name} label={label} name={name} value={stateRuleDraft[name] ?? ""} onChange={updateStateRule}><select name={name} value={stateRuleDraft[name] ?? ""} onChange={updateStateRule} style={S.input}><option value="gross">Gross Salary</option><option value="basic">Basic Salary</option><option value="basicDa">Basic + DA</option></select></Field>)}
          <Field label="PF Maximum Wage" name="pfWageCeiling" type="number" value={stateRuleDraft.pfWageCeiling ?? ""} onChange={updateStateRule}/>
          <Field label="ESI Wage Ceiling" name="esiWageCeiling" type="number" value={stateRuleDraft.esiWageCeiling ?? ""} onChange={updateStateRule}/>
          <CheckField label="PF Ceiling Apply" name="pfCeilingEnabled" checked={!!stateRuleDraft.pfCeilingEnabled} onChange={updateStateRule}/>
          <CheckField label="ESI Ceiling Apply" name="esiCeilingEnabled" checked={!!stateRuleDraft.esiCeilingEnabled} onChange={updateStateRule}/>
        </div>
        <div style={S.actions}><button type="button" onClick={applyStateRule} disabled={!stateRuleState} style={S.smallBtn}>Apply State Rule</button><button type="button" onClick={clearStateRule} disabled={!stateRuleState} style={S.cancel}>Use Common Rules</button></div>
      </div>
    </section>

    <form onSubmit={save} style={S.card}>
      <Section title="Personal & Company Details">
        <Field label="Employee ID" name="employeeCode" value={form.employeeCode} onChange={update}/><SelectField label="Work Location State" name="state" value={form.state} onChange={update} options={options.states || []} required/><Field label="PIN Code" name="pinCode" value={form.pinCode} onChange={update}/>
        <Field label="Company Name" name="companyName" value={form.companyName} onChange={update} required><select name="companyName" value={form.companyName} onChange={update} required style={S.input}><option value="">Select Company</option>{options.companies.map(x => <option key={x}>{x}</option>)}</select></Field>
        <div style={S.inlineAction}><button type="button" onClick={() => setShowCompany(v => !v)} style={S.smallBtn}>+ Add Company</button>{showCompany && <div style={S.addRow}><input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="New company name" style={S.input}/><button type="button" onClick={addCompany} style={S.smallBtn}>Save</button></div>}</div>
        <Field label="Employee Name" name="name" value={form.name} onChange={update} required/><Field label="Father / Husband Name" name="fatherName" value={form.fatherName} onChange={update}/><Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update}/><SelectField label="Gender" name="gender" value={form.gender} onChange={update} options={["Male","Female","Other"]}/><Field label="Mobile No." name="mobile" value={form.mobile} onChange={update}/><Field label="Email" name="email" type="email" value={form.email} onChange={update}/><Field label="Joining Date" name="joiningDate" type="date" value={form.joiningDate} onChange={update} required/>
        <SelectField label="Department" name="department" value={form.department} onChange={update} options={options.departmentOptions}/><SelectField label="Designation" name="designation" value={form.designation} onChange={update} options={options.designationOptions}/><Field label="Work Location" name="workLocation" value={form.workLocation} onChange={update} required/><SelectField label="Employee Type" name="employeeType" value={form.employeeType} onChange={update} options={options.employeeTypeOptions}/><label style={S.label}><span>Staff Shift</span><select name="shiftId" value={form.shiftId || ""} onChange={update} style={S.input}><option value="">Select Shift</option>{shifts.map(x => <option key={x._id} value={x._id}>{x.name} ({x.startTime} - {x.endTime})</option>)}</select></label>
        <label style={{ ...S.label, gridColumn: "1 / -1" }}><span>Address</span><textarea name="address" value={form.address} onChange={update} style={{ ...S.input, minHeight: 70 }}/></label>
      </Section>

      <Section title="Salary, Deductions, Gratuity & CTC">
        <div style={{...S.summary, gridColumn:"1 / -1", background:"#f7f9fc"}}><span>Payroll Rule Applied</span><b>{form.state ? (options.settings?.stateRules?.[form.state] ? `State Rule – ${form.state}` : `Common Rule – ${form.state}`) : "Select Work Location State"}</b></div>
        <MoneyField label="Gross Salary" name="grossSalary" value={form.grossSalary} onChange={update} required/>
        <MoneyField label={`Basic (${calcRates.basicPercent}%)`} name="basicSalary" value={calculated.basic} onChange={()=>{}} readOnly/>
        <MoneyField label={`HRA (${calcRates.hraPercent}%)`} name="hra" value={calculated.hra} onChange={()=>{}} readOnly/>
        <MoneyField label={`DA (${calcRates.daPercent}%)`} name="da" value={calculated.da} onChange={()=>{}} readOnly/>
        <MoneyField label={`Conveyance (${calcRates.conveyancePercent}%)`} name="conveyance" value={calculated.conveyance} onChange={()=>{}} readOnly/>
        <MoneyField label={`Other Allowance (${calcRates.otherAllowancePercent}%)`} name="otherAllowance" value={calculated.otherAllowance} onChange={()=>{}} readOnly/>
        <MoneyField label={`Employee PF (${calcRates.pfPercent}%)`} name="pfAmount" value={calculated.pf} onChange={()=>{}} readOnly/>
        <MoneyField label={`Employee ESI (${calcRates.esiPercent}%)`} name="esiAmount" value={calculated.esi} onChange={()=>{}} readOnly/>
        <MoneyField label="Professional Tax (Auto by State)" name="professionalTax" value={calculated.pt} onChange={()=>{}} readOnly/>
        <MoneyField label="Other Employee Deduction (Manual)" name="otherDeduction" value={form.otherDeduction} onChange={update}/>
        <MoneyField label={`Employer PF (${calcRates.employerPfPercent}%)`} name="employerPfAmount" value={calculated.employerPf} onChange={()=>{}} readOnly/>
        <MoneyField label={`Employer ESI (${calcRates.employerEsiPercent}%)`} name="employerEsiAmount" value={calculated.employerEsi} onChange={()=>{}} readOnly/>
        <MoneyField label={`Gratuity (${calcRates.gratuityPercent}% of ${calcRates.gratuityBase === "gross" ? "Gross" : calcRates.gratuityBase === "basicDa" ? "Basic + DA" : "Basic"})`} name="gratuityAmount" value={calculated.gratuity} onChange={()=>{}} readOnly/>
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

    <section style={S.employeeCard}>
      <div style={S.employeeHead}>
        <div><h2 style={S.employeeTitle}>Employee Directory <span>{rows.length}</span></h2><p style={S.help}>Manage status, assign work and issue HR letters directly from this screen.</p></div>
        <div style={S.toolbar}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employee, ID, department..." style={S.search}/>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={S.filter}><option>All</option><option>Active</option><option>Inactive</option></select>
        </div>
      </div>
      <div style={S.bulkBar}>
        <label style={S.selectAll}><input type="checkbox" checked={visibleRows.length>0 && visibleRows.every(x=>selectedIds.includes(x._id))} onChange={selectAllVisible}/> Select visible ({visibleRows.length})</label>
        <span style={S.selectedCount}>{selectedIds.length} selected</span>
        <button type="button" onClick={openTask} disabled={!selectedIds.length} style={S.actionBtn}>Assign Task</button>
        <button type="button" onClick={()=>openLetter()} disabled={selectedIds.length !== 1} style={S.actionBtn}>Issue Letter</button>
        <button type="button" onClick={()=>setSelectedIds([])} style={S.lightBtn}>Clear</button>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={S.employeeTable}><thead><tr><th></th><th>Employee</th><th>Company</th><th>Department</th><th>Designation</th><th>Gross</th><th>PF</th><th>ESI</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{visibleRows.map(e => <tr key={e._id}>
          <td><input type="checkbox" checked={selectedIds.includes(e._id)} onChange={()=>toggleSelected(e._id)}/></td>
          <td><div style={S.empName}>{e.name}</div><div style={S.empMeta}>{e.employeeCode} {e.email ? `• ${e.email}` : ""}</div></td>
          <td>{e.companyName || "-"}</td><td>{e.department || "-"}</td><td>{e.designation || "-"}</td>
          <td><b>₹{Number(e.grossSalary || 0).toLocaleString("en-IN")}</b></td>
          <td>{e.pfApplicable ? `₹${Number(e.pfAmount || 0).toLocaleString("en-IN")}` : <span style={S.noBadge}>No</span>}</td>
          <td>{e.esiApplicable ? `₹${Number(e.esiAmount || 0).toLocaleString("en-IN")}` : <span style={S.noBadge}>No</span>}</td>
          <td><button type="button" onClick={()=>changeEmployeeStatus(e)} style={e.status === "Inactive" ? S.statusInactive : S.statusActive}>{e.status || "Active"}</button></td>
          <td><div style={S.rowActions}><button type="button" onClick={()=>startEdit(e)} style={S.editBtn}>Edit</button><button type="button" onClick={()=>{setSelectedIds([e._id]);openTask()}} style={S.iconBtn}>Task</button><button type="button" onClick={()=>openLetter(e._id)} style={S.iconBtn}>Letter</button></div></td>
        </tr>)}{!visibleRows.length && <tr><td colSpan="10" style={S.empty}>No employees match your search/filter.</td></tr>}</tbody></table>
      </div>
    </section>

    {taskOpen && <div style={S.overlay}><div style={S.modal}><div style={S.modalHead}><div><h2 style={S.modalTitle}>Assign Work / Task</h2><p style={S.help}>{selectedIds.length} employee(s) selected</p></div><button onClick={()=>setTaskOpen(false)} style={S.close}>×</button></div><div style={S.grid}><Field label="Task Title" name="title" value={taskForm.title} onChange={e=>setTaskForm(p=>({...p,title:e.target.value}))} required/><Field label="Priority" name="priority" value={taskForm.priority} onChange={e=>setTaskForm(p=>({...p,priority:e.target.value}))}><select style={S.input} value={taskForm.priority} onChange={e=>setTaskForm(p=>({...p,priority:e.target.value}))}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></Field><Field label="Due Date" name="dueDate" type="date" value={taskForm.dueDate} onChange={e=>setTaskForm(p=>({...p,dueDate:e.target.value}))}/><label style={{...S.label,gridColumn:"1 / -1"}}><span>Description / Instructions</span><textarea value={taskForm.description} onChange={e=>setTaskForm(p=>({...p,description:e.target.value}))} style={{...S.input,minHeight:110}} placeholder="What work should the employee complete?"/></label></div><div style={S.actions}><button onClick={saveTask} style={S.btn}>Assign Task</button><button onClick={()=>setTaskOpen(false)} style={S.cancel}>Cancel</button></div></div></div>}

    {letterOpen && <div style={S.overlay}><div style={{...S.modal,maxWidth:1000}}><div style={S.modalHead}><div><h2 style={S.modalTitle}>HR Letter Centre</h2><p style={S.help}>Professional letter + direct email to employee</p></div><button onClick={()=>setLetterOpen(false)} style={S.close}>×</button></div><div style={S.letterGrid}><div><Field label="Letter Type" name="type" value={letterForm.type} onChange={e=>loadLetterTemplate(e.target.value)}><select style={S.input} value={letterForm.type} onChange={e=>loadLetterTemplate(e.target.value)}>{letterTypes.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Subject" name="subject" value={letterForm.subject} onChange={e=>setLetterForm(p=>({...p,subject:e.target.value}))}/><label style={S.label}><span>Letter Body</span><textarea value={letterForm.body} onChange={e=>setLetterForm(p=>({...p,body:e.target.value}))} style={{...S.input,minHeight:360}}/></label></div><div><div style={S.previewLabel}>Live Preview</div><div style={S.previewBox} dangerouslySetInnerHTML={{__html:letterPreview || "<div style='color:#667085;padding:20px'>Select a letter type to load the professional format.</div>"}}/></div></div><div style={S.actions}><button onClick={async()=>{const r=await hrApi.previewEmployeeLetter(letterForm);setLetterPreview(r.html||"")}} style={S.lightBtn}>Refresh Preview</button><button onClick={sendLetter} disabled={sendingLetter} style={S.btn}>{sendingLetter ? "Sending..." : "Send Direct Email"}</button><button onClick={()=>setLetterOpen(false)} style={S.cancel}>Close</button></div></div></div>}
  </main>;
}

const S = { page:{padding:24,background:"linear-gradient(180deg,#f5f8fc 0%,#eef3f9 100%)",minHeight:"100vh",fontFamily:"Arial,sans-serif",color:"#172033"},header:{display:"flex",justifyContent:"space-between",alignItems:"center"},h1:{margin:0,fontSize:28},sub:{color:"#667085",marginTop:6},card:{background:"#fff",padding:22,borderRadius:18,marginTop:18,boxShadow:"0 8px 24px rgba(15,23,42,.06)"},section:{paddingBottom:20,marginBottom:22,borderBottom:"1px solid #e8edf4"},sectionTitle:{margin:"0 0 16px",fontSize:18},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12},label:{display:"flex",flexDirection:"column",gap:6,fontSize:13,fontWeight:700},input:{width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #d9e1ec",borderRadius:9,background:"#fff",fontSize:14},check:{display:"flex",alignItems:"center",gap:8,padding:12,border:"1px solid #e5eaf1",borderRadius:9,fontSize:14},summary:{padding:12,borderRadius:9,background:"#f0f6ff",display:"flex",justifyContent:"space-between",alignItems:"center"},actions:{display:"flex",gap:10,marginTop:8,alignItems:"center",flexWrap:"wrap"},btn:{padding:"12px 20px",background:"#1d4f91",color:"#fff",border:0,borderRadius:10,fontWeight:700,cursor:"pointer"},cancel:{padding:"12px 20px",background:"#fff",color:"#344054",border:"1px solid #d0d5dd",borderRadius:10,fontWeight:700},smallBtn:{padding:"9px 12px",background:"#475569",color:"#fff",border:0,borderRadius:8,fontWeight:700,cursor:"pointer"},inlineAction:{display:"flex",flexDirection:"column",gap:8,justifyContent:"end"},addRow:{display:"flex",gap:6},rateHeader:{display:"flex",justifyContent:"space-between",gap:15,alignItems:"center",marginBottom:12},help:{color:"#667085",fontSize:13,margin:0},error:{background:"#fee4e2",color:"#b42318",padding:12,borderRadius:10,marginTop:16},success:{background:"#ecfdf3",color:"#027a48",padding:12,borderRadius:10,marginTop:16},warning:{color:"#b54708",fontWeight:700},table:{width:"100%",borderCollapse:"collapse",fontSize:13},empty:{textAlign:"center",padding:24,color:"#667085"},employeeCard:{background:"#fff",padding:0,borderRadius:18,marginTop:18,boxShadow:"0 10px 30px rgba(15,23,42,.08)",overflow:"hidden"},employeeHead:{padding:"22px 24px",display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",flexWrap:"wrap"},employeeTitle:{margin:0,fontSize:20,fontWeight:800},employeeTitleSpan:{background:"#eaf2ff",color:"#1d4f91"},toolbar:{display:"flex",gap:10,alignItems:"center"},search:{minWidth:280,padding:"11px 13px",border:"1px solid #d7e0eb",borderRadius:10},filter:{padding:"11px 13px",border:"1px solid #d7e0eb",borderRadius:10,background:"#fff"},bulkBar:{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",padding:"12px 24px",background:"#f7faff",borderTop:"1px solid #edf1f6",borderBottom:"1px solid #e4eaf2"},selectAll:{display:"flex",gap:8,alignItems:"center",fontWeight:700,fontSize:13},selectedCount:{fontSize:13,color:"#667085",marginRight:"auto"},actionBtn:{padding:"9px 13px",border:0,borderRadius:9,background:"#1d4f91",color:"#fff",fontWeight:700,cursor:"pointer"},lightBtn:{padding:"9px 13px",border:"1px solid #d0d7e2",borderRadius:9,background:"#fff",color:"#344054",fontWeight:700,cursor:"pointer"},employeeTable:{width:"100%",borderCollapse:"separate",borderSpacing:0,fontSize:13},empName:{fontWeight:800,color:"#162033"},empMeta:{fontSize:11,color:"#7b8797",marginTop:3},noBadge:{padding:"3px 7px",borderRadius:20,background:"#f2f4f7",color:"#667085",fontSize:11},statusActive:{border:0,padding:"6px 10px",borderRadius:20,background:"#dcfae8",color:"#087443",fontWeight:800,cursor:"pointer"},statusInactive:{border:0,padding:"6px 10px",borderRadius:20,background:"#fee4e2",color:"#b42318",fontWeight:800,cursor:"pointer"},editBtn:{padding:"7px 10px",border:0,borderRadius:8,background:"#475569",color:"#fff",fontWeight:700,cursor:"pointer"},iconBtn:{padding:"7px 9px",border:"1px solid #d5dce6",borderRadius:8,background:"#fff",color:"#344054",fontWeight:700,cursor:"pointer"},rowActions:{display:"flex",gap:6,flexWrap:"wrap"},overlay:{position:"fixed",inset:0,background:"rgba(15,23,42,.52)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000},modal:{width:"100%",maxWidth:760,maxHeight:"92vh",overflow:"auto",background:"#fff",borderRadius:18,boxShadow:"0 30px 70px rgba(0,0,0,.2)",padding:24},modalHead:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20},modalTitle:{margin:0,fontSize:22},close:{border:0,background:"#f2f4f7",borderRadius:9,width:34,height:34,fontSize:24,cursor:"pointer"},letterGrid:{display:"grid",gridTemplateColumns:"minmax(300px,1fr) minmax(300px,1fr)",gap:18},previewLabel:{fontWeight:800,fontSize:13,marginBottom:8},previewBox:{minHeight:430,maxHeight:520,overflow:"auto",border:"1px solid #dfe5ee",borderRadius:12,background:"#f7f9fc",padding:8}};
