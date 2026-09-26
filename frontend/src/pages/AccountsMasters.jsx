import React, { useEffect, useMemo, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const token = () => localStorage.getItem("token") || localStorage.getItem("accessToken") || "";

const GST_STATE_CODES = {
  "Andhra Pradesh":"37","Arunachal Pradesh":"12","Assam":"18","Bihar":"10","Chhattisgarh":"22","Goa":"30","Gujarat":"24","Haryana":"06","Himachal Pradesh":"02","Jharkhand":"20","Karnataka":"29","Kerala":"32","Madhya Pradesh":"23","Maharashtra":"27","Manipur":"14","Meghalaya":"17","Mizoram":"15","Nagaland":"13","Odisha":"21","Punjab":"03","Rajasthan":"08","Sikkim":"11","Tamil Nadu":"33","Telangana":"36","Tripura":"16","Uttar Pradesh":"09","Uttarakhand":"05","West Bengal":"19","Andaman and Nicobar Islands":"35","Chandigarh":"04","Dadra and Nagar Haveli and Daman and Diu":"26","Delhi":"07","Jammu and Kashmir":"01","Ladakh":"38","Lakshadweep":"31","Puducherry":"34"
};

const GROUPS = [
  "Capital Account",
  "Current Assets",
  "Current Liabilities",
  "Fixed Assets",
  "Investments",
  "Loans (Liability)",
  "Sundry Debtors",
  "Sundry Creditors",
  "Cash-in-Hand",
  "Bank Accounts",
  "Direct Income",
  "Direct Expenses",
  "Indirect Income",
  "Indirect Expenses",
  "Duties & Taxes",
  "Stock-in-Hand",
];

const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
  "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const blank = {
  ledger: {
    name:"", alias:"", under:"Sundry Debtors", openingBalance:"", openingType:"Dr",
    gstApplicable:false, gstin:"", pan:"", address:"", state:"", pin:"",
    mobile:"", email:"", creditLimit:"", creditDays:"", locationId:"", masterType:"LEDGER"
  },
  group: { name:"", under:"", nature:"Liability", masterType:"GROUP" },
  party: {
    name:"", partyType:"Customer", ledgerId:"", gstin:"", pan:"", address:"",
    state:"", pin:"", mobile:"", email:"", creditLimit:"", creditDays:"",
    locationId:"", masterType:"PARTY"
  },
  supplier: {
    name:"", partyType:"Supplier", ledgerId:"", gstin:"", pan:"", address:"",
    state:"", pin:"", mobile:"", email:"", creditLimit:"", creditDays:"",
    locationId:"", masterType:"SUPPLIER"
  },
  product: {
    name:"", code:"", itemType:"FINISHED_GOODS", hsn:"", unit:"KG",
    gstRate:"", purchaseRate:"", salesRate:"", openingQty:"", openingValue:"",
    stockLedgerId:"", under:"Stock-in-Hand", locationId:"", masterType:"PRODUCT"
  },
  location: {
    name:"", code:"", state:"West Bengal", district:"", pin:"", address:"",
    gstStateCode:"", masterType:"LOCATION"
  }
};

