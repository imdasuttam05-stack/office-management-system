import React from "react";
import {useNavigate} from "react-router-dom";

const items=[
  ["Purchase","Purchase Entry","/manufacturing?tab=purchase","F9","Raw material purchase → Raw Stock"],
  ["Job Order","Job Order / Production","/manufacturing?tab=grading","F10","Create grading / production job order"],
  ["Production","Finished Goods Production","/manufacturing?tab=fgjob","F11","Grade stock → Finished Goods"],
  ["Sale","Sale Voucher","/manufacturing?tab=sales","F12","Finished/Packed stock → Sale"],
  ["PI","Proforma Invoice","/operations?tab=pi","Ctrl+1","No stock reduction"],
  ["Return","Sale / Purchase / Expired Return","/operations?tab=return","Ctrl+2","Return and stock adjustment"],
  ["Damage","Damage Voucher","/operations?tab=damage","Ctrl+3","Damage/rejected stock out"],
  ["Repacking","Repacking Voucher","/operations?tab=repack","Ctrl+4","Loose/return → packed stock"],
  ["Packing Conversion","Packing Conversion","/operations?tab=packing-conversion","Ctrl+5","Packing conversion + charge"],
  ["Grading","Grading Voucher","/manufacturing?tab=grading","Ctrl+6","Raw stock → Grade stock"],
  ["Raw Stock","Raw Material Stock","/manufacturing?tab=purchase","Ctrl+7","Purchase and raw stock"],
  ["Packing Stock","Finished / Packing Stock","/manufacturing?tab=fg","Ctrl+8","Finished goods and packed stock"],
  ["Accounts Ledger","Ledger / Accounting","/accounting","F6","Accounting voucher and ledger"],
];
export default function VoucherCenter(){const nav=useNavigate();return <main style={{padding:24,minHeight:"100vh",background:"#f5f7fb",fontFamily:"Arial,sans-serif",color:"#172b4d"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:18}}><div><h1 style={{margin:"0 0 6px"}}>Voucher Center</h1><div style={{color:"#667085"}}>Press a voucher key or select an entry below. Existing modules remain unchanged.</div></div><button onClick={()=>nav("/accounting")} style={btn("#344054")}>Ledger / Accounts</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14}}>{items.map(([title,sub,path,key,desc])=><button key={title} onClick={()=>nav(path)} style={{textAlign:"left",background:"#fff",border:"1px solid #e4e7ec",borderRadius:14,padding:18,cursor:"pointer",boxShadow:"0 2px 8px rgba(16,24,40,.05)"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><b style={{fontSize:17}}>{title}</b><kbd style={{background:"#eef2f6",padding:"4px 7px",borderRadius:6,fontSize:11}}>{key}</kbd></div><div style={{fontWeight:600,marginTop:7}}>{sub}</div><div style={{fontSize:12,color:"#667085",marginTop:7}}>{desc}</div></button>)}</div><div style={{marginTop:20,padding:14,background:"#fff",borderRadius:12,border:"1px solid #e4e7ec"}}><b>Flow:</b> Purchase → Raw Stock → Job Order → Grading → Production → Packing/Repacking → Packing Stock → PI → Sale → Return/Expired/Damage → Accounts.</div></main>}
function btn(bg){return {border:0,borderRadius:8,padding:"10px 14px",background:bg,color:"#fff",fontWeight:700,cursor:"pointer"}}
