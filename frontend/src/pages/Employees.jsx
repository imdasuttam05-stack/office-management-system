import React,{useEffect,useState} from "react";
import {hrApi} from "../lib/hrApi.js";

export default function Employees(){
 const [rows,setRows]=useState([]),[form,setForm]=useState({employeeCode:"",name:"",email:"",mobile:"",department:"",designation:"",joiningDate:"",basicSalary:""}),[error,setError]=useState("");
 async function load(){try{setRows((await hrApi.employees()).employees||[])}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[]);
 async function save(e){e.preventDefault();try{await hrApi.createEmployee({...form,basicSalary:Number(form.basicSalary||0)});setForm({employeeCode:"",name:"",email:"",mobile:"",department:"",designation:"",joiningDate:"",basicSalary:""});load()}catch(e){setError(e.message)}}
 return <main style={S.page}><h1>Employees</h1><p style={S.sub}>Employee master and salary setup</p>{error&&<p style={S.error}>{error}</p>}
 <form onSubmit={save} style={S.card}>{Object.keys(form).map(k=><input key={k} required={["employeeCode","name","joiningDate","basicSalary"].includes(k)} type={k==="joiningDate"?"date":k==="basicSalary"?"number":"text"} placeholder={k.replace(/([A-Z])/g," $1")} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={S.input}/>)}<button style={S.btn}>+ Add Employee</button></form>
 <section style={S.card}>{rows.map(e=><div style={S.row} key={e._id}><b>{e.employeeCode} — {e.name}</b><span>{e.department||"-"}</span><span>{e.designation||"-"}</span><span>₹{Number(e.basicSalary||0).toLocaleString("en-IN")}</span><span style={S.badge}>{e.status}</span></div>)}</section></main>
}
const S={page:{padding:24,background:"#f5f7fb",minHeight:"100vh",fontFamily:"Arial"},sub:{color:"#667085"},card:{background:"#fff",padding:20,borderRadius:18,marginTop:18,boxShadow:"0 8px 24px rgba(15,23,42,.06)"},input:{padding:12,border:"1px solid #d9e1ec",borderRadius:10,margin:5},btn:{padding:"12px 18px",background:"#1d4f91",color:"#fff",border:0,borderRadius:10,fontWeight:700},row:{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr .7fr",gap:12,padding:"14px 0",borderBottom:"1px solid #eee"},badge:{background:"#eaf7ef",color:"#16834b",padding:"5px 9px",borderRadius:20,fontSize:12},error:{background:"#fee4e2",color:"#b42318",padding:10,borderRadius:10}};
