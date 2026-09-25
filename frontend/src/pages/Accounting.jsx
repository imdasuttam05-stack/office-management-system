import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com";
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` });
const money = n => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function Accounting() {
  const [tab, setTab] = useState("groups");
  const [groups, setGroups] = useState([]), [ledgers, setLedgers] = useState([]), [vouchers, setVouchers] = useState([]);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const [group, setGroup] = useState({ name: "", nature: "Expense" });
  const [ledger, setLedger] = useState({ name: "", group: "", openingBalance: "", openingType: "Dr", gstin: "", phone: "" });
  const [voucher, setVoucher] = useState({ date: new Date().toISOString().slice(0,10), type: "Payment", narration: "", lines: [{ ledger: "", debit: "", credit: "" }, { ledger: "", debit: "", credit: "" }] });

  async function load() {
    try {
      const [g,l,v] = await Promise.all([fetch(`${API}/api/accounting/groups`, {headers: headers()}), fetch(`${API}/api/accounting/ledgers`, {headers: headers()}), fetch(`${API}/api/accounting/vouchers`, {headers: headers()})]);
      const gd = await g.json(), ld = await l.json(), vd = await v.json();
      if (!g.ok) throw new Error(gd.message || "Unable to load groups");
      setGroups(gd.groups || []); setLedgers(ld.ledgers || []); setVouchers(vd.vouchers || []);
    } catch(e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  async function post(url, body) {
    setError(""); setMessage(""); const r = await fetch(`${API}${url}`, {method:"POST", headers:headers(), body:JSON.stringify(body)}); const d=await r.json(); if(!r.ok) throw new Error(d.message||"Save failed"); return d;
  }
  async function saveGroup(e){e.preventDefault();try{await post('/api/accounting/groups',group);setGroup({name:"",nature:"Expense"});setMessage('Group saved');load()}catch(e){setError(e.message)}}
  async function saveLedger(e){e.preventDefault();try{await post('/api/accounting/ledgers',ledger);setLedger({name:"",group:"",openingBalance:"",openingType:"Dr",gstin:"",phone:""});setMessage('Ledger saved');load()}catch(e){setError(e.message)}}
  function lineChange(i,k,v){setVoucher(x=>({...x,lines:x.lines.map((l,idx)=>idx===i?{...l,[k]:v}:l)}))}
  async function saveVoucher(e){e.preventDefault();try{await post('/api/accounting/vouchers',voucher);setVoucher({date:new Date().toISOString().slice(0,10),type:'Payment',narration:'',lines:[{ledger:'',debit:'',credit:''},{ledger:'',debit:'',credit:''}]});setMessage('Voucher saved');load()}catch(e){setError(e.message)}}
  return <div style={styles.page}>
    <div style={styles.header}><div><h1>Accounts</h1><p>Tally-style Groups, Ledgers and double-entry vouchers</p></div></div>
    <div style={styles.tabs}>{[['groups','Groups'],['ledgers','Ledgers'],['voucher','Voucher Entry'],['vouchers','Voucher Register']].map(([id,t])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}>{t}</button>)}</div>
    {message && <div style={styles.ok}>{message}</div>}{error && <div style={styles.err}>{error}</div>}
    {tab==='groups' && <div style={styles.grid}><form style={styles.card} onSubmit={saveGroup}><h2>Create Group</h2><input placeholder="Group name" value={group.name} onChange={e=>setGroup({...group,name:e.target.value})}/><select value={group.nature} onChange={e=>setGroup({...group,nature:e.target.value})}>{['Asset','Liability','Income','Expense','Capital'].map(x=><option key={x}>{x}</option>)}</select><button>Save Group</button></form><div style={styles.card}><h2>Accounting Groups</h2><table><thead><tr><th>Group</th><th>Nature</th></tr></thead><tbody>{groups.map(g=><tr key={g._id}><td>{g.name}</td><td>{g.nature}</td></tr>)}</tbody></table></div></div>}
    {tab==='ledgers' && <div style={styles.grid}><form style={styles.card} onSubmit={saveLedger}><h2>Create Ledger</h2><input placeholder="Ledger name" value={ledger.name} onChange={e=>setLedger({...ledger,name:e.target.value})}/><select value={ledger.group} onChange={e=>setLedger({...ledger,group:e.target.value})}><option value="">Select Group</option>{groups.map(g=><option key={g._id} value={g._id}>{g.name}</option>)}</select><input type="number" placeholder="Opening balance" value={ledger.openingBalance} onChange={e=>setLedger({...ledger,openingBalance:e.target.value})}/><select value={ledger.openingType} onChange={e=>setLedger({...ledger,openingType:e.target.value})}><option>Dr</option><option>Cr</option></select><input placeholder="GSTIN (optional)" value={ledger.gstin} onChange={e=>setLedger({...ledger,gstin:e.target.value})}/><input placeholder="Phone (optional)" value={ledger.phone} onChange={e=>setLedger({...ledger,phone:e.target.value})}/><button>Save Ledger</button></form><div style={styles.card}><h2>Ledgers</h2><table><thead><tr><th>Name</th><th>Group</th><th>Opening</th></tr></thead><tbody>{ledgers.map(l=><tr key={l._id}><td>{l.name}</td><td>{l.group?.name}</td><td>{money(l.openingBalance)} {l.openingType}</td></tr>)}</tbody></table></div></div>}
    {tab==='voucher' && <form style={styles.card} onSubmit={saveVoucher}><h2>Voucher Entry</h2><div style={styles.row}><input type="date" value={voucher.date} onChange={e=>setVoucher({...voucher,date:e.target.value})}/><select value={voucher.type} onChange={e=>setVoucher({...voucher,type:e.target.value})}>{['Payment','Receipt','Contra','Journal','Sales','Purchase','Debit Note','Credit Note'].map(x=><option key={x}>{x}</option>)}</select><input style={{flex:1}} placeholder="Narration" value={voucher.narration} onChange={e=>setVoucher({...voucher,narration:e.target.value})}/></div>{voucher.lines.map((l,i)=><div style={styles.row} key={i}><select value={l.ledger} onChange={e=>lineChange(i,'ledger',e.target.value)}><option value="">Select Ledger</option>{ledgers.map(x=><option key={x._id} value={x._id}>{x.name}</option>)}</select><input type="number" placeholder="Debit" value={l.debit} onChange={e=>lineChange(i,'debit',e.target.value)}/><input type="number" placeholder="Credit" value={l.credit} onChange={e=>lineChange(i,'credit',e.target.value)}/><input placeholder="Line narration" value={l.narration||''} onChange={e=>lineChange(i,'narration',e.target.value)}/></div>)}<button type="button" onClick={()=>setVoucher(x=>({...x,lines:[...x.lines,{ledger:'',debit:'',credit:''}]}))}>+ Add Line</button><button style={{marginLeft:8}}>Save Voucher</button></form>}
    {tab==='vouchers' && <div style={styles.card}><h2>Voucher Register</h2><table><thead><tr><th>No.</th><th>Date</th><th>Type</th><th>Debit</th><th>Credit</th><th>Narration</th></tr></thead><tbody>{vouchers.map(v=><tr key={v._id}><td>{v.voucherNo}</td><td>{new Date(v.date).toLocaleDateString('en-IN')}</td><td>{v.type}</td><td>{money(v.totalDebit)}</td><td>{money(v.totalCredit)}</td><td>{v.narration}</td></tr>)}</tbody></table></div>}
  </div>
}
const styles={page:{padding:24,fontFamily:'Arial,sans-serif',background:'#f5f7fb',minHeight:'100vh',color:'#172b4d'},header:{marginBottom:16},tabs:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16},card:{background:'#fff',padding:20,borderRadius:14,boxShadow:'0 4px 18px rgba(0,0,0,.06)'},grid:{display:'grid',gridTemplateColumns:'minmax(280px,380px) 1fr',gap:18},row:{display:'flex',gap:10,margin:'10px 0',flexWrap:'wrap'},ok:{padding:12,background:'#e9f8ef',marginBottom:12,borderRadius:8},err:{padding:12,background:'#fff0f0',marginBottom:12,borderRadius:8},active:{background:'#245a96',color:'#fff'},};
