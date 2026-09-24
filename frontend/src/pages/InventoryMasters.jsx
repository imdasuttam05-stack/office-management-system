import React, { useEffect, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const headers = () => ({ "Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("token") || localStorage.getItem("accessToken") || ""}` });

export default function InventoryMasters(){
  const [data,setData]=useState({locations:[],suppliers:[],items:[]}),[msg,setMsg]=useState(""),[err,setErr]=useState(""),[saving,setSaving]=useState("");
  const [loc,setLoc]=useState({name:"",code:"",address:""});
  const [sup,setSup]=useState({name:"",gstin:"",state:"",phone:"",address:""});
  const [item,setItem]=useState({name:"",itemType:"RAW_MATERIAL",hsn:"",unit:"KG",defaultGstRate:"",defaultBarcode:""});
  async function load(){try{const r=await fetch(`${API_URL}/api/inventory/raw-material-masters`,{headers:headers()});const d=await r.json();if(!r.ok)throw Error(d.message||"Master load failed");setData({locations:d.locations||[],suppliers:d.suppliers||[],items:d.items||[]})}catch(e){setErr(e.message)}}
  useEffect(()=>{load()},[]);
  async function save(type,body){
    setSaving(type);setMsg("");setErr("");
    const path=type==="location"?"/api/inventory/masters/locations":type==="supplier"?"/api/inventory/masters/suppliers":"/api/inventory/masters/items";
    try{const r=await fetch(API_URL+path,{method:"POST",headers:headers(),body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.message||"Save failed");setMsg(d.message||"Created");if(type==="location")setLoc({name:"",code:"",address:""});if(type==="supplier")setSup({name:"",gstin:"",state:"",phone:"",address:""});if(type==="item")setItem({name:"",itemType:"RAW_MATERIAL",hsn:"",unit:"KG",defaultGstRate:"",defaultBarcode:""});load()}catch(e){setErr(e.message)}finally{setSaving("")}
  }
  const Field=({label,children})=><label style={{display:"block",fontSize:12,marginBottom:9}}>{label}{children}</label>;
  const Input=({value,onChange,placeholder,type="text"})=><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",boxSizing:"border-box",padding:9,border:"1px solid #d0d5dd",borderRadius:7,marginTop:4}}/>;
  return <div style={{padding:22,maxWidth:1400,margin:"auto"}}><h2>Inventory Masters</h2><p style={{color:"#667085"}}>Create Location / Godown, Supplier and Product masters for Purchase Entry.</p>
    {msg&&<div style={{padding:10,background:"#ecfdf3",marginBottom:12}}>{msg}</div>}{err&&<div style={{padding:10,background:"#fef3f2",color:"#b42318",marginBottom:12}}>{err}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:16}}>
      <section style={{border:"1px solid #e4e7ec",borderRadius:12,padding:18}}><h3>Location / Godown</h3>
        <Field label="Name *"><Input value={loc.name} onChange={v=>setLoc({...loc,name:v})}/></Field><Field label="Code"><Input value={loc.code} onChange={v=>setLoc({...loc,code:v})}/></Field><Field label="Address"><Input value={loc.address} onChange={v=>setLoc({...loc,address:v})}/></Field>
        <button disabled={saving==="location"} onClick={()=>save("location",loc)}>Create Location</button><hr/>{data.locations.map(x=><div key={x._id}><b>{x.name}</b> — {x.code||"No code"}</div>)}
      </section>
      <section style={{border:"1px solid #e4e7ec",borderRadius:12,padding:18}}><h3>Supplier</h3>
        <Field label="Name *"><Input value={sup.name} onChange={v=>setSup({...sup,name:v})}/></Field><Field label="GSTIN"><Input value={sup.gstin} onChange={v=>setSup({...sup,gstin:v.toUpperCase()})}/></Field><Field label="State"><Input value={sup.state} onChange={v=>setSup({...sup,state:v})}/></Field><Field label="Phone"><Input value={sup.phone} onChange={v=>setSup({...sup,phone:v})}/></Field><Field label="Address"><Input value={sup.address} onChange={v=>setSup({...sup,address:v})}/></Field>
        <button disabled={saving==="supplier"} onClick={()=>save("supplier",sup)}>Create Supplier</button><hr/>{data.suppliers.map(x=><div key={x._id}><b>{x.name}</b> — {x.gstin||"No GSTIN"}</div>)}
      </section>
      <section style={{border:"1px solid #e4e7ec",borderRadius:12,padding:18}}><h3>Product / Item</h3>
        <Field label="Product Name *"><Input value={item.name} onChange={v=>setItem({...item,name:v})}/></Field><Field label="Item Type"><select value={item.itemType} onChange={e=>setItem({...item,itemType:e.target.value})} style={{width:"100%",padding:9,marginTop:4}}><option value="RAW_MATERIAL">Raw Material</option><option value="GRADE">Grade</option><option value="FINISHED_GOODS">Finished Goods</option></select></Field><Field label="HSN"><Input value={item.hsn} onChange={v=>setItem({...item,hsn:v})}/></Field><Field label="Unit"><Input value={item.unit} onChange={v=>setItem({...item,unit:v})}/></Field><Field label="Default GST %"><Input type="number" value={item.defaultGstRate} onChange={v=>setItem({...item,defaultGstRate:v})}/></Field><Field label="Default Barcode"><Input value={item.defaultBarcode} onChange={v=>setItem({...item,defaultBarcode:v})}/></Field>
        <button disabled={saving==="item"} onClick={()=>save("item",item)}>Create Product</button><hr/>{data.items.map(x=><div key={x._id}><b>{x.name}</b> — {x.itemType}</div>)}
      </section>
    </div>
  </div>
}
