import React,{useEffect,useState} from "react";
import {hrApi} from "../lib/hrApi.js";

export default function HolidayCalendar(){
 const [rows,setRows]=useState([]),[form,setForm]=useState({date:"",name:"",type:"Public"}),[error,setError]=useState("");
 async function load(){try{setRows((await hrApi.holidays()).holidays||[])}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[]);
 async function save(e){e.preventDefault();try{await hrApi.createHoliday(form);setForm({date:"",name:"",type:"Public"});load()}catch(e){setError(e.message)}}
 return <main style={S.page}><h1>Holiday Calendar</h1><p style={S.sub}>Public, company and optional holidays</p>{error&&<p style={S.error}>{error}</p>}<form onSubmit={save} style={S.card}><input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.input}/><input required placeholder="Holiday name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={S.input}/><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={S.input}>{["Public","Company","Optional"].map(x=><option key={x}>{x}</option>)}</select><button style={S.btn}>Add Holiday</button></form><div style={S.grid}>{rows.map(x=><div style={S.holiday} key={x._id}><b>{x.name}</b><span>{new Date(x.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span><small>{x.type}</small></div>)}</div></main>
}
const S={page:{padding:24,background:"#f5f7fb",minHeight:"100vh",fontFamily:"Arial"},sub:{color:"#667085"},card:{background:"#fff",padding:20,borderRadius:18,marginTop:18,boxShadow:"0 8px 24px rgba(15,23,42,.06)"},input:{padding:12,border:"1px solid #d9e1ec",borderRadius:10,margin:5},btn:{padding:"12px 18px",background:"#1d4f91",color:"#fff",border:0,borderRadius:10,fontWeight:700},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14,marginTop:18},holiday:{background:"#fff",borderRadius:16,padding:18,boxShadow:"0 6px 20px rgba(15,23,42,.06)",display:"grid",gap:8},error:{background:"#fee4e2",color:"#b42318",padding:10,borderRadius:10}};
