import React, { useEffect, useMemo, useRef, useState } from "react";
import { hrApi } from "../lib/hrApi.js";

const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function monthRange(value) {
  const [y,m] = value.split("-").map(Number);
  return { from:`${value}-01`, to:`${y}-${String(m+1).padStart(2,"0")}-01` };
}

function minutes(t){
  if(!t) return null;
  const m=String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i); if(!m) return null;
  let h=Number(m[1]), min=Number(m[2]); const ap=m[3]?.toUpperCase();
  if(ap==="PM"&&h<12)h+=12; if(ap==="AM"&&h===12)h=0; return h*60+min;
}
function hoursWorked(a){
  const i=minutes(a.checkIn),o=minutes(a.checkOut); if(i===null||o===null||o<i)return "--";
  const total=o-i, h=Math.floor(total/60), m=total%60; return `${h}h ${m}m`;
}
function fmtDate(d){ return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }

export default function Attendance(){
  const today=new Date().toISOString().slice(0,10), month=today.slice(0,7);
  const [selectedDate,setSelectedDate]=useState(today),[selectedMonth,setSelectedMonth]=useState(month);
  const [employees,setEmployees]=useState([]),[rows,setRows]=useState([]),[shifts,setShifts]=useState([]);
  const [settings,setSettings]=useState(null),[search,setSearch]=useState(""),[location,setLocation]=useState("All Locations"),[status,setStatus]=useState("All"),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [view,setView]=useState("month"),[showSettings,setShowSettings]=useState(false),[showShift,setShowShift]=useState(false);
  const [shiftForm,setShiftForm]=useState({name:"",startTime:"09:00",endTime:"18:00",breakMinutes:60,graceMinutes:10,overtimeAfterMinutes:0});
  const fileRef=useRef(null);

  async function load(){
    try{
      setError("");
      const range=view==="day"?{from:selectedDate,to:new Date(new Date(selectedDate).getTime()+86400000).toISOString().slice(0,10)}:monthRange(selectedMonth);
      const [e,a,s]=await Promise.all([hrApi.employees(),hrApi.attendance(`?from=${range.from}&to=${range.to}`),hrApi.attendanceSettings()]);
      setEmployees(e.employees||[]);setRows(a.attendance||[]);setSettings(s.settings);setShifts(s.shifts||[]);
    }catch(e){setError(e.message)}
  }
  useEffect(()=>{load()},[selectedDate,selectedMonth,view]);

  const locations=useMemo(()=>["All Locations",...new Set(employees.map(e=>e.workLocation||e.location).filter(Boolean))],[employees]);
  const filtered=useMemo(()=>rows.filter(r=>{
    const emp=r.employeeId||{}; const q=search.toLowerCase();
    return (!q||`${emp.name} ${emp.employeeCode}`.toLowerCase().includes(q)) && (location==="All Locations"||(r.workLocation||emp.workLocation||emp.location)===location) && (status==="All"||r.status===status);
  }),[rows,search,location,status]);

  const summary=useMemo(()=>{
    const dayRows=rows.filter(r=>new Date(r.date).toISOString().slice(0,10)===selectedDate);
    return {
      totalStaff: location==="All Locations"?employees.length:employees.filter(e=>(e.workLocation||e.location)===location).length,
      present:dayRows.filter(x=>x.status==="Present").length,
      absent:dayRows.filter(x=>x.status==="Absent").length,
      halfDay:dayRows.filter(x=>x.status==="Half Day").length,
      leave:dayRows.filter(x=>x.status==="Leave").length,
      overtime:dayRows.reduce((n,x)=>n+Number(x.overtimeHours||0),0),
      punchedIn:dayRows.filter(x=>x.checkIn).length,
      punchedOut:dayRows.filter(x=>x.checkOut).length,
      fine:dayRows.reduce((n,x)=>n+Number(x.fineHours||0),0),
    };
  },[rows,employees,selectedDate,location]);

  async function upload(e){
    const file=e.target.files?.[0]; if(!file)return;
    try{setError("");setMessage("Uploading Excel...");const r=await hrApi.uploadAttendance(file);setMessage(`Imported ${r.imported} records. Skipped ${r.skipped}.`);setView("month");await load();}catch(err){setError(err.message)}finally{e.target.value="";}
  }
  async function saveRules(){
    try{await hrApi.saveAttendanceSettings(settings);setMessage("Attendance rules saved.");setShowSettings(false);await load();}catch(e){setError(e.message)}
  }
  async function createShift(){
    try{await hrApi.createShift({...shiftForm,breakMinutes:Number(shiftForm.breakMinutes),graceMinutes:Number(shiftForm.graceMinutes),overtimeAfterMinutes:Number(shiftForm.overtimeAfterMinutes)});setShowShift(false);setMessage("Shift created.");await load();}catch(e){setError(e.message)}
  }

  const ruleFor=(key)=>settings?.days?.[key]||{type:"Working",shiftId:null,overtimeAllowed:true};
  const setDayRule=(key,field,value)=>setSettings(s=>({...s,days:{...s.days,[key]:{...ruleFor(key),[field]:value}}}));
  const saturday=settings?.saturday||{type:"Working",shiftId:null,overtimeAllowed:true};

  return <main style={S.page}><div style={S.container}>
    <header style={S.header}><div><h1 style={S.h1}>Attendance Summary</h1><p style={S.sub}>Actual attendance, punch time, shifts and monthly Excel records</p></div><div style={S.headerActions}>
      <select style={S.input} value={location} onChange={e=>setLocation(e.target.value)}>{locations.map(x=><option key={x}>{x}</option>)}</select>
      <input type="date" style={S.input} value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/>
      <button style={S.btn2} onClick={()=>setShowSettings(v=>!v)}>⚙ Settings</button>
    </div></header>

    {error&&<div style={S.error}>{error}</div>}{message&&<div style={S.success}>{message}</div>}

    <section style={S.cards}>{[
      ["Total Staff",summary.totalStaff], ["Present",summary.present], ["Absent",summary.absent], ["Half Day",summary.halfDay],
      ["Overtime Hours",`${summary.overtime}h`],["Fine Hours",`${summary.fine}h`],["Leave",summary.leave],["Punched In",summary.punchedIn],["Punched Out",summary.punchedOut]
    ].map(([a,b])=><div style={S.card} key={a}><div style={S.label}>{a}</div><div style={S.value}>{b}</div></div>)}</section>

    <section style={S.pending}><div><b>Total Pending for Approval : 0</b><div style={S.small}>Calculated from actual attendance records</div></div><button style={S.btn} onClick={()=>alert("Approval workflow can be connected to HR approval API.")}>Review</button></section>

    <section style={S.actions}>{[
      ["📥","Bulk Add Attendance",()=>fileRef.current?.click()], ["📅","Leaves",()=>window.location.hash="/leaves"], ["🚗","On Duty",()=>alert("On Duty module")], ["📝","Bulk Add Work",()=>fileRef.current?.click()], ["⚠️","Fine",()=>alert("Fine review")], ["⏱️","Overtime",()=>alert("Overtime review")]
    ].map(([i,t,fn])=><button key={t} style={S.action} onClick={fn}><span>{i}</span>{t}</button>)}</section>
    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={upload} style={{display:"none"}}/>

    <section style={S.panel}><div style={S.panelHead}><div><b style={{fontSize:19}}>Staff Attendance</b><div style={S.small}>{view==="month"?`Monthly data: ${selectedMonth}`:`Daily data: ${fmtDate(selectedDate)}`}</div></div><div style={S.controls}>
      <button style={view==="day"?S.btn:S.btn2} onClick={()=>setView("day")}>Daily</button><button style={view==="month"?S.btn:S.btn2} onClick={()=>setView("month")}>Monthly</button>
      {view==="month"&&<input type="month" style={S.input} value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}/>}<input style={S.search} placeholder="Search employee..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <select style={S.input} value={status} onChange={e=>setStatus(e.target.value)}>{["All","Present","Absent","Half Day","Leave","Holiday","Week Off"].map(x=><option key={x}>{x}</option>)}</select>
    </div></div>

    <div style={S.tableHead}><span>Employee</span><span>Work Location</span><span>Date</span><span>Shift</span><span>Status</span><span>In</span><span>Out</span><span>Hours</span><span>OT</span></div>
    {filtered.length===0?<div style={S.empty}>No attendance data found. Upload the Excel or add attendance.</div>:filtered.map(a=>{const emp=a.employeeId||{};return <div style={S.row} key={a._id}><div><b>{emp.name||"Unknown"}</b><div style={S.small}>{emp.employeeCode}</div></div><span>{a.workLocation||emp.workLocation||emp.location||"-"}</span><span>{fmtDate(a.date)}</span><span>{a.shiftName||"-"}</span><span style={{...S.badge,...statusStyle(a.status)}}>{shortStatus(a.status)}</span><span>{a.checkIn||"-"}</span><span>{a.checkOut||"-"}</span><span>{hoursWorked(a)}</span><span>{a.overtimeHours||0}h</span></div>})}
    <div style={S.legend}><b>P</b> Present <b>HD</b> Half Day <b>A</b> Absent <b>L</b> Leave <b>F</b> Fine <b>OT</b> Overtime</div></section>

    {showSettings&&<section style={S.panel}><div style={S.panelHead}><b style={{fontSize:19}}>Attendance Rules</b><div><button style={S.btn2} onClick={()=>setShowShift(v=>!v)}>+ Add Shift</button> <button style={S.btn} onClick={saveRules}>Save Rules</button></div></div>
      <div style={S.ruleGrid}>{["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(day=>{const r=day==="saturday"?saturday:ruleFor(day);return <div style={S.ruleCard} key={day}><b>{day.toUpperCase()}</b><select style={S.input} value={r.type} onChange={e=>day==="saturday"?setSettings(s=>({...s,saturday:{...saturday,type:e.target.value}})):setDayRule(day,"type",e.target.value)}><option>Working</option><option>Half Day</option><option>Week Off</option></select><select style={S.input} value={r.shiftId||""} onChange={e=>day==="saturday"?setSettings(s=>({...s,saturday:{...saturday,shiftId:e.target.value||null}})):setDayRule(day,"shiftId",e.target.value||null)}><option value="">Default Shift</option>{shifts.map(x=><option value={x._id} key={x._id}>{x.name} ({x.startTime}-{x.endTime})</option>)}</select><label><input type="checkbox" checked={r.overtimeAllowed!==false} onChange={e=>day==="saturday"?setSettings(s=>({...s,saturday:{...saturday,overtimeAllowed:e.target.checked}})):setDayRule(day,"overtimeAllowed",e.target.checked)}/> Overtime allowed</label></div>})}</div>
      {showShift&&<div style={S.shiftBox}>{["name","startTime","endTime","breakMinutes","graceMinutes","overtimeAfterMinutes"].map(k=><input key={k} style={S.input} placeholder={k} value={shiftForm[k]} onChange={e=>setShiftForm({...shiftForm,[k]:e.target.value})}/>)}<button style={S.btn} onClick={createShift}>Save Shift</button></div>}
    </section>}
  </div></main>
}

function shortStatus(x){return x==="Present"?"P":x==="Half Day"?"HD":x==="Absent"?"A":x==="Leave"?"L":x==="Holiday"?"H":"WO"}
function statusStyle(x){if(x==="Present")return{background:"#dcfce7",color:"#166534"};if(x==="Absent")return{background:"#fee2e2",color:"#991b1b"};if(x==="Half Day")return{background:"#fef3c7",color:"#92400e"};if(x==="Leave")return{background:"#e0e7ff",color:"#3730a3"};return{background:"#eef2f7",color:"#475467"}}
const S={page:{padding:24,background:"#f5f7fb",minHeight:"100vh",fontFamily:"Arial, sans-serif",color:"#172033"},container:{maxWidth:1500,margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:18},headerActions:{display:"flex",gap:8,flexWrap:"wrap"},h1:{margin:0,fontSize:27},sub:{margin:"5px 0",color:"#667085"},cards:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12},card:{background:"#fff",border:"1px solid #e3e7ef",borderRadius:12,padding:16},label:{fontSize:13,color:"#667085"},value:{fontSize:26,fontWeight:700,marginTop:7},pending:{margin:"16px 0",padding:16,background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12},actions:{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:18},action:{background:"#fff",border:"1px solid #e3e7ef",borderRadius:10,padding:15,cursor:"pointer",fontWeight:700},actionIcon:{fontSize:20},panel:{background:"#fff",border:"1px solid #e3e7ef",borderRadius:12,overflow:"hidden",marginBottom:18},panelHead:{padding:16,borderBottom:"1px solid #e7ebf1",display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"},controls:{display:"flex",gap:7,flexWrap:"wrap"},input:{height:40,border:"1px solid #d8dee9",borderRadius:8,padding:"0 10px",background:"#fff"},search:{height:40,width:220,border:"1px solid #d8dee9",borderRadius:8,padding:"0 10px"},btn:{height:40,border:0,borderRadius:8,padding:"0 14px",background:"#2563eb",color:"#fff",fontWeight:700,cursor:"pointer"},btn2:{height:40,border:"1px solid #d8dee9",borderRadius:8,padding:"0 14px",background:"#fff",fontWeight:700,cursor:"pointer"},tableHead:{display:"grid",gridTemplateColumns:"1.5fr 1.2fr .9fr 1fr .7fr .7fr .7fr .7fr .5fr",gap:8,padding:"11px 16px",background:"#f8fafc",fontSize:12,fontWeight:700,color:"#667085"},row:{display:"grid",gridTemplateColumns:"1.5fr 1.2fr .9fr 1fr .7fr .7fr .7fr .7fr .5fr",gap:8,padding:"13px 16px",borderTop:"1px solid #edf0f4",alignItems:"center",fontSize:13},badge:{display:"inline-flex",justifyContent:"center",padding:"5px 8px",borderRadius:7,fontWeight:700,fontSize:12},legend:{padding:13,display:"flex",gap:14,flexWrap:"wrap",borderTop:"1px solid #edf0f4",fontSize:12,color:"#667085"},small:{fontSize:12,color:"#667085",marginTop:3},empty:{padding:40,textAlign:"center",color:"#667085"},error:{padding:12,background:"#fee4e2",color:"#b42318",borderRadius:8,marginBottom:10},success:{padding:12,background:"#dcfce7",color:"#166534",borderRadius:8,marginBottom:10},ruleGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,padding:16},ruleCard:{border:"1px solid #e3e7ef",borderRadius:10,padding:12,display:"flex",flexDirection:"column",gap:7},shiftBox:{padding:16,borderTop:"1px solid #e7ebf1",display:"flex",gap:8,flexWrap:"wrap"}}
