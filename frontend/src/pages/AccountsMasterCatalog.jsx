import React, { useEffect, useMemo, useRef, useState } from "react";

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
const asOptions = values => values.map(value => typeof value === "object" ? value : ({value,label:String(value)}));

const blank = {
  ledger: {
    name:"", alias:"", under:"Sundry Debtors", openingBalance:"", openingType:"Dr",
    gstApplicable:false, gstin:"", pan:"", address:"", state:"", pin:"",
    mobile:"", email:"", creditLimit:"", creditDays:"", locationId:"",
    bankDetailsProvided:false, bankAccountName:"", bankName:"", bankBranch:"", bankAccountNumber:"", bankIfsc:"", masterType:"LEDGER"
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
  },
  unit: {
    name:"", code:"", decimalPlaces:2, masterType:"UNIT", active:true
  }
};

function SearchableSelect({ value, options, onChange, placeholder="Select or type..." }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const selected = options.find(option => String(option.value) === String(value));
  const filtered = options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = event => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  function choose(option) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "ArrowDown" && open && filtered.length) {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp" && open && filtered.length) {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && query.trim()) {
      event.preventDefault();
      event.stopPropagation();
      if (filtered.length) choose(filtered[activeIndex] || filtered[0]);
    } else if (event.key === "Enter" && open) {
      setOpen(false);
    }
  }

  return (
    <div className="search-select" ref={rootRef}>
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        value={open ? query : selected?.label || ""}
        placeholder={placeholder}
        onFocus={() => { setQuery(""); setActiveIndex(0); setOpen(true); }}
        onChange={event => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <div className="search-select-options" role="listbox">
          {filtered.length ? filtered.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={String(option.value) === String(value)}
              className={index === activeIndex ? "is-highlighted" : ""}
              key={`${option.value}-${option.label}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option.label}
            </button>
          )) : <div className="search-select-empty">No matching options</div>}
        </div>
      )}
    </div>
  );
}

export default function AccountsMasterCatalog({ initialType = "ledger", initialMode = "list", initialEditId = "", onSaved }) {
  const [type, setType] = useState(initialType);
  const [mode, setMode] = useState(initialMode === "create" ? "form" : "list");
  const [rows, setRows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [locations, setLocations] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [units, setUnits] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({...blank[initialType] || blank.ledger});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pinLookup, setPinLookup] = useState("");
  const pinLookupRef = useRef(0);
  const [gstLookup, setGstLookup] = useState("");
  const gstLookupRef = useRef(0);

  useEffect(() => {
    if (initialType && initialType !== type && blank[initialType]) {
      setType(initialType);
      setMode("list");
      setEditing(null);
      setForm({...blank[initialType]});
      setSearch("");
      setError("");
      setMessage("");
    }
  }, [initialType]);

  const headers = () => ({
    "Content-Type":"application/json",
    Authorization:`Bearer ${token()}`
  });

  async function load() {
    try {
      const r = await fetch(`${API_URL}/api/accounts-masters?type=${type}`, {headers:headers()});
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Master load failed");
      setRows(d.data || d.masters || d.rows || []);
      
    } catch (e) { setError(e.message); }
  }

  async function loadLookups() {
    try {
      const [g, l, led, p, s] = await Promise.all([
        fetch(`${API_URL}/api/accounts-masters?type=group`, {headers:headers()}),
        fetch(`${API_URL}/api/accounts-masters?type=location`, {headers:headers()}),
        fetch(`${API_URL}/api/accounts-masters?type=ledger`, {headers:headers()}),
        fetch(`${API_URL}/api/accounts-masters?type=party`, {headers:headers()}),
        fetch(`${API_URL}/api/accounts-masters?type=supplier`, {headers:headers()})
      ]);
      const [gd, ld, ledD, pd, sd] = await Promise.all([g.json(), l.json(), led.json(), p.json(), s.json()]);
      if (g.ok) setGroups(gd.data || gd.masters || []);
      if (l.ok) setLocations(ld.data || ld.masters || []);
      if (led.ok) setLedgers(ledD.data || ledD.masters || []);
      const u = await fetch(`${API_URL}/api/accounts-masters?type=unit`, {headers:headers()});
      const ud = await u.json();
      if (u.ok) setUnits(ud.data || ud.masters || []);
    } catch (e) {
      console.warn('Accounts master lookups failed:', e);
    }
  }

  useEffect(() => { load(); loadLookups(); }, [type]);

  useEffect(() => {
    if (initialEditId && rows.length && mode === "list") {
      const found = rows.find(row => String(row._id) === String(initialEditId));
      if (found) edit(found);
    }
  }, [initialEditId, rows, mode]);

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
      if (e.key === "Enter" && mode === "form") {
        const el = document.activeElement;
        if (el?.matches("[data-save-master]")) {
          e.preventDefault();
          save();
          return;
        }
        if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
          const fields = Array.from(document.querySelectorAll(".accounts-master-page input:not([disabled]), .accounts-master-page select:not([disabled]), .accounts-master-page textarea:not([disabled])"));
          const index = fields.indexOf(el);
          if (index >= 0) {
            e.preventDefault();
            if (fields[index + 1]) fields[index + 1].focus();
            else document.querySelector("[data-save-master]")?.focus();
            return;
          }
        }
      }

      const map = { F4:"group", F5:"ledger", F8:"product", F9:"location", F10:"unit" };
      if (map[e.key]) {
        e.preventDefault();
        const nextType = map[e.key];
        setType(nextType); setMode("list"); setEditing(null); setForm({...blank[nextType]}); setError(""); setMessage("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [type, mode]);

  function update(key, value) {
    setForm(f => {
      const next = {...f, [key]:value};
      if (type === "location" && key === "state") next.gstStateCode = GST_STATE_CODES[value] || "";
      return next;
    });
  }

  useEffect(() => {
    const pin = String(form.pin || "");
    if (!(["location","ledger"].includes(type)) || !/^\d{6}$/.test(pin)) {
      setPinLookup("");
      return;
    }

    const lookupId = ++pinLookupRef.current;
    let cancelled = false;
    setPinLookup("Looking up PIN...");

    async function lookup() {
      try {
        const r = await fetch(`${API_URL}/api/inventory/masters/pincode/${pin}`, {headers:headers()});
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "PIN lookup failed.");
        if (cancelled || lookupId !== pinLookupRef.current) return;
        setForm(current => current.pin !== pin ? current : ({
          ...current,
          state:d.state || current.state,
          district:d.district || current.district,
          address:current.address || d.address || "",
          gstStateCode:GST_STATE_CODES[d.state] || current.gstStateCode,
        }));
        setPinLookup("State, district and address filled from PIN.");
      } catch (e) {
        if (!cancelled && lookupId === pinLookupRef.current) setPinLookup(e.message);
      }
    }

    lookup();
    return () => { cancelled = true; };
  }, [type, form.pin]);

  useEffect(() => {
    const gstin = String(form.gstin || "").trim().toUpperCase();
    if (type !== "ledger" || gstin.length !== 15) {
      setGstLookup("");
      return;
    }

    const lookupId = ++gstLookupRef.current;
    let cancelled = false;
    setGstLookup("Verifying GSTIN...");

    async function lookup() {
      try {
        const r = await fetch(`${API_URL}/api/inventory/masters/gstin/${gstin}`, {headers:headers()});
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "GSTIN lookup failed.");
        if (cancelled || lookupId !== gstLookupRef.current) return;
        setForm(current => current.gstin?.toUpperCase() !== gstin ? current : ({
          ...current,
          name:current.name || d.name || d.legalName || "",
          pan:current.pan || gstin.slice(2,12),
          state:current.state || d.state || "",
          district:current.district || d.district || "",
          pin:current.pin || d.pincode || "",
          address:current.address || d.address || "",
          mobile:current.mobile || d.phone || "",
          gstApplicable:true,
          gstStateCode:GST_STATE_CODES[d.state] || current.gstStateCode,
        }));
        setGstLookup(d.verified ? "GST details filled from verified registration." : (d.message || "GSTIN format checked; full registration details are unavailable."));
      } catch (e) {
        if (!cancelled && lookupId === gstLookupRef.current) setGstLookup(e.message);
      }
    }

    lookup();
    return () => { cancelled = true; };
  }, [type, form.gstin]);

  async function save() {
    if (!String(form.name || "").trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const url = `${API_URL}/api/accounts-masters/${editing?._id || ""}`;
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
      if (typeof onSaved === "function") onSaved(d.data || d.master || null);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function remove(row) {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try {
      const r = await fetch(`${API_URL}/api/accounts-masters/${row._id}`, {
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
    location:"Location / Godown",
    unit:"Unit"
  }[type];

  return (
    <div className="accounts-master-page">
      <style>{`
        .accounts-master-page{min-height:100vh;background:#f2f6f8;color:#152a3a;font-family:"Segoe UI",Arial,sans-serif}
        .am-head{background:#123c55;color:#fff;border-bottom:1px solid #0d3044;padding:18px 20px;position:sticky;top:0;z-index:10}
        .am-head-row{display:flex;justify-content:space-between;align-items:center;gap:12px}
        .am-title{display:flex;align-items:center;gap:12px}.am-logo{width:42px;height:42px;border-radius:3px;background:#f0b83f;color:#17364a;display:grid;place-items:center;font-weight:800}
        .am-title h1{font-size:21px;margin:0;color:#fff}.sub{font-size:11px;color:#c8d9e2;margin-top:4px}
        .shortcuts{margin-top:12px;display:flex;gap:7px;flex-wrap:wrap}.kbd{font-size:10px;color:#c8d9e2}.kbd b{background:#e5eff4;border:1px solid #cad8df;border-bottom-width:2px;border-radius:2px;padding:4px 7px;color:#17364a;margin-right:4px}
        .am-body{max-width:1500px;margin:auto;padding:18px 20px}.toolbar{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-bottom:12px}
        input,textarea{width:100%;border:1px solid #cbd8df;border-radius:3px;padding:9px 10px;font:inherit;background:#fff;color:#203c4e}input:focus,textarea:focus{outline:2px solid rgba(39,120,110,.18);border-color:#4d8c86}
        textarea{min-height:72px;resize:vertical}.search{max-width:360px}.btn{border:1px solid #cbd8df;background:#fff;border-radius:3px;padding:9px 13px;font-weight:700;cursor:pointer;color:#31586b}.btn:hover{border-color:#4d8c86;color:#246e67}.primary{background:#27786e;color:#fff;border-color:#27786e}.primary:hover{background:#1d655d;color:#fff}
        .danger{color:#b42318}.card{background:#fff;border:1px solid #d7e1e6;border-radius:2px;overflow:hidden}.row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:13px 15px;border-bottom:1px solid #edf1f3}.row:last-child{border-bottom:0}.row small{display:block;color:#71838e;margin-top:4px;font-size:10px}.actions{display:flex;gap:6px}.actions button{border:1px solid #cbd8df;background:#fff;border-radius:2px;padding:6px 9px;cursor:pointer;font-size:11px;color:#31586b}.actions button:hover{border-color:#4d8c86;color:#246e67}
        .form-card{background:#fff;border:1px solid #d7e1e6;border-radius:2px;padding:18px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.field-section{grid-column:1/-1;padding:4px 0 16px;border-bottom:1px solid #dfe7eb}.field-section:last-child{border-bottom:0;padding-bottom:0}.section-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.section-heading h3{margin:0;color:#1b3a4d;font-size:13px}.section-tag{font-size:11px;font-weight:700;color:#287168;background:#e9f5f1;border-radius:2px;padding:5px 8px}.section-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.field label{display:block;font-size:11px;font-weight:800;color:#526a77;margin-bottom:5px}.full{grid-column:1/-1}.check{display:flex;gap:8px;align-items:center}.check input{width:auto}
        .form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.msg{padding:10px;border-radius:2px;margin-bottom:10px;background:#e9f5f1;color:#287168;border-left:3px solid #27786e}.err{padding:10px;border-radius:2px;margin-bottom:10px;background:#fff0f0;color:#8d2828;border-left:3px solid #c34545}
        .empty{padding:35px;text-align:center;color:#82919a}.hint{font-size:10px;color:#71838e;margin-top:4px}.pin-lookup-error{color:#b42318}
        .search-select{position:relative}.search-select input{padding-right:30px}.search-select:after{content:"";position:absolute;right:12px;top:15px;width:7px;height:7px;border-right:1.5px solid #528096;border-bottom:1.5px solid #528096;transform:rotate(45deg);pointer-events:none}.search-select-options{position:absolute;top:calc(100% + 3px);left:0;right:0;z-index:30;max-height:220px;overflow:auto;background:#fff;border:1px solid #cbd8df;box-shadow:0 8px 20px rgba(18,60,85,.16)}.search-select-options button{display:block;width:100%;padding:9px 10px;border:0;border-bottom:1px solid #edf1f3;background:#fff;color:#2f4654;text-align:left;font:inherit;font-size:12px;cursor:pointer}.search-select-options button:hover,.search-select-options button.is-highlighted{background:#e5eff4;color:#17364a}.search-select-options button[aria-selected="true"]{color:#1d655d;font-weight:700}.search-select-empty{padding:10px;color:#82919a;font-size:11px}
        @media(max-width:800px){.grid,.section-grid{grid-template-columns:1fr 1fr}} @media(max-width:560px){.grid,.section-grid{grid-template-columns:1fr}.am-body{padding:12px 10px}.am-head{padding:12px 10px}.am-tabs{padding:8px 10px}.toolbar{align-items:stretch;flex-direction:column}.search{max-width:none}.row{grid-template-columns:1fr}.section-heading{align-items:flex-start;flex-direction:column}}
      `}</style>

      <header className="am-head">
        <div className="am-head-row">
          <div className="am-title"><div className="am-logo">₹</div><div><h1>Accounts Masters</h1><div className="sub">Ledgers, inventory items, units & locations</div></div></div>
          <button className="btn primary" onClick={()=>openCreate(type)}>+ Create {title}</button>
        </div>
        <div className="shortcuts">
          <span className="kbd"><b>Alt+C</b>Create current master</span>
          <span className="kbd"><b>F4–F5</b>Group / Ledger</span>
          <span className="kbd"><b>F8–F10</b>Product / Location / Unit</span>
          <span className="kbd"><b>Enter</b>Next field</span>
          <span className="kbd"><b>Esc</b>Clear focus</span>
        </div>
      </header>

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
                        {type==="unit" && <>Code: {row.code || "-"} · Decimal Places: {row.decimalPlaces ?? 2}</>}
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
              {type!=="ledger" && <div className="field"><label>Name *</label><input autoFocus value={form.name||""} onChange={e=>update("name",e.target.value)} /></div>}

              {type==="ledger" && <>
                <section className="field-section">
                  <div className="section-heading"><h3>Ledger Details</h3><span className="section-tag">{form.under==="Sundry Debtors"?"Customer Ledger":form.under==="Sundry Creditors"?"Supplier Ledger":"General Ledger"}</span></div>
                  <div className="section-grid">
                    <div className="field"><label>Name *</label><input autoFocus value={form.name||""} onChange={e=>update("name",e.target.value)} /></div>
                    <div className="field"><label>Alias</label><input value={form.alias||""} onChange={e=>update("alias",e.target.value)} /></div>
                    <div className="field"><label>Under *</label><SearchableSelect value={form.under||"Sundry Debtors"} options={asOptions(GROUPS)} onChange={value=>update("under",value)} placeholder="Search groups..." /></div>
                  </div>
                </section>
                <section className="field-section">
                  <div className="section-heading"><h3>Mailing Details</h3></div>
                  <div className="section-grid">
                    <div className="field"><label>State</label><SearchableSelect value={form.state||""} options={asOptions([{value:"",label:"Select State"},...STATES])} onChange={value=>update("state",value)} placeholder="Search states..." /></div>
                    <div className="field"><label>PIN</label><input inputMode="numeric" maxLength="6" value={form.pin||""} onChange={e=>update("pin",e.target.value.replace(/\D/g,"").slice(0,6))}/>{pinLookup && <div className={`hint ${pinLookup !== "Looking up PIN..." && pinLookup !== "State, district and address filled from PIN." ? "pin-lookup-error" : ""}`}>{pinLookup}</div>}</div>
                    <div className="field"><label>Location</label><SearchableSelect value={form.locationId||""} options={asOptions([{value:"",label:"Select Location"},...locations.map(x=>({value:x._id,label:x.name}))])} onChange={value=>update("locationId",value)} placeholder="Search locations..." /></div>
                    <div className="field"><label>Mobile</label><input value={form.mobile||""} onChange={e=>update("mobile",e.target.value)}/></div>
                    <div className="field"><label>Email</label><input type="email" value={form.email||""} onChange={e=>update("email",e.target.value)}/></div>
                    <div className="field full"><label>Address</label><textarea value={form.address||""} onChange={e=>update("address",e.target.value)}/></div>
                  </div>
                </section>
                <section className="field-section">
                  <div className="section-heading"><h3>Tax Registration Details</h3></div>
                  <div className="section-grid">
                    <div className="field check"><input type="checkbox" checked={!!form.gstApplicable} onChange={e=>update("gstApplicable",e.target.checked)}/><label>GST Applicable</label></div>
                    <div className="field"><label>GSTIN</label><input maxLength="15" value={form.gstin||""} onChange={e=>update("gstin",e.target.value.toUpperCase())}/>{gstLookup && <div className={`hint ${/failed|unavailable|valid .*GSTIN/i.test(gstLookup) ? "pin-lookup-error" : ""}`}>{gstLookup}</div>}</div>
                    <div className="field"><label>PAN / IT No.</label><input maxLength="10" value={form.pan||""} onChange={e=>update("pan",e.target.value.toUpperCase())}/></div>
                  </div>
                </section>
                <section className="field-section">
                  <div className="section-heading"><h3>Banking Details</h3></div>
                  <div className="section-grid">
                    <div className="field check"><input type="checkbox" checked={!!form.bankDetailsProvided} onChange={e=>update("bankDetailsProvided",e.target.checked)}/><label>Provide bank details</label></div>
                    {form.bankDetailsProvided && <>
                      <div className="field"><label>Account Name</label><input value={form.bankAccountName||""} onChange={e=>update("bankAccountName",e.target.value)}/></div>
                      <div className="field"><label>Bank Name</label><input value={form.bankName||""} onChange={e=>update("bankName",e.target.value)}/></div>
                      <div className="field"><label>Branch</label><input value={form.bankBranch||""} onChange={e=>update("bankBranch",e.target.value)}/></div>
                      <div className="field"><label>Account Number</label><input inputMode="numeric" value={form.bankAccountNumber||""} onChange={e=>update("bankAccountNumber",e.target.value)}/></div>
                      <div className="field"><label>IFSC</label><input maxLength="11" value={form.bankIfsc||""} onChange={e=>update("bankIfsc",e.target.value.toUpperCase())}/></div>
                    </>}
                  </div>
                </section>
                <section className="field-section">
                  <div className="section-heading"><h3>Credit Terms & Opening Balance</h3></div>
                  <div className="section-grid">
                    <div className="field"><label>Credit Limit</label><input type="number" min="0" value={form.creditLimit||""} onChange={e=>update("creditLimit",e.target.value)}/></div>
                    <div className="field"><label>Credit Days</label><input type="number" min="0" value={form.creditDays||""} onChange={e=>update("creditDays",e.target.value)}/></div>
                    <div className="field"><label>Opening Balance</label><input type="number" min="0" value={form.openingBalance||""} onChange={e=>update("openingBalance",e.target.value)}/></div>
                    <div className="field"><label>Balance Type</label><SearchableSelect value={form.openingType||"Dr"} options={asOptions(["Dr","Cr"])} onChange={value=>update("openingType",value)} placeholder="Dr / Cr" /></div>
                  </div>
                </section>
              </>}

              {type==="group" && <>
                <div className="field"><label>Under</label><SearchableSelect value={form.under||""} options={asOptions([{value:"",label:"Primary"},...GROUPS])} onChange={value=>update("under",value)} placeholder="Search groups..." /></div>
                <div className="field"><label>Nature</label><SearchableSelect value={form.nature||"Liability"} options={asOptions(["Asset","Liability","Income","Expense"])} onChange={value=>update("nature",value)} placeholder="Search nature..." /></div>
              </>}

              {(type==="party" || type==="supplier") && <>
                <div className="field"><label>Party Type</label><SearchableSelect value={form.partyType|| (type==="supplier"?"Supplier":"Customer")} options={asOptions(["Customer","Supplier"])} onChange={value=>update("partyType",value)} placeholder="Search party type..." /></div>
                <div className="field"><label>Ledger</label><SearchableSelect value={form.ledgerId||""} options={asOptions([{value:"",label:"Create/link ledger after save"},...ledgers.map(x=>({value:x._id,label:`${x.name} — ${x.under||""}`}))])} onChange={value=>update("ledgerId",value)} placeholder="Search ledgers..." /></div>
                <div className="field"><label>GSTIN</label><input maxLength="15" value={form.gstin||""} onChange={e=>update("gstin",e.target.value.toUpperCase())}/></div>
                <div className="field"><label>PAN</label><input maxLength="10" value={form.pan||""} onChange={e=>update("pan",e.target.value.toUpperCase())}/></div>
                <div className="field"><label>State</label><SearchableSelect value={form.state||""} options={asOptions([{value:"",label:"Select State"},...STATES])} onChange={value=>update("state",value)} placeholder="Search states..." /></div>
                <div className="field"><label>Location</label><SearchableSelect value={form.locationId||""} options={asOptions([{value:"",label:"Select Location"},...locations.map(x=>({value:x._id,label:x.name}))])} onChange={value=>update("locationId",value)} placeholder="Search locations..." /></div>
                <div className="field"><label>PIN</label><input maxLength="6" value={form.pin||""} onChange={e=>update("pin",e.target.value.replace(/\D/g,"").slice(0,6))}/></div>
                <div className="field"><label>Mobile</label><input value={form.mobile||""} onChange={e=>update("mobile",e.target.value)}/></div>
                <div className="field"><label>Email</label><input value={form.email||""} onChange={e=>update("email",e.target.value)}/></div>
                <div className="field"><label>Credit Limit</label><input type="number" value={form.creditLimit||""} onChange={e=>update("creditLimit",e.target.value)}/></div>
                <div className="field"><label>Credit Days</label><input type="number" value={form.creditDays||""} onChange={e=>update("creditDays",e.target.value)}/></div>
                <div className="field full"><label>Address</label><textarea value={form.address||""} onChange={e=>update("address",e.target.value)}/></div>
              </>}

              {type==="product" && <>
                <div className="field"><label>Product Code</label><input value={form.code||""} placeholder="Auto / optional" onChange={e=>update("code",e.target.value)}/></div>
                <div className="field"><label>Item Type</label><SearchableSelect value={form.itemType||"FINISHED_GOODS"} options={asOptions(["RAW_MATERIAL","GRADE","FINISHED_GOODS","PACKED_GOODS","RETURN_GOODS","REJECTED"])} onChange={value=>update("itemType",value)} placeholder="Search item types..." /></div>
                <div className="field"><label>HSN</label><input value={form.hsn||""} onChange={e=>update("hsn",e.target.value)}/></div>
                <div className="field"><label>Unit *</label><SearchableSelect value={form.unit||""} options={asOptions([{value:"",label:"Select Unit"},...units.map(x=>({value:x.code||x.name,label:`${x.code||x.name} — ${x.name}`}))])} onChange={value=>update("unit",value)} placeholder="Search units..." /></div>
                <div className="field"><label>GST %</label><input type="number" value={form.gstRate||""} onChange={e=>update("gstRate",e.target.value)}/></div>
                <div className="field"><label>Under / Stock Ledger</label><SearchableSelect value={form.under||"Stock-in-Hand"} options={asOptions(["Stock-in-Hand",...groups])} onChange={value=>update("under",value)} placeholder="Search stock groups..." /></div>
                <div className="field"><label>Purchase Rate</label><input type="number" value={form.purchaseRate||""} onChange={e=>update("purchaseRate",e.target.value)}/></div>
                <div className="field"><label>Sales Rate</label><input type="number" value={form.salesRate||""} onChange={e=>update("salesRate",e.target.value)}/></div>
                <div className="field"><label>Opening Qty</label><input type="number" value={form.openingQty||""} onChange={e=>update("openingQty",e.target.value)}/></div>
                <div className="field"><label>Opening Value</label><input type="number" value={form.openingValue||""} onChange={e=>update("openingValue",e.target.value)}/></div>
                <div className="field"><label>Location</label><SearchableSelect value={form.locationId||""} options={asOptions([{value:"",label:"Select Location"},...locations.map(x=>({value:x._id,label:x.name}))])} onChange={value=>update("locationId",value)} placeholder="Search locations..." /></div>
              </>}

              {type==="unit" && <>
                <div className="field"><label>Unit Name *</label><input autoFocus value={form.name||""} onChange={e=>update("name",e.target.value)} placeholder="Kilogram" /></div>
                <div className="field"><label>Unit Code *</label><input value={form.code||""} onChange={e=>update("code",e.target.value.toUpperCase().replace(/\s+/g,"_"))} placeholder="KG" /></div>
                <div className="field"><label>Decimal Places</label><SearchableSelect value={form.decimalPlaces ?? 2} options={asOptions([0,1,2,3,4,5,6])} onChange={value=>update("decimalPlaces",Number(value))} placeholder="Search decimal places..." /></div>
                <div className="field full"><div className="hint">Example: KG = Kilogram, MT = Metric Ton, PCS = Pieces, LTR = Litre.</div></div>
              </>}

              {type==="location" && <>
                <div className="field"><label>Location Code</label><input value={form.code||""} placeholder="Auto generated if blank" onChange={e=>update("code",e.target.value)}/></div>
                <div className="field"><label>State *</label><SearchableSelect value={form.state||""} options={asOptions([{value:"",label:"Select State"},...STATES])} onChange={value=>update("state",value)} placeholder="Search states..." /></div>
                <div className="field"><label>District</label><input value={form.district||""} onChange={e=>update("district",e.target.value)}/></div>
                <div className="field"><label>PIN</label><input inputMode="numeric" maxLength="6" value={form.pin||""} onChange={e=>update("pin",e.target.value.replace(/\D/g,"").slice(0,6))}/>{pinLookup && <div className={`hint ${pinLookup !== "Looking up PIN..." && pinLookup !== "State, district and address filled from PIN." ? "pin-lookup-error" : ""}`}>{pinLookup}</div>}</div>
                <div className="field full"><label>Address</label><textarea value={form.address||""} onChange={e=>update("address",e.target.value)}/></div>
                <div className="field"><label>GST State Code</label><input value={form.gstStateCode||""} onChange={e=>update("gstStateCode",e.target.value)}/></div>
              </>}
            </div>

            <div className="form-actions">
              <button type="button" className="btn" onClick={()=>setMode("list")}>Cancel</button>
              <button type="button" data-save-master className="btn primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save Master"}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