export default function AccountsMasters() {
  const [type, setType] = useState("ledger");
  const [mode, setMode] = useState("list");
  const [rows, setRows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [locations, setLocations] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({...blank.ledger});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const headers = () => ({
    "Content-Type":"application/json",
    Authorization:`Bearer ${token()}`
  });

  async function load() {
    try {
      const r = await fetch(`${API_URL}/api/accounts/masters?type=${type}`, {headers:headers()});
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Master load failed");
      setRows(d.rows || []);
      if (d.groups) setGroups(d.groups);
      if (d.locations) setLocations(d.locations);
      if (d.ledgers) setLedgers(d.ledgers);
    } catch (e) { setError(e.message); }
  }

  async function loadLookups() {
    try {
      const r = await fetch(`${API_URL}/api/accounts/masters/lookups`, {headers:headers()});
      const d = await r.json();
      if (r.ok) {
        setGroups(d.groups || []);
        setLocations(d.locations || []);
        setLedgers(d.ledgers || []);
      }
    } catch {}
  }

  useEffect(() => { load(); loadLookups(); }, [type]);

  const filtered = useMemo(() => rows.filter(x =>
    `${x.name||""} ${x.code||""} ${x.gstin||""} ${x.state||""} ${x.under||""}`
      .toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  function openCreate(nextType = type) {
    setType(nextType);
    setMode("form");
    setEditing(null);
    setForm({...blank[nextType]});
    setSearch("");
    setMessage("");
    setError("");
  }

  function edit(row) {
    setMode("form");
    setEditing(row);
    setForm({...blank[type], ...row});
    setMessage("");
    setError("");
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        openCreate(type);
        return;
      }
      const map = { F4:"group", F5:"ledger", F6:"party", F7:"supplier", F8:"product", F9:"location" };
      if (map[e.key]) {
        e.preventDefault();
        const nextType = map[e.key];
        setType(nextType); setMode("list"); setEditing(null); setForm({...blank[nextType]}); setError(""); setMessage("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [type]);

  function update(key, value) {
    setForm(f => {
      const next = {...f, [key]:value};
      if (type === "location" && key === "state") next.gstStateCode = GST_STATE_CODES[value] || "";
      return next;
    });
  }

  async function save() {
    if (!String(form.name || "").trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const url = `${API_URL}/api/accounts/masters/${editing?._id || ""}`;
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: headers(),
        body: JSON.stringify({...form, masterType:type.toUpperCase()})
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Save failed");
      setMessage("Master saved successfully.");
      setEditing(null);
      setMode("list");
      await load();
      await loadLookups();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function remove(row) {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try {
      const r = await fetch(`${API_URL}/api/accounts/masters/${row._id}`, {
        method:"DELETE", headers:headers()
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Delete failed");
      await load();
      await loadLookups();
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    const key = e => {
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const el = document.querySelector(".accounts-master-page input:not([disabled]), .accounts-master-page select:not([disabled]), .accounts-master-page textarea:not([disabled])");
        el?.focus();
      }
      if (e.key === "Escape" && document.activeElement?.matches("input,select,textarea")) {
        document.activeElement.blur();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const title = {
    ledger:"Ledger",
    group:"Group",
    party:"Party / Customer",
    supplier:"Supplier",
    product:"Product / Stock Item",
    location:"Location / Godown"
  }[type];

  return (
    <div className="accounts-master-page">
      <style>{`
        .accounts-master-page{min-height:100vh;background:#f5f7fb;color:#172b4d;font-family:Arial,sans-serif}
        .am-head{background:#fff;border-bottom:1px solid #e4e7ec;padding:18px 20px;position:sticky;top:0;z-index:10}
        .am-head-row{display:flex;justify-content:space-between;align-items:center;gap:12px}
        .am-title{display:flex;align-items:center;gap:12px}.am-logo{width:42px;height:42px;border-radius:10px;background:#245a96;color:#fff;display:grid;place-items:center;font-weight:800}
        h1{font-size:21px;margin:0}.sub{font-size:11px;color:#667085;margin-top:4px}
        .shortcuts{margin-top:12px;display:flex;gap:7px;flex-wrap:wrap}.kbd{font-size:10px;color:#667085}.kbd b{background:#fff;border:1px solid #d0d5dd;border-bottom-width:2px;border-radius:5px;padding:4px 7px;color:#344054;margin-right:4px}
        .am-tabs{display:flex;gap:7px;overflow:auto;padding:10px 20px;background:#f8fafc;border-bottom:1px solid #e4e7ec}
        .am-tabs button{white-space:nowrap;border:1px solid #dfe4ea;background:#fff;border-radius:8px;padding:9px 12px;font-weight:700;color:#475467;cursor:pointer}
        .am-tabs button.active{background:#245a96;color:#fff;border-color:#245a96}
        .am-body{max-width:1500px;margin:auto;padding:18px 20px}.toolbar{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-bottom:12px}
        input,select,textarea{width:100%;border:1px solid #d0d5dd;border-radius:7px;padding:9px 10px;font:inherit;background:#fff}
        textarea{min-height:72px;resize:vertical}.search{max-width:360px}.btn{border:1px solid #d0d5dd;background:#fff;border-radius:7px;padding:9px 13px;font-weight:700;cursor:pointer}.primary{background:#245a96;color:#fff;border-color:#245a96}
        .danger{color:#b42318}.card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden}.row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:13px 15px;border-bottom:1px solid #eef0f3}.row:last-child{border-bottom:0}.row small{display:block;color:#667085;margin-top:4px;font-size:10px}.actions{display:flex;gap:6px}.actions button{border:1px solid #d0d5dd;background:#fff;border-radius:6px;padding:6px 9px;cursor:pointer;font-size:11px}
        .form-card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:18px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.field label{display:block;font-size:11px;font-weight:800;color:#344054;margin-bottom:5px}.full{grid-column:1/-1}.check{display:flex;gap:8px;align-items:center}.check input{width:auto}
        .form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.msg{padding:10px;border-radius:7px;margin-bottom:10px;background:#ecfdf3;color:#027a48}.err{padding:10px;border-radius:7px;margin-bottom:10px;background:#fef3f2;color:#b42318}
        .empty{padding:35px;text-align:center;color:#667085}.hint{font-size:10px;color:#667085;margin-top:4px}
        @media(max-width:800px){.grid{grid-template-columns:1fr 1fr}} @media(max-width:560px){.grid{grid-template-columns:1fr}.am-body{padding:12px 10px}.am-head{padding:12px 10px}.am-tabs{padding:8px 10px}.toolbar{align-items:stretch;flex-direction:column}.search{max-width:none}.row{grid-template-columns:1fr}}
      `}</style>

      <header className="am-head">
        <div className="am-head-row">
          <div className="am-title"><div className="am-logo">₹</div><div><h1>Accounts Masters</h1><div className="sub">Group, Ledger, Party, Supplier, Product & Location — same master form</div></div></div>
          <button className="btn primary" onClick={()=>openCreate(type)}>+ Create {title}</button>
        </div>
        <div className="shortcuts">
          <span className="kbd"><b>Alt+C</b>Create current master</span>
          <span className="kbd"><b>F4–F9</b>Switch master</span>
          <span className="kbd"><b>Enter</b>Next field</span>
          <span className="kbd"><b>Esc</b>Clear focus</span>
        </div>
      </header>

      <nav className="am-tabs">
        {[
          ["group","Group","F4"],
          ["ledger","Ledger","F5"],
          ["party","Party","F6"],
          ["supplier","Supplier","F7"],
          ["product","Product","F8"],
          ["location","Location","F9"]
        ].map(([id,label,key]) =>
          <button key={id} className={type===id ? "active":""} onClick={()=>{setType(id);setMode("list");setEditing(null);setForm({...blank[id]});setError("");setMessage("");}}>
            {label} <span style={{fontSize:10,opacity:.7,marginLeft:4}}>{key}</span>
          </button>
        )}
      </nav>

      <main className="am-body">
        {message && <div className="msg">{message}</div>}
        {error && <div className="err">{error}</div>}

        {mode === "list" ? (
          <>
            <div className="toolbar">
              <div><b>{title} Master</b><div className="hint">Create, edit and search records.</div></div>
              <input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${title}...`} />
            </div>
            <div className="card">
              {filtered.length === 0 ? <div className="empty">No records found. Click + Create.</div> :
                filtered.map(row =>
                  <div className="row" key={row._id}>
                    <div>
                      <b>{row.name}</b>
                      <small>
                        {type==="ledger" && <>Under: {row.under || "-"} · {row.openingType || ""} {row.openingBalance || 0} · {row.state || ""}</>}
                        {type==="group" && <>Under: {row.under || "Primary"} · Nature: {row.nature || "-"}</>}
                        {(type==="party" || type==="supplier") && <>GSTIN: {row.gstin || "Not set"} · {row.state || ""} · {row.locationName || ""}</>}
                        {type==="product" && <>Code: {row.code || "-"} · HSN: {row.hsn || "-"} · Unit: {row.unit || "-"} · GST: {row.gstRate || 0}%</>}
                        {type==="location" && <>Code: {row.code || "-"} · {row.district || ""} · {row.state || ""} · PIN {row.pin || ""}</>}
                      </small>
                    </div>
                    <div className="actions"><button onClick={()=>edit(row)}>Edit</button><button className="danger" onClick={()=>remove(row)}>Delete</button></div>
                  </div>
                )
              }
            </div>
          </>
        ) : null}

        {mode === "form" && (
          <div className="form-card">
            <div className="toolbar"><div><b>{editing ? "Edit" : "Create"} {title}</b><div className="hint">Fields marked * are required.</div></div><button className="btn" onClick={()=>setMode("list")}>Back</button></div>

            <div className="grid">
              <div className="field"><label>Name *</label><input autoFocus value={form.name||""} onChange={e=>update("name",e.target.value)} /></div>

              {type==="ledger" && <>
                <div className="field"><label>Alias</label><input value={form.alias||""} onChange={e=>update("alias",e.target.value)} /></div>
                <div className="field"><label>Under *</label><select value={form.under||"Sundry Debtors"} onChange={e=>update("under",e.target.value)}>{GROUPS.map(x=><option key={x}>{x}</option>)}</select></div>
                <div className="field"><label>Opening Balance</label><input type="number" value={form.openingBalance||""} onChange={e=>update("openingBalance",e.target.value)} /></div>
                <div className="field"><label>Dr / Cr</label><select value={form.openingType||"Dr"} onChange={e=>update("openingType",e.target.value)}><option>Dr</option><option>Cr</option></select></div>
                <div className="field"><label>Location</label><select value={form.locationId||""} onChange={e=>update("locationId",e.target.value)}><option value="">Select Location</option>{locations.map(x=><option value={x._id} key={x._id}>{x.name}</option>)}</select></div>
                <div className="field check"><input type="checkbox" checked={!!form.gstApplicable} onChange={e=>update("gstApplicable",e.target.checked)}/><label>GST Applicable</label></div>
                <div className="field"><label>GSTIN</label><input maxLength="15" value={form.gstin||""} onChange={e=>update("gstin",e.target.value.toUpperCase())}/></div>
                <div className="field"><label>PAN</label><input maxLength="10" value={form.pan||""} onChange={e=>update("pan",e.target.value.toUpperCase())}/></div>
                <div className="field"><label>State</label><select value={form.state||""} onChange={e=>update("state",e.target.value)}><option value="">Select State</option>{STATES.map(x=><option key={x}>{x}</option>)}</select></div>
                <div className="field"><label>PIN</label><input maxLength="6" value={form.pin||""} onChange={e=>update("pin",e.target.value.replace(/\D/g,"").slice(0,6))}/></div>
                <div className="field"><label>Mobile</label><input value={form.mobile||""} onChange={e=>update("mobile",e.target.value)}/></div>
                <div className="field"><label>Email</label><input type="email" value={form.email||""} onChange={e=>update("email",e.target.value)}/></div>
                <div className="field"><label>Credit Limit</label><input type="number" value={form.creditLimit||""} onChange={e=>update("creditLimit",e.target.value)}/></div>
                <div className="field"><label>Credit Days</label><input type="number" value={form.creditDays||""} onChange={e=>update("creditDays",e.target.value)}/></div>
                <div className="field full"><label>Address</label><textarea value={form.address||""} onChange={e=>update("address",e.target.value)}/></div>
              </>}

              {type==="group" && <>
                <div className="field"><label>Under</label><select value={form.under||""} onChange={e=>update("under",e.target.value)}><option value="">Primary</option>{GROUPS.map(x=><option key={x}>{x}</option>)}</select></div>
                <div className="field"><label>Nature</label><select value={form.nature||"Liability"} onChange={e=>update("nature",e.target.value)}>{["Asset","Liability","Income","Expense"].map(x=><option key={x}>{x}</option>)}</select></div>
              </>}

              {(type==="party" || type==="supplier") && <>
                <div className="field"><label>Party Type</label><select value={form.partyType|| (type==="supplier"?"Supplier":"Customer")} onChange={e=>update("partyType",e.target.value)}><option>Customer</option><option>Supplier</option></select></div>
                <div className="field"><label>Ledger</label><select value={form.ledgerId||""} onChange={e=>update("ledgerId",e.target.value)}><option value="">Create/link ledger after save</option>{ledgers.map(x=><option value={x._id} key={x._id}>{x.name} — {x.under}</option>)}</select></div>
                <div className="field"><label>GSTIN</label><input maxLength="15" value={form.gstin||""} onChange={e=>update("gstin",e.target.value.toUpperCase())}/></div>
                <div className="field"><label>PAN</label><input maxLength="10" value={form.pan||""} onChange={e=>update("pan",e.target.value.toUpperCase())}/></div>
                <div className="field"><label>State</label><select value={form.state||""} onChange={e=>update("state",e.target.value)}><option value="">Select State</option>{STATES.map(x=><option key={x}>{x}</option>)}</select></div>
                <div className="field"><label>Location</label><select value={form.locationId||""} onChange={e=>update("locationId",e.target.value)}><option value="">Select Location</option>{locations.map(x=><option value={x._id} key={x._id}>{x.name}</option>)}</select></div>
                <div className="field"><label>PIN</label><input maxLength="6" value={form.pin||""} onChange={e=>update("pin",e.target.value.replace(/\D/g,"").slice(0,6))}/></div>
                <div className="field"><label>Mobile</label><input value={form.mobile||""} onChange={e=>update("mobile",e.target.value)}/></div>
                <div className="field"><label>Email</label><input value={form.email||""} onChange={e=>update("email",e.target.value)}/></div>
                <div className="field"><label>Credit Limit</label><input type="number" value={form.creditLimit||""} onChange={e=>update("creditLimit",e.target.value)}/></div>
                <div className="field"><label>Credit Days</label><input type="number" value={form.creditDays||""} onChange={e=>update("creditDays",e.target.value)}/></div>
                <div className="field full"><label>Address</label><textarea value={form.address||""} onChange={e=>update("address",e.target.value)}/></div>
              </>}

              {type==="product" && <>
                <div className="field"><label>Product Code</label><input value={form.code||""} placeholder="Auto / optional" onChange={e=>update("code",e.target.value)}/></div>
                <div className="field"><label>Item Type</label><select value={form.itemType||"FINISHED_GOODS"} onChange={e=>update("itemType",e.target.value)}><option>RAW_MATERIAL</option><option>FINISHED_GOODS</option><option>TRADING</option><option>SERVICE</option></select></div>
                <div className="field"><label>HSN</label><input value={form.hsn||""} onChange={e=>update("hsn",e.target.value)}/></div>
                <div className="field"><label>Unit</label><input value={form.unit||"KG"} onChange={e=>update("unit",e.target.value)}/></div>
                <div className="field"><label>GST %</label><input type="number" value={form.gstRate||""} onChange={e=>update("gstRate",e.target.value)}/></div>
                <div className="field"><label>Under / Stock Ledger</label><select value={form.under||"Stock-in-Hand"} onChange={e=>update("under",e.target.value)}><option>Stock-in-Hand</option>{groups.map(x=><option key={x}>{x}</option>)}</select></div>
                <div className="field"><label>Purchase Rate</label><input type="number" value={form.purchaseRate||""} onChange={e=>update("purchaseRate",e.target.value)}/></div>
                <div className="field"><label>Sales Rate</label><input type="number" value={form.salesRate||""} onChange={e=>update("salesRate",e.target.value)}/></div>
                <div className="field"><label>Opening Qty</label><input type="number" value={form.openingQty||""} onChange={e=>update("openingQty",e.target.value)}/></div>
                <div className="field"><label>Opening Value</label><input type="number" value={form.openingValue||""} onChange={e=>update("openingValue",e.target.value)}/></div>
                <div className="field"><label>Location</label><select value={form.locationId||""} onChange={e=>update("locationId",e.target.value)}><option value="">Select Location</option>{locations.map(x=><option value={x._id} key={x._id}>{x.name}</option>)}</select></div>
              </>}

              {type==="location" && <>
                <div className="field"><label>Location Code</label><input value={form.code||""} placeholder="Auto code" onChange={e=>update("code",e.target.value)}/></div>
                <div className="field"><label>State *</label><select value={form.state||""} onChange={e=>update("state",e.target.value)}><option value="">Select State</option>{STATES.map(x=><option key={x}>{x}</option>)}</select></div>
                <div className="field"><label>District</label><input value={form.district||""} onChange={e=>update("district",e.target.value)}/></div>
                <div className="field"><label>PIN</label><input maxLength="6" value={form.pin||""} onChange={e=>update("pin",e.target.value.replace(/\D/g,"").slice(0,6))}/></div>
                <div className="field full"><label>Address</label><textarea value={form.address||""} onChange={e=>update("address",e.target.value)}/></div>
                <div className="field"><label>GST State Code</label><input value={form.gstStateCode||""} onChange={e=>update("gstStateCode",e.target.value)}/></div>
              </>}
            </div>

            <div className="form-actions">
              <button className="btn" onClick={()=>setMode("list")}>Cancel</button>
              <button className="btn primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save Master"}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
