import React from "react";
import {useNavigate} from "react-router-dom";

const items=[
  ["Purchase","Purchase Entry","purchase","F10","Purchase → Raw Stock + Accounts"],
  ["Job Order","Job Order","job","F12","Stock-controlled job creation"],
  ["Production","Finished Goods Production","production","F13","Grade Stock → Finished Goods"],
  ["Grading","Grading Voucher","grading","F14","Raw Stock → Grade Stock"],
  ["Sale","Sale Voucher","sale","F11","Finished / Packed Stock → Sale"],
  ["PI","Proforma Invoice","pi","F15","No stock reduction"],
  ["Return","Sale / Purchase / Expired / Quality Return","return","F16","Stock + accounts effect"],
  ["Damage","Damage Voucher","damage","F17","Reduce damaged stock"],
  ["Repacking","Repacking Voucher","repack","F18","Open/return → packed stock"],
  ["Packing Conversion","Packing Conversion","packing","F19","Conversion charge + packed stock"],
  ["BOM / Costing","BOM & Product Cost","bom","","Material + labour + packing cost"],
  ["Raw / Packing Stock","Stock & Ledger","stock","","View live stock and movement ledger"],
];

export default function VoucherCenter(){
  const nav=useNavigate();
  const go=(tab)=>nav(`/accounts?section=transactions&tab=${encodeURIComponent(tab)}`);
  return <main style={{padding:24,minHeight:"100vh",background:"#f5f7fb",fontFamily:"Arial,sans-serif",color:"#172b4d"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:18}}>
      <div><h1 style={{margin:"0 0 6px"}}>Voucher Entry</h1><div style={{color:"#667085"}}>All Purchase, Production, Sale, Return, Packing and Stock entries open inside Accounts Masters.</div></div>
      <button onClick={()=>nav("/accounts?section=master&master=ledger")} style={btn("#344054")}>Accounts Masters</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(235px,1fr))",gap:14}}>
      {items.map(([title,sub,tab,key,desc])=><button key={title} onClick={()=>go(tab)} style={{textAlign:"left",background:"#fff",border:"1px solid #e4e7ec",borderRadius:14,padding:18,cursor:"pointer",boxShadow:"0 2px 8px rgba(16,24,40,.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><b style={{fontSize:17}}>{title}</b>{key&&<kbd style={{background:"#eef2f6",padding:"4px 7px",borderRadius:6,fontSize:11}}>{key}</kbd>}</div>
        <div style={{fontWeight:600,marginTop:7}}>{sub}</div><div style={{fontSize:12,color:"#667085",marginTop:7}}>{desc}</div>
      </button>)}
    </div>
  </main>
}
function btn(bg){return {border:0,borderRadius:8,padding:"10px 14px",background:bg,color:"#fff",fontWeight:700,cursor:"pointer"}}
