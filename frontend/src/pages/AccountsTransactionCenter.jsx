import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AccountsMasterCatalog from "./AccountsMasterCatalog.jsx";

const API = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");
const auth = () => ({"Content-Type":"application/json", Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("accessToken") || ""}`});
const today = () => new Date().toISOString().slice(0,10);
const money = v => Number(v || 0).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
const n = v => Number(v || 0);
const round2 = v => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
const dateOnly = value => value ? new Date(value).toLocaleDateString("en-IN") : "-";
const bomCostAmount = (qty, unit, rate) => {
  const normalized = String(unit || "").trim().toLowerCase();
  const divisor = ["g", "gm", "gram", "grams", "ml", "milliliter", "milliliters", "millilitre", "millilitres"].includes(normalized) ? 1000 : normalized === "mg" ? 1000000 : 1;
  return round2((n(qty) * n(rate)) / divisor);
};
const packageWeightGrams = name => {
  const match = String(name || "").match(/(\d+(?:\.\d+)?)\s*(mg|g|gm|grams?|kg|kgs|kilograms?)\b/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  return /^mg$/i.test(match[2]) ? amount / 1000 : /^kg/i.test(match[2]) ? amount * 1000 : amount;
};

const txTabs = [
  ["purchase","Purchase"],["sale","Sale"],["job","Job Order"],["production","Production"],
  ["grading","Grading"],["pi","PI"],["return","Return"],["damage","Damage"],["repack","Repacking"],
  ["packing","Packing Conversion"],["bom","BOM / Costing"],["stock","Stock / Ledger"],["documents","Documents"]
];

const blankLine = (itemType="RAW_MATERIAL") => ({itemId:"",itemName:"",itemType,unit:"KG",qty:1,rate:0,batchNo:"",barcode:"",gstRate:0,gstType:"NONE",value:0});

function focusNextTransactionField(rootEl, target) {
  if (!rootEl || !target) return;
  const fields = [...rootEl.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')]
    .filter(el => el.getClientRects().length && !el.readOnly && el.tabIndex !== -1);
  const index = fields.indexOf(target);
  if (index < 0) return;
  const next = fields[index + 1];
  if (next) {
    next.focus();
    if (next.tagName === "INPUT" && next.type !== "date" && next.type !== "checkbox" && next.type !== "radio" && typeof next.select === "function") next.select();
  } else {
    const save = [...rootEl.querySelectorAll("button")].find(b => /save|post|create|submit/i.test(b.textContent || "") && !b.disabled);
    save?.focus();
  }
}

function SearchableSelect({value,onChange,options=[],placeholder="Search and select",className="",style={},masterType="product",onOpenMaster=()=>{}}) {
  const [query,setQuery]=useState(""); const [open,setOpen]=useState(false); const [active,setActive]=useState(0); const [menuRect,setMenuRect]=useState(null); const root=useRef(null);
  function updateMenuRect(){const input=root.current?.querySelector("input");if(!input)return;const r=input.getBoundingClientRect();const menuHeight=Math.min(230,Math.max(90,filtered.length*38+48));const spaceBelow=window.innerHeight-r.bottom;const placeAbove=spaceBelow<menuHeight&&r.top>spaceBelow;setMenuRect({left:r.left,top:placeAbove?Math.max(4,r.top-menuHeight-3):r.bottom+3,width:r.width,maxHeight:Math.min(230,placeAbove?r.top-8:spaceBelow-8)});}
  const selected=options.find(x=>String(x.value)===String(value||""));
  const filtered=options.filter(x=>String(x.label||"").toLowerCase().includes(query.toLowerCase())).slice(0,100);
  useEffect(()=>{if(!open)return;updateMenuRect();const close=e=>{if(root.current&&!root.current.contains(e.target)&&!e.target.closest?.("[role=\"listbox\"]"))setOpen(false)};const reposition=()=>updateMenuRect();document.addEventListener("mousedown",close);window.addEventListener("resize",reposition);window.addEventListener("scroll",reposition,true);return()=>{document.removeEventListener("mousedown",close);window.removeEventListener("resize",reposition);window.removeEventListener("scroll",reposition,true)}},[open,query,filtered.length]);
  function choose(option, moveNext=false, target=null){
    if (!option) return;
    onChange({target:{value:option.value ?? ""}});setQuery("");setOpen(false);setActive(0);
    if (moveNext) {
      const rootEl = root.current?.closest(".tx-center");
      // Let React apply the selected value before moving focus to the next Tally-style field.
      requestAnimationFrame(() => focusNextTransactionField(rootEl, target || root.current?.querySelector("input")));
    }
  }
  return <div ref={root} className={`tx-search-select ${className}`} style={{position:"relative",minWidth:0,...style}} onKeyDown={e=>{if(e.altKey&&e.key.toLowerCase()==="c"){e.preventDefault();e.stopPropagation();onOpenMaster(masterType,"create","");return}else if(e.ctrlKey&&e.key==="Enter"){e.preventDefault();e.stopPropagation();if(value)onOpenMaster(masterType,"edit",String(value));else onOpenMaster(masterType,"list","");return}else if(e.key==="ArrowDown"&&open){e.preventDefault();setActive(v=>Math.min(v+1,Math.max(0,filtered.length-1)))}else if(e.key==="ArrowUp"&&open){e.preventDefault();setActive(v=>Math.max(v-1,0))}else if(e.key==="Enter"&&open){e.preventDefault();e.stopPropagation();if(filtered[active])choose(filtered[active],true,e.target);else if(filtered.length)choose(filtered[0],true,e.target)}else if(e.key==="Enter"&&!open){e.preventDefault();e.stopPropagation();focusNextTransactionField(e.currentTarget.closest(".tx-center"),e.target)}else if(e.key==="Escape")setOpen(false)}}>
    <input aria-label={placeholder} autoComplete="off" value={open?query:(selected?.label||"")} placeholder={placeholder} onFocus={()=>{setQuery("");setOpen(true);setActive(0);requestAnimationFrame(updateMenuRect)}} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0);requestAnimationFrame(updateMenuRect)}} style={{width:"100%",boxSizing:"border-box",border:"1px solid #cbd5e1",borderRadius:7,padding:"9px 10px",font:"inherit",background:"#fff",...style}}/>
    {open&&createPortal(<div role="listbox" style={{position:"fixed",top:menuRect?.top??0,left:menuRect?.left??0,width:menuRect?.width??"100%",maxHeight:menuRect?.maxHeight??230,overflowY:"auto",zIndex:99999,background:"#fff",border:"1px solid #cbd5e1",borderRadius:8,boxShadow:"0 12px 28px rgba(15,23,42,.16)"}}>
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(null)} style={{display:"block",width:"100%",textAlign:"left",padding:"9px 10px",border:0,background:"#f8fafc",cursor:"pointer",font:"inherit",color:"#64748b"}}>{placeholder}</button>
      {filtered.map((option,i)=><button type="button" role="option" aria-selected={i===active} key={String(option.value)} onMouseEnter={()=>setActive(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(option)} style={{display:"block",width:"100%",textAlign:"left",padding:"9px 10px",border:0,borderTop:"1px solid #eef2f7",background:i===active?"#e8f2ff":"#fff",cursor:"pointer",font:"inherit",color:"#182b3b"}}>{option.label}</button>)}
      {!filtered.length&&<div style={{padding:10,color:"#64748b"}}>No matching names found</div>}
    </div>, document.body)}
  </div>;
}

export default function AccountsTransactionCenter({ initialTab="purchase" }) {
  const [tab,setTab]=useState(initialTab);
  const [bomSection,setBomSection]=useState("masters");
  const [masterModal,setMasterModal]=useState(null);
  const openMaster=(type,mode="create",editId="")=>setMasterModal({type,mode,editId});
  const [m,setM]=useState({items:[],locations:[],suppliers:[],customers:[]});
  const locationLabel=value=>m.locations.find(location=>String(location._id)===String(value))?.name||value||"-";
  const [stock,setStock]=useState([]), [docs,setDocs]=useState([]), [ledger,setLedger]=useState([]), [jobs,setJobs]=useState([]), [allJobs,setAllJobs]=useState([]), [selectedJob,setSelectedJob]=useState(null);
  const [stockDetail,setStockDetail]=useState(null), [stockMovements,setStockMovements]=useState([]), [stockDetailLoading,setStockDetailLoading]=useState(false);
  const [jobHistoryLoading,setJobHistoryLoading]=useState(false);
  const [msg,setMsg]=useState(""), [err,setErr]=useState(""), [busy,setBusy]=useState(false);
  const [purchase,setPurchase]=useState({date:today(),location:"",supplierId:"",supplierLedgerId:"",supplierName:"",supplierGSTIN:"",supplierInvoiceNo:"",supplierInvoiceDate:"",transportCost:0,otherCost:0,remarks:""});
  const [pLines,setPLines]=useState([blankLine()]);
  const [purchaseEditId,setPurchaseEditId]=useState("");
  const [purchaseEditNo,setPurchaseEditNo]=useState("");
  const [purchaseRows,setPurchaseRows]=useState([]);
  const [purchaseHistoryLoading,setPurchaseHistoryLoading]=useState(false);
  const [sale,setSale]=useState({date:today(),location:"",partyId:"",customerName:"",customerGSTIN:"",customerState:"",supplierState:"",placeOfSupply:"",remarks:""});
  const [sLines,setSLines]=useState([blankLine("FINISHED_GOODS")]);
  const [job,setJob]=useState({date:today(),type:"GRADING",location:"",partyId:"",labourCost:0,transportCost:0,otherCost:0,notes:""});
  const [jobReturn,setJobReturn]=useState({jobId:"",date:today(),notes:""});
  const [jobReturnLines,setJobReturnLines]=useState([]);
  const [sources,setSources]=useState([blankLine("RAW_MATERIAL")]), [outputs,setOutputs]=useState([blankLine("GRADE")]);
  const [pi,setPi]=useState({date:today(),location:"",partyId:"",referenceNo:"",notes:""}), [piLines,setPiLines]=useState([blankLine("FINISHED_GOODS")]);
  const [ret,setRet]=useState({date:today(),docType:"SALE_RETURN",location:"",partyId:"",referenceNo:"",notes:""}), [retLines,setRetLines]=useState([blankLine("FINISHED_GOODS")]);
  const [damage,setDamage]=useState({date:today(),location:"",notes:""}), [damageLines,setDamageLines]=useState([blankLine("FINISHED_GOODS")]);
  const [repack,setRepack]=useState({date:today(),location:"",notes:""}), [repackSrc,setRepackSrc]=useState([blankLine("RETURN_GOODS")]), [repackOut,setRepackOut]=useState([blankLine("PACKED_GOODS")]);
  const [pack,setPack]=useState({date:today(),location:"",conversionCharge:0,notes:""}), [packSrc,setPackSrc]=useState([blankLine("RAW_MATERIAL")]), [packOut,setPackOut]=useState([blankLine("PACKED_GOODS")]);
  const [stockType,setStockType]=useState("RAW_MATERIAL"), [stockLocation,setStockLocation]=useState("");
  const [bom,setBom]=useState({name:"",outputItemId:"",outputQty:1,labourCost:0,packingCost:0,otherCost:0,materials:[{itemId:"",itemName:"",qtyPerUnit:1,rate:0}],costItems:[]});
  const [bomCostItemMasters,setBomCostItemMasters]=useState([]);
  const [costMasterForm,setCostMasterForm]=useState({name:"",unit:"g",standardRate:"",rateSource:"STANDARD",quantityMultiplier:1});
  const [editingCostMasterId,setEditingCostMasterId]=useState("");
  const [cost,setCost]=useState({outputQty:1,labourCost:0,packingCost:0,otherCost:0,materials:[{name:"",qty:1,rate:0}]});
  const [costResult,setCostResult]=useState(null);
  const bomCostItemsTotal=(bom.costItems||[]).reduce((sum,item)=>sum+bomCostAmount(item.qty,item.unit,item.rate),0);
  const bomMaterialTotal=(bom.materials||[]).reduce((sum,item)=>sum+n(item.qtyPerUnit)*n(item.rate),0);
  const bomEstimatedUnitCost=(bomMaterialTotal+bomCostItemsTotal+n(bom.labourCost)+n(bom.packingCost)+n(bom.otherCost))/(n(bom.outputQty)||1);
  const [boms,setBoms]=useState([]), [bomOutputQty,setBomOutputQty]=useState(1), [bomLoading,setBomLoading]=useState(false), [bomAllocations,setBomAllocations]=useState([]);
  const jobBomRequest=useRef(0);
  const bomPurchaseRequest=useRef(0);
  const [bomPurchasePicker,setBomPurchasePicker]=useState(null);

  useEffect(()=>{setTab(initialTab || "purchase")},[initialTab]);
  useEffect(()=>{
    setBom(current=>{
      let changed=false;
      const costItems=(current.costItems||[]).map(line=>{
        const master=bomCostItemMasters.find(item=>String(item._id)===String(line.masterId));
        if(!master)return line;
        const qty=costItemQuantity(master,current.outputItemId,current.outputQty,current.materials);
        const rate=costItemRate(master,current.materials),rateSource=master.rateSource||"STANDARD";
        if(line.name===master.name&&line.unit===master.unit&&n(line.rate)===rate&&line.rateSource===rateSource&&n(line.quantityMultiplier)===n(master.quantityMultiplier??1)&&n(line.qty)===qty)return line;
        changed=true;
        return {...line,name:master.name,unit:master.unit,rate,rateSource,quantityMultiplier:master.quantityMultiplier??1,qty};
      });
      return changed?{...current,costItems}:current;
    });
  },[bom.outputItemId,bom.outputQty,bom.materials,bomCostItemMasters,m.items]);
  useEffect(()=>{loadMasters();loadCostItemMasters();},[]);
  useEffect(()=>{if(tab==="stock")loadStock(); if(tab==="documents")loadDocs(); if(tab==="production")loadJobs(); if(tab==="job"||tab==="job-history"||tab==="job-return")loadJobs(); if(tab==="purchase"||tab==="purchase-history")loadPurchaseHistory();},[tab,stockType,stockLocation]);

  async function get(path){const r=await fetch(`${API}${path}`,{headers:auth()});const d=await r.json();if(!r.ok)throw Error(d.message||"Request failed");return d;}
  async function post(path,body){const r=await fetch(`${API}${path}`,{method:"POST",headers:auth(),body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.message||"Save failed");return d;}
  async function put(path,body){const r=await fetch(`${API}${path}`,{method:"PUT",headers:auth(),body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.message||"Update failed");return d;}
  async function loadCostItemMasters(){try{const d=await get("/api/inventory/workflow/bom-cost-items");setBomCostItemMasters(d.items||[])}catch(e){setErr(e.message)}}
  async function loadMasters(){try{const [d,b,p]=await Promise.all([get("/api/inventory/workflow/masters"),get("/api/inventory/workflow/boms"),get("/api/inventory/raw-material-masters")]);const accountMasters=await Promise.allSettled(["party","supplier","ledger"].map(type=>get(`/api/accounts-masters?type=${type}`)));const options=new Map();for(const row of [...(d.customers||[]),...(d.suppliers||[]),...accountMasters.flatMap(result=>result.status==="fulfilled"?(result.value.data||result.value.masters||[]):[])]){const name=String(row.name||"").trim(),key=name.toLowerCase();if(name&&key&&!options.has(key))options.set(key,{...row,name})}setM({...d,creditorLedgers:p.creditorLedgers||[],jobParties:[...options.values()]});setBoms(b.items||[])}catch(e){setErr(e.message)}}
  async function loadPurchaseHistory(){setPurchaseHistoryLoading(true);try{const d=await get("/api/inventory/raw-material-purchases?page=1&limit=100");setPurchaseRows(d.items||[])}catch(e){setErr(e.message)}finally{setPurchaseHistoryLoading(false)}}
  async function loadStock(){try{const d=await get(`/api/inventory/stock?itemType=${encodeURIComponent(stockType)}${stockLocation?`&location=${encodeURIComponent(stockLocation)}`:""}&limit=200`);setStock(d.items||[])}catch(e){setErr(e.message)}}
  async function showStockMovements(item){setStockDetail(item);setStockMovements([]);setStockDetailLoading(true);try{const params=new URLSearchParams({itemType:item.itemType,itemName:item.itemName,location:item.location,batchNo:item.batchNo||"",barcode:item.barcode||""});const d=await get(`/api/inventory/workflow/stock-ledger?${params}`);setStockMovements(d.items||[])}catch(e){setErr(e.message)}finally{setStockDetailLoading(false)}}
  async function loadDocs(){try{const d=await get("/api/inventory/workflow/documents");setDocs(d.items||[]);const l=await get("/api/inventory/workflow/stock-ledger");setLedger(l.items||[])}catch(e){setErr(e.message)}}
  async function loadJobs(){setJobHistoryLoading(true);try{const d=await get("/api/inventory/job-orders");setJobs((d.items||[]).filter(x=>x.status==="POSTED"));setAllJobs(d.items||[])}catch(e){setErr(e.message)}finally{setJobHistoryLoading(false)}}
  function resetFeedback(){setMsg("");setErr("")}
  async function submit(path,body,after){setBusy(true);resetFeedback();try{const isPurchase=path==="/api/inventory/raw-material-purchases",isJobReturn=path.includes("/job-orders/")&&path.endsWith("/returns"),url=isPurchase&&purchaseEditId?`${path}/${purchaseEditId}`:path,d=isPurchase&&purchaseEditId?await put(url,body):await post(url,body);setMsg(d.message||"Saved successfully.");after?.();await loadMasters();if(isPurchase){setPurchaseEditId("");setPurchaseEditNo("");setTab("purchase");await loadPurchaseHistory()}if(isJobReturn){setJobReturn({jobId:"",date:today(),notes:""});setJobReturnLines([]);setTab("job-history");await loadJobs()}}catch(e){setErr(e.message)}finally{setBusy(false)}}
  function selectJobForReturn(jobId){const selected=allJobs.find(x=>String(x._id)===String(jobId));setJobReturn(current=>({...current,jobId}));setJobReturnLines((selected?.sourceItems||[]).filter(x=>n(x.remainingReturnQty)>0).map(x=>({...blankLine("RAW_MATERIAL"),itemId:String(x.itemId||""),itemName:x.itemName,itemType:"RAW_MATERIAL",unit:x.unit||"KG",qty:0,rate:n(x.rate),batchNo:x.batchNo||"",barcode:x.barcode||"",remainingReturnQty:n(x.remainingReturnQty)})))}
  function editPurchase(row){const supplier=supplierOpts.find(x=>String(x._id)===String(row.supplierId))||supplierOpts.find(x=>x.name===row.supplierName);setPurchaseEditId(row._id);setPurchaseEditNo(row.purchaseNo);setPurchase({date:String(row.date||today()).slice(0,10),location:row.location||"",supplierId:supplier?._id||String(row.supplierId||""),supplierName:row.supplierName||"",supplierGSTIN:row.supplierGSTIN||"",supplierInvoiceNo:row.supplierInvoiceNo||"",supplierInvoiceDate:row.supplierInvoiceDate?String(row.supplierInvoiceDate).slice(0,10):"",transportCost:row.transportCost||0,otherCost:row.otherCost||0,remarks:row.remarks||""});setPLines((row.lines||[]).map(line=>({...blankLine("RAW_MATERIAL"),itemId:String(line.itemId||m.items.find(x=>x.name===line.itemName)?._id||""),itemName:line.itemName||"",itemType:"RAW_MATERIAL",unit:line.unit||"KG",qty:n(line.qty),rate:n(line.purchaseRate),batchNo:line.batchNo||"",barcode:line.barcode||"",gstRate:n(line.gstRate),gstType:line.gstType||"NONE",value:n(line.lineTotal)})));setTab("purchase");resetFeedback()}
  async function deletePurchase(row){if(!window.confirm(`Delete purchase ${row.purchaseNo}? Stock and accounting records will also be removed.`))return;setBusy(true);resetFeedback();try{const r=await fetch(`${API}/api/inventory/raw-material-purchases/${row._id}`,{method:"DELETE",headers:auth()});const d=await r.json();if(!r.ok)throw Error(d.message||"Delete failed");if(purchaseEditId===row._id){setPurchaseEditId("");setPurchaseEditNo("")}setMsg(d.message||"Purchase deleted.");await loadPurchaseHistory()}catch(e){setErr(e.message)}finally{setBusy(false)}}
  const rawItems=useMemo(()=>m.items.filter(x=>["RAW_MATERIAL","RAW"].includes(String(x.itemType||x.type||"").toUpperCase())),[m.items]);
  const gradeItems=useMemo(()=>m.items.filter(x=>["GRADE","GRADE_STOCK"].includes(String(x.itemType||x.type||"").toUpperCase())),[m.items]);
  const fgItems=useMemo(()=>m.items.filter(x=>["FINISHED_GOODS","FINISHED_PRODUCT","FINISHED","PACKED_GOODS"].includes(String(x.itemType||x.type||"").toUpperCase())),[m.items]);
  const allItems=m.items;
  const locOpts=m.locations||[];
  const supplierRows=m.suppliers||[];
  const creditorLedgerOpts=m.creditorLedgers||[];
  const purchasePartyOpts=[...supplierRows,...creditorLedgerOpts.filter(ledger=>!supplierRows.some(supplier=>supplier.name.trim().toLowerCase()===ledger.name.trim().toLowerCase()))];
  const supplierOpts=tab==="purchase"||tab==="purchase-history"?purchasePartyOpts:supplierRows;
  const customerOpts=m.customers||[];
  const itemOptions=(type)=>type==="RAW_MATERIAL"?rawItems:type==="GRADE"?gradeItems:type==="FINISHED_GOODS"?fgItems:allItems;
  const setLine=(setter,index,key,value)=>setter(a=>a.map((x,i)=>i===index?{...x,[key]:value}:x));
  const chooseItem=(setter,i,id)=>{const item=m.items.find(x=>x._id===id); if(!item)return; setter(a=>a.map((x,j)=>j===i?{...x,itemId:item._id,itemName:item.name,itemType:item.itemType,unit:item.unit||"KG",rate:x.rate||0,gstRate:item.defaultGstRate||0,gstType:n(item.defaultGstRate)>0&&x.gstType==="NONE"?"CGST_SGST":x.gstType}:x))};
  async function chooseBomMaterial(i,id){
    const item=m.items.find(x=>x._id===id);
    if(!item)return;
    const requestId=++bomPurchaseRequest.current;
    setBom(b=>({...b,materials:b.materials.map((q,j)=>j===i?{...q,itemId:id,itemName:item.name,unit:item.unit||"KG",rate:0}:q)}));
    setBomPurchasePicker({index:i,itemId:id,itemName:item.name,loading:true,options:[]});
    try{
      const [purchaseData,jobData]=await Promise.all([
        get(`/api/inventory/raw-material-purchases?page=1&limit=100&search=${encodeURIComponent(item.name)}`),
        get("/api/inventory/job-orders")
      ]);
      const matchingLines=(purchaseData.items||[]).flatMap(purchase=>(purchase.lines||[])
        .filter(line=>String(line.itemId||"")===String(id)||line.itemName?.trim().toLowerCase()===item.name.trim().toLowerCase())
        .map(line=>({purchase,line,remainingQty:n(line.qty)})));
      const lotByKey=new Map(matchingLines.map(lot=>[`${lot.purchase._id}:${lot.line._id}`,lot]));
      const unallocatedIssues=[];
      const jobs=[...(jobData.items||[])].filter(job=>job.status!=="CANCELLED").sort((a,b)=>new Date(a.date)-new Date(b.date));
      for(const job of jobs){
        for(const source of job.sourceItems||[]){
          if(String(source.itemId||"")!==String(id)&&source.itemName?.trim().toLowerCase()!==item.name.trim().toLowerCase())continue;
          const allocations=source.purchaseAllocations||[];
          let returned=n(source.returnedQty);
          for(const allocation of [...allocations].reverse()){
            const lot=lotByKey.get(`${allocation.purchaseId}:${allocation.lineId}`);
            const returnedFromLot=Math.min(returned,n(allocation.qty));
            if(lot)lot.remainingQty=Math.max(0,lot.remainingQty-n(allocation.qty)+returnedFromLot);
            returned-=returnedFromLot;
          }
          const allocatedQty=allocations.reduce((sum,allocation)=>sum+n(allocation.qty),0);
          const manualQty=Math.max(0,n(source.qty)-allocatedQty-returned);
          if(manualQty>0)unallocatedIssues.push({location:job.location,qty:manualQty});
        }
      }
      for(const issue of unallocatedIssues){
        let remaining=issue.qty;
        for(const lot of matchingLines.filter(x=>x.purchase.location===issue.location).sort((a,b)=>new Date(a.purchase.date)-new Date(b.purchase.date))){
          const used=Math.min(remaining,lot.remainingQty);
          lot.remainingQty-=used;
          remaining-=used;
          if(remaining<=0.000001)break;
        }
      }
      if(requestId===bomPurchaseRequest.current)setBomPurchasePicker(current=>current?.itemId===id?{...current,loading:false,options:matchingLines.map(({purchase,line,remainingQty})=>({purchaseId:purchase._id,lineId:line._id,purchaseNo:purchase.purchaseNo,date:purchase.date,supplierName:purchase.supplierName,location:purchase.location,unit:line.unit||"KG",purchaseQty:n(line.qty),remainingQty:Math.round((remainingQty+Number.EPSILON)*1000)/1000,rate:n(line.purchaseRate),batchNo:line.batchNo||"",barcode:line.barcode||""}))}:current);
    }catch(e){
      if(requestId===bomPurchaseRequest.current)setBomPurchasePicker(current=>current?.itemId===id?{...current,loading:false,error:e.message}:current);
    }
  }
  function chooseBomPurchase(option){
    const index=bomPurchasePicker?.index;
    if(index==null)return;
    setBom(b=>({...b,materials:b.materials.map((line,i)=>i===index?{...line,rate:option.rate,unit:option.unit,purchaseId:option.purchaseId,purchaseLineId:option.lineId,purchaseNo:option.purchaseNo,supplierName:option.supplierName,purchaseDate:option.date}:line)}));
    setBomPurchasePicker(null);
  }
  function costItemQuantity(master,outputItemId,outputQty,materials=[]){
    const unit=String(master?.unit||"").trim().toLowerCase();
    const multiplier=n(master?.quantityMultiplier??1);
    const materialGrams=materials.reduce((sum,line)=>{
      const materialUnit=String(line.unit||"").trim().toLowerCase();
      const factor=["kg","kgs","kilogram","kilograms"].includes(materialUnit)?1000:["g","gm","gram","grams"].includes(materialUnit)?1:materialUnit==="mg"?0.001:0;
      return sum+n(line.qtyPerUnit)*factor;
    },0);
    const packageGrams=materialGrams||packageWeightGrams(m.items.find(item=>String(item._id)===String(outputItemId))?.name)*(n(outputQty)||1);
    const count=n(outputQty)||1;
    if(["pkt","pack","packet","pcs","pc","piece","pieces","ea"].includes(unit))return round2(count*multiplier);
    if(["g","gm","gram","grams"].includes(unit))return packageGrams?round2(packageGrams*multiplier):null;
    if(["kg","kgs","kilogram","kilograms"].includes(unit))return packageGrams?round2(packageGrams*multiplier/1000):null;
    return round2(count*multiplier);
  }
  function bomMaterialRatePerKg(materials=[]){
    const factors={kg:1,kgs:1,kilogram:1,kilograms:1,g:0.001,gm:0.001,gram:0.001,grams:0.001,mg:0.000001};
    let totalKg=0,totalValue=0;
    for(const line of materials){
      const factor=factors[String(line.unit||"").trim().toLowerCase()];
      if(!factor)continue;
      const qty=n(line.qtyPerUnit);
      totalKg+=qty*factor;
      totalValue+=qty*n(line.rate);
    }
    return totalKg?round2(totalValue/totalKg):0;
  }
  function costItemRate(master,materials=[]){
    return master?.rateSource==="BOM_MATERIAL"?bomMaterialRatePerKg(materials):n(master?.standardRate);
  }
  function chooseBomOutput(id){
    setBom(current=>({...current,outputItemId:id,costItems:(current.costItems||[]).map(line=>{
      const master=bomCostItemMasters.find(item=>String(item._id)===String(line.masterId));
      return master?{...line,name:master.name,unit:master.unit,rate:costItemRate(master,current.materials),rateSource:master.rateSource||"STANDARD",quantityMultiplier:master.quantityMultiplier??1,qty:costItemQuantity(master,id,current.outputQty,current.materials)}:line;
    })}));
  }
  function updateBomOutputQty(value){
    setBom(current=>({...current,outputQty:value,costItems:(current.costItems||[]).map(line=>{
      const master=bomCostItemMasters.find(item=>String(item._id)===String(line.masterId));
      return master?{...line,rate:costItemRate(master,current.materials),rateSource:master.rateSource||"STANDARD",quantityMultiplier:master.quantityMultiplier??1,qty:costItemQuantity(master,current.outputItemId,value,current.materials)}:line;
    })}));
  }
  function chooseBomCostItem(index,masterId){
    const master=bomCostItemMasters.find(item=>String(item._id)===String(masterId));
    if(!master)return;
    setBom(current=>({...current,costItems:current.costItems.map((line,rowIndex)=>rowIndex===index?{masterId:master._id,name:master.name,unit:master.unit,rate:costItemRate(master,current.materials),rateSource:master.rateSource||"STANDARD",quantityMultiplier:master.quantityMultiplier??1,qty:costItemQuantity(master,current.outputItemId,current.outputQty,current.materials)}:line)}));
  }
  function editCostItemMaster(item){
    setEditingCostMasterId(item._id);
    setCostMasterForm({name:item.name,unit:item.unit,standardRate:String(item.standardRate??""),rateSource:item.rateSource||"STANDARD",quantityMultiplier:String(item.quantityMultiplier??1)});
    resetFeedback();
  }
  async function saveCostItemMaster(){
    resetFeedback();
    try{
      const path=`/api/inventory/workflow/bom-cost-items${editingCostMasterId?`/${editingCostMasterId}`:""}`;
      const data=editingCostMasterId?await put(path,costMasterForm):await post(path,costMasterForm);
      setMsg(data.message||"Cost item master saved.");
      setEditingCostMasterId("");
      setCostMasterForm({name:"",unit:"g",standardRate:"",rateSource:"STANDARD",quantityMultiplier:1});
      await loadCostItemMasters();
    }catch(e){setErr(e.message)}
  }
  async function deleteCostItemMaster(item){
    if(!window.confirm(`Deactivate cost item master ${item.name}?`))return;
    resetFeedback();
    try{
      const response=await fetch(`${API}/api/inventory/workflow/bom-cost-items/${item._id}`,{method:"DELETE",headers:auth()});
      const data=await response.json();
      if(!response.ok)throw Error(data.message||"Cost item master delete failed.");
      setMsg(data.message||"Cost item master deactivated.");
      await loadCostItemMasters();
    }catch(e){setErr(e.message)}
  }
  function editBom(row){
    setBom({...row,outputItemId:String(row.outputItemId||""),materials:(row.materials||[]).map(line=>({...line,itemId:String(line.itemId||""),qtyPerUnit:n(line.qtyPerUnit),rate:n(line.rate)})),costItems:(row.costItems||[]).map(line=>({...line,qty:n(line.qty),rate:n(line.rate),rateSource:line.rateSource||"STANDARD"}))});
    setBomSection("entry");
    setTab("bom");
    resetFeedback();
    setMsg(`Editing ${row.name}. Save BOM will update this recipe.`);
  }
  async function loadBomForJob({silent=false}={}){
    const outputId=outputs[0]?.itemId,qty=n(bomOutputQty);
    if(!job.location||!outputId||qty<=0){if(!silent)setErr(!job.location?"Select Location first.":!outputId?"Select Finished Good in Planned Output first.":"Enter production quantity.");return}
    const requestId=++jobBomRequest.current;
    setBomLoading(true);
    if(!silent)resetFeedback();
    try{
      const d=await get(`/api/inventory/production-requirements?outputItemId=${encodeURIComponent(outputId)}&qty=${encodeURIComponent(qty)}&location=${encodeURIComponent(job.location)}`);
      if(requestId!==jobBomRequest.current)return;
      setSources((d.materials||[]).map(x=>({...blankLine("RAW_MATERIAL"),itemId:x.itemId||"",itemName:x.itemName,itemType:"RAW_MATERIAL",unit:x.unit||"KG",qty:x.requiredQty,rate:x.rate||0,value:x.value,purchaseAllocations:x.purchaseAllocation||[]})));
      setOutputs(a=>a.map((x,i)=>i===0?{...x,qty,unit:d.bom?.outputUnit||x.unit||"PCS"}:x));
      setBomAllocations(d.materials||[]);
      if(!d.ready)setErr("BOM loaded, but some Raw Material quantity is pending/short.");
      else setMsg(`BOM ${d.bom?.name||""} loaded. Raw quantity and purchase-wise rate allocated automatically.`);
    }catch(e){
      if(requestId!==jobBomRequest.current)return;
      const output=m.items.find(x=>String(x._id)===String(outputId));
      const weight=e.message.includes("Active BOM not found")?output?.name?.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|grams?)\b/i):null;
      const rawName=weight?output.name.replace(weight[0],"").replace(/[\s-]+$/," ").trim():"";
      const rawItem=rawName?rawItems.find(x=>x.name.trim().toLowerCase()===rawName.toLowerCase()):null;
      if(rawItem&&weight){
        const requiredQty=Math.round((Number(weight[1])*qty/1000+Number.EPSILON)*1000)/1000;
        setSources([{...blankLine("RAW_MATERIAL"),itemId:rawItem._id,itemName:rawItem.name,itemType:"RAW_MATERIAL",unit:"KG",qty:requiredQty,rate:0,value:0}]);
        setBomAllocations([]);
        setMsg(`Source quantity calculated from ${weight[1]} g × ${qty} units = ${requiredQty} KG.`);
      }else{
        setErr(e.message);
      }
    }finally{if(requestId===jobBomRequest.current)setBomLoading(false)}
  }
  useEffect(()=>{
    if(job.type!=="FINISHED_GOODS")return;
    if(!job.location||!outputs[0]?.itemId||n(bomOutputQty)<=0){jobBomRequest.current+=1;return}
    const timer=setTimeout(()=>loadBomForJob({silent:true}),200);
    return()=>{clearTimeout(timer);jobBomRequest.current+=1};
  },[job.type,job.location,outputs[0]?.itemId,bomOutputQty]);
  const lineValue=x=>n(x.qty)*n(x.rate);
  const purchaseTaxForLine=line=>{
    const taxable=round2(n(line.qty)*n(line.rate));
    const gst= line.gstType==="NONE"?0:round2(taxable*n(line.gstRate)/100);
    const cgst=line.gstType==="CGST_SGST"?round2(gst/2):0;
    const sgst=line.gstType==="CGST_SGST"?round2(gst-cgst):0;
    const igst=line.gstType==="IGST"?gst:0;
    return {taxable,cgst,sgst,igst,gst,total:round2(taxable+cgst+sgst+igst)};
  };
  const purchaseTotals=useMemo(()=>{
    const totals=pLines.reduce((sum,line)=>{
      const tax=purchaseTaxForLine(line);
      return {taxable:sum.taxable+tax.taxable,cgst:sum.cgst+tax.cgst,sgst:sum.sgst+tax.sgst,igst:sum.igst+tax.igst};
    },{taxable:0,cgst:0,sgst:0,igst:0});
    const subtotal=round2(totals.taxable),cgst=round2(totals.cgst),sgst=round2(totals.sgst),igst=round2(totals.igst),transport=n(purchase.transportCost),other=n(purchase.otherCost);
    return {subtotal,cgst,sgst,igst,transport,other,grandTotal:round2(subtotal+cgst+sgst+igst+transport+other)};
  },[pLines,purchase.transportCost,purchase.otherCost]);
  const lineTableHelpers=useRef({});
  lineTableHelpers.current={itemOptions,chooseItem,setLine,lineValue,purchaseTaxForLine,purchaseTotals};
  const LineTable=useMemo(()=>function LineTable({lines,setter,allowedTypes,title}){
    const {itemOptions,chooseItem,setLine,lineValue,purchaseTaxForLine,purchaseTotals}=lineTableHelpers.current;
    const showGst=setter===setPLines;
    const options=[...new Map(allowedTypes.flatMap(t=>itemOptions(t)).map(x=>[x._id,x])).values()];
    return <><div className="tx-table-wrap tx-line-table-wrap"><table className="tx-table tx-line-table" style={{width:"100%",minWidth:showGst?1120:760,tableLayout:"fixed",borderCollapse:"separate",borderSpacing:0}}><colgroup><col style={{width:showGst?"21%":"35%"}}/><col style={{width:showGst?"7%":"10%"}}/><col style={{width:showGst?"6%":"9%"}}/><col style={{width:showGst?"8%":"12%"}}/>{showGst&&<><col style={{width:"6%"}}/><col style={{width:"10%"}}/><col style={{width:"7%"}}/><col style={{width:"7%"}}/><col style={{width:"7%"}}/><col style={{width:"9%"}}/></>}<col style={{width:showGst?"9%":"12%"}}/><col style={{width:"3%"}}/></colgroup><thead><tr><th>{title||"Item"}</th><th>Qty</th><th>Unit</th><th>Rate</th>{showGst&&<><th>GST %</th><th>GST Type</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total GST</th></>}<th>Value</th><th></th></tr></thead><tbody>{lines.map((x,i)=>{const tax=showGst?purchaseTaxForLine(x):null;return <tr key={i}><td><SearchableSelect value={x.itemId||""} placeholder="Search item name" masterType="product" onOpenMaster={openMaster} options={options.map(o=>({value:o._id,label:`${o.name} · ${o.itemType}`}))} onChange={e=>chooseItem(setter,i,e.target.value)}/></td><td><input type="number" min="0" step="0.001" inputMode="decimal" value={x.qty ?? ""} onChange={e=>setLine(setter,i,"qty",e.target.value)} style={{width:"100%",minWidth:0,padding:"6px 4px",fontSize:12,textAlign:"right",boxSizing:"border-box",color:"#172b4d",background:"#fff"}}/></td><td><input value={x.unit||"KG"} onChange={e=>setLine(setter,i,"unit",e.target.value)} style={{width:"100%",minWidth:0,padding:"6px 4px",fontSize:12,boxSizing:"border-box",color:"#172b4d",background:"#fff"}}/></td><td><input type="number" min="0" step="0.01" inputMode="decimal" value={x.rate ?? ""} onChange={e=>setLine(setter,i,"rate",e.target.value)} style={{width:"100%",minWidth:0,padding:"6px 4px",fontSize:12,textAlign:"right",boxSizing:"border-box",color:"#172b4d",background:"#fff"}}/></td>{showGst&&<><td><input type="number" min="0" max="100" step="0.01" value={x.gstRate??""} onChange={e=>setLine(setter,i,"gstRate",e.target.value)} style={{width:"100%",minWidth:0,padding:"6px 3px",fontSize:11,textAlign:"right",boxSizing:"border-box"}}/></td><td><select value={x.gstType||"NONE"} onChange={e=>setLine(setter,i,"gstType",e.target.value)} style={{width:"100%",minWidth:0,padding:"6px 2px",fontSize:10,boxSizing:"border-box",whiteSpace:"normal"}}><option value="NONE">None</option><option value="CGST_SGST">CGST + SGST</option><option value="IGST">IGST</option></select></td><td>₹ {money(tax.cgst)}</td><td>₹ {money(tax.sgst)}</td><td>₹ {money(tax.igst)}</td><td><b>₹ {money(tax.gst)}</b></td></>}<td style={{whiteSpace:"nowrap",fontSize:11,textAlign:"right",padding:"6px 3px"}}>₹ {money(lineValue(x))}</td><td style={{padding:"4px 2px",textAlign:"center"}}><button type="button" className="tx-mini-danger" onClick={()=>setter(a=>a.filter((_,j)=>j!==i))}>×</button></td></tr>})}</tbody></table></div>{showGst&&<div className="tx-kpis" style={{marginTop:12}}><div className="tx-kpi"><b>Subtotal</b><strong>₹ {money(purchaseTotals.subtotal)}</strong></div><div className="tx-kpi"><b>Total CGST</b><strong>₹ {money(purchaseTotals.cgst)}</strong></div><div className="tx-kpi"><b>Total SGST</b><strong>₹ {money(purchaseTotals.sgst)}</strong></div><div className="tx-kpi"><b>Total IGST</b><strong>₹ {money(purchaseTotals.igst)}</strong></div><div className="tx-kpi"><b>Transport + Other</b><strong>₹ {money(purchaseTotals.transport+purchaseTotals.other)}</strong></div><div className="tx-kpi"><b>Grand Total</b><strong>₹ {money(purchaseTotals.grandTotal)}</strong></div></div>}</>
  },[]);
  function addLine(setter,type){setter(a=>[...a,blankLine(type)])}
  const commonSelect=(value,onChange,opts,placeholder)=> {const choices=placeholder==="Select customer / party"?m.jobParties||opts:opts;const masterType=/location/i.test(placeholder||"")?"location":/supplier/i.test(placeholder||"")?"supplier":/customer|party/i.test(placeholder||"")?"party":"product";const handleChange=placeholder==="Select output"?event=>chooseBomOutput(event.target.value):onChange;return <SearchableSelect value={value||""} onChange={handleChange} placeholder={placeholder||"Search name"} masterType={masterType} onOpenMaster={openMaster} options={choices.map(x=>({value:x._id,label:x.name}))}/>};
  const bomHistoryContent=<div className="tx-card"><div className="tx-title"><div><h3>BOM History</h3><p>Saved product recipes and costing</p></div><button type="button" className="tx-btn" onClick={loadMasters}>Refresh</button></div><div className="tx-table-wrap"><table className="tx-table"><thead><tr><th>BOM</th><th>Output Product</th><th>Output Qty</th><th>Materials</th><th>Cost Items</th><th>Cost / Unit</th><th></th></tr></thead><tbody>{boms.map(row=><tr key={row._id}><td><b>{row.name}</b></td><td>{row.outputItemName}</td><td>{row.outputQty} {row.outputUnit||""}</td><td>{(row.materials||[]).map(line=><div key={line.itemId||line.itemName}>{line.itemName}: {line.qtyPerUnit} {line.unit||"KG"} @ ₹ {money(line.rate)}</div>)}</td><td>{(row.costItems||[]).map((line,index)=><div key={`${line.name}-${index}`}>{line.name}: {line.qty} {line.unit} @ ₹ {money(line.rate)} = ₹ {money(line.cost)}</div>)}{!(row.costItems||[]).length?"-":null}</td><td>₹ {money(row.costPerUnit)}</td><td><button type="button" className="tx-btn" onClick={()=>editBom(row)}>Edit</button></td></tr>)}{!boms.length&&<tr><td colSpan="7">No BOM records found.</td></tr>}</tbody></table></div></div>;
  const purchaseHistoryContent=<div className="tx-card tx-purchase-history-card"><div className="tx-title" style={{marginBottom:10}}><h3>Purchase History</h3><button className="tx-btn" onClick={loadPurchaseHistory}>Refresh</button></div>{purchaseHistoryLoading?<div>Loading purchase history...</div>:<div className="tx-table-wrap"><table className="tx-table"><thead><tr><th>Purchase No.</th><th>Date</th><th>Supplier</th><th>Invoice No.</th><th>Location</th><th>Items</th><th>Total</th><th>Actions</th></tr></thead><tbody>{purchaseRows.map(row=><tr key={row._id}><td><b>{row.purchaseNo}</b></td><td>{new Date(row.date).toLocaleDateString("en-IN")}</td><td>{row.supplierName}</td><td>{row.supplierInvoiceNo||"-"}</td><td>{locationLabel(row.location)}</td><td>{(row.lines||[]).map(line=>`${line.itemName} × ${line.qty} ${line.unit||""}`).join(", ")}</td><td>₹ {money(row.grandTotal)}</td><td><div className="tx-subnav"><button className="tx-btn" disabled={busy} onClick={()=>editPurchase(row)}>Edit</button><button className="tx-btn danger" disabled={busy} onClick={()=>deletePurchase(row)}>Delete</button></div></td></tr>)}{!purchaseRows.length&&<tr><td colSpan="8">No purchase entries found.</td></tr>}</tbody></table></div>}</div>;
  const jobHistoryContent=<div className="tx-card"><div className="tx-title" style={{marginBottom:10}}><h3>Job Order History</h3><button className="tx-btn" onClick={loadJobs}>Refresh</button></div>{jobHistoryLoading?<div>Loading job order history...</div>:<div className="tx-table-wrap"><table className="tx-table"><thead><tr><th>Job No.</th><th>Date</th><th>Party</th><th>Type</th><th>Location</th><th>Raw Material Issue / Return</th><th>Finished Goods Progress</th><th>Status</th><th>Actions</th></tr></thead><tbody>{allJobs.map(j=><tr key={j._id}><td><b>{j.jobNo}</b></td><td>{new Date(j.date).toLocaleDateString("en-IN")}</td><td>{j.partyName||"-"}</td><td>{j.type}</td><td>{j.location}</td><td>{(j.sourceItems||[]).map(x=><div key={`${x.itemName}-${x.batchNo||""}-${x.barcode||""}`}>{x.itemName}: issued {x.qty} {x.unit}, returned {x.returnedQty||0}, remaining {x.remainingReturnQty??x.qty}</div>)}</td><td>{(j.remainingOutputItems||[]).map(x=><div key={x.itemName}>{x.itemName}: planned {x.qty}, produced {x.producedQty||0}, remaining {x.remainingQty}</div>)}</td><td>{j.status}</td><td><button className="tx-btn" disabled={busy} onClick={()=>{setSelectedJob(j);setTab("production")}}>Production</button></td></tr>)}{!allJobs.length&&<tr><td colSpan="9">No job orders found.</td></tr>}</tbody></table></div>}</div>;
  const jobReturnContent=<div className="tx-card"><div className="tx-title"><div><h3>Return Raw Material from Job Order</h3><p>Returned quantity is limited to raw material issued and not previously returned.</p></div></div><div className="tx-grid"><div className="tx-field"><label>Job Order</label><SearchableSelect value={jobReturn.jobId} placeholder="Search Job Order" options={allJobs.filter(x=>x.status!=="CANCELLED"&&(x.sourceItems||[]).some(line=>n(line.remainingReturnQty)>0)).map(x=>({value:x._id,label:`${x.jobNo} · ${x.partyName||"No party"} · ${x.location}`}))} onChange={e=>selectJobForReturn(e.target.value)}/></div><div className="tx-field"><label>Return Date</label><input type="date" value={jobReturn.date} onChange={e=>setJobReturn({...jobReturn,date:e.target.value})}/></div><div className="tx-field"><label>Notes</label><input value={jobReturn.notes} onChange={e=>setJobReturn({...jobReturn,notes:e.target.value})}/></div></div>{jobReturn.jobId&&<><h4>Returnable Raw Materials</h4>{jobReturnLines.length?<LineTable lines={jobReturnLines} setter={setJobReturnLines} allowedTypes={["RAW_MATERIAL"]}/>:<div className="tx-note">No raw material remains available to return for this job order.</div>}<div className="tx-actions"><button className="tx-btn primary" disabled={busy||!jobReturnLines.some(x=>n(x.qty)>0)} onClick={()=>submit(`/api/inventory/job-orders/${jobReturn.jobId}/returns`,{date:jobReturn.date,notes:jobReturn.notes,lines:jobReturnLines.filter(x=>n(x.qty)>0).map(x=>({...x,qty:n(x.qty)}))})}>{busy?"Posting return...":"Post Raw Material Return"}</button></div></>}</div>;

  return <div className={`tx-center ${tab === "bom" || tab === "bom-history" ? "tx-bom-workspace" : ""}`} onKeyDownCapture={e=>{if(e.key!=="Enter"||e.defaultPrevented)return;const target=e.target;if(target.closest?.(".tx-search-select"))return;if(target.tagName==="BUTTON"||target.tagName==="TEXTAREA"||target.type==="submit")return;if(target.tagName!=="INPUT"&&target.tagName!=="SELECT")return;e.preventDefault();focusNextTransactionField(e.currentTarget,target)}}>
    {bomPurchasePicker&&<div role="presentation" onClick={()=>setBomPurchasePicker(null)} style={{position:"fixed",inset:0,zIndex:1300,background:"rgba(13,31,33,.58)",display:"grid",placeItems:"center",padding:16}}><section role="dialog" aria-modal="true" aria-labelledby="bom-purchase-title" onClick={e=>e.stopPropagation()} style={{width:"min(900px,100%)",maxHeight:"85vh",overflow:"auto",background:"#fff",borderRadius:8,padding:18,boxShadow:"0 24px 70px rgba(0,0,0,.25)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><div><h3 id="bom-purchase-title" style={{margin:"0 0 4px"}}>Select Purchase Lot</h3><div style={{fontSize:13,color:"#667085"}}>{bomPurchasePicker.itemName} · choose rate and unit; enter BOM quantity manually</div></div><button type="button" className="tx-btn" onClick={()=>setBomPurchasePicker(null)}>Close</button></div>{bomPurchasePicker.loading?<p>Loading purchase details...</p>:bomPurchasePicker.error?<div className="tx-note err">{bomPurchasePicker.error}</div>:<div className="tx-table-wrap" style={{marginTop:14}}><table className="tx-table"><thead><tr><th>Purchase</th><th>Date</th><th>Supplier</th><th>Location</th><th>Batch</th><th>Purchased</th><th>Balance</th><th>Unit</th><th>Rate</th><th></th></tr></thead><tbody>{bomPurchasePicker.options.map(option=><tr key={`${option.purchaseId}:${option.lineId}`}><td>{option.purchaseNo}</td><td>{option.date?new Date(option.date).toLocaleDateString("en-IN"):"-"}</td><td>{option.supplierName||"-"}</td><td>{option.location||"-"}</td><td>{option.batchNo||"-"}</td><td>{money(option.purchaseQty)}</td><td><b>{money(option.remainingQty)}</b></td><td>{option.unit}</td><td>₹ {money(option.rate)}</td><td><button type="button" className="tx-btn primary" disabled={option.remainingQty<=0} onClick={()=>chooseBomPurchase(option)}>Select</button></td></tr>)}{!bomPurchasePicker.options.length&&<tr><td colSpan="10">No purchase records found for this material.</td></tr>}</tbody></table></div>}</section></div>}
    <style>{`
      .tx-center{font-family:Inter,Segoe UI,sans-serif;color:#182b3b;background:linear-gradient(135deg,#f2f7f5 0%,#f4f7fb 52%,#f8f6f1 100%);min-height:100%;padding:10px;--tx-ink:#182b3b;--tx-muted:#667085;--tx-green:#176b55;--tx-border:#dce5e2;--tx-surface:#fff}
      .tx-center .tx-card{border-color:var(--tx-border);border-radius:16px;box-shadow:0 10px 28px rgba(24,43,59,.07);padding:20px;transition:box-shadow .18s ease,border-color .18s ease}.tx-center .tx-card:hover{border-color:#c8dcd4;box-shadow:0 14px 34px rgba(24,43,59,.09)}.tx-center .tx-title h2,.tx-center h3{color:var(--tx-ink)}.tx-center h4{color:#31584f}.tx-center .tx-btn{transition:background .16s ease,border-color .16s ease,transform .16s ease}.tx-center .tx-btn:hover:not(:disabled){border-color:#176b55;transform:translateY(-1px)}.tx-center .tx-btn.primary{background:linear-gradient(135deg,#176b55,#21856a);border-color:#176b55;color:#fff;box-shadow:0 4px 10px rgba(23,107,85,.16)}.tx-center .tx-subnav{padding:6px;background:rgba(255,255,255,.82);border:1px solid #dce8e2;border-radius:14px;box-shadow:0 5px 16px rgba(24,43,59,.04);width:fit-content;max-width:100%}.tx-center .tx-subnav .tx-btn{border-radius:10px}.tx-center .tx-search-select input:focus{outline:0;border-color:#245a96;box-shadow:0 0 0 3px rgba(36,90,150,.14)}.tx-center .tx-field input:focus,.tx-center .tx-field select:focus,.tx-center .tx-field textarea:focus,.tx-center .tx-table input:focus,.tx-center .tx-table select:focus{outline:0;border-color:#21856a;box-shadow:0 0 0 3px rgba(33,133,106,.12)}.tx-center .tx-field label{font-size:12px;letter-spacing:.01em}.tx-center .tx-table-wrap{border:1px solid #e6eeea;border-radius:12px}.tx-center .tx-table th{position:sticky;top:0;z-index:1}.tx-center .tx-line-table{table-layout:fixed;min-width:880px}.tx-center .tx-line-table th:first-child,.tx-center .tx-line-table td:first-child{width:32%;min-width:280px}.tx-center .tx-line-table th:nth-child(2),.tx-center .tx-line-table td:nth-child(2){width:8%}.tx-center .tx-line-table th:nth-child(3),.tx-center .tx-line-table td:nth-child(3){width:8%}.tx-center .tx-line-table th:nth-child(4),.tx-center .tx-line-table td:nth-child(4){width:10%}.tx-center .tx-line-table th:not(:first-child),.tx-center .tx-line-table td:not(:first-child){overflow-wrap:anywhere}.tx-center .tx-line-table-wrap{overflow-x:auto;overflow-y:visible}.tx-center .tx-kpi{border-radius:13px;background:linear-gradient(145deg,#fff,#f2f8f5);border-color:#dce8e2}.tx-center .tx-kpi strong{color:#176b55}.tx-center .tx-note{border-radius:12px;border:1px solid transparent}.tx-center .tx-table tbody tr:hover{background:#f3f8f6}.tx-center .tx-table th{color:#36594f;background:#eff5f2}.tx-center .tx-table:has(th:first-child:nth-last-child(6)) th:first-child,.tx-center .tx-table:has(th:first-child:nth-last-child(12)) th:first-child{min-width:280px;width:34%}.tx-center .tx-table:has(th:first-child:nth-last-child(6)) th:not(:first-child),.tx-center .tx-table:has(th:first-child:nth-last-child(12)) th:not(:first-child){min-width:70px}.tx-center .tx-table:has(th:first-child:nth-last-child(6)) td:first-child,.tx-center .tx-table:has(th:first-child:nth-last-child(12)) td:first-child{min-width:280px}.tx-stock-qty{border:0;background:transparent;color:#176b55;font:inherit;font-weight:800;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:4px 6px}.tx-stock-overlay{position:fixed;inset:0;z-index:1200;background:rgba(13,31,33,.58);display:grid;place-items:center;padding:18px}.tx-stock-dialog{width:min(1080px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:10px;padding:20px;box-shadow:0 28px 80px rgba(0,0,0,.24)}.tx-stock-dialog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.tx-stock-dialog-head h2{margin:0;font-size:20px}.tx-stock-detail-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.tx-ledger-link{border:0;background:transparent;color:#176b55;font:inherit;font-weight:800;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
      .tx-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;padding:4px 2px}.tx-title h2{letter-spacing:-.025em}.tx-title p{line-height:1.5}.tx-title h2{margin:0;font-size:20px}.tx-title p{margin:4px 0 0;color:#667085;font-size:12px}
      .tx-card{background:linear-gradient(180deg,#fff 0%,#fcfefd 100%);border:1px solid #e4e7ec;border-radius:16px;padding:20px;margin-bottom:16px}.tx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.tx-field label{display:block;font-size:11px;font-weight:800;margin-bottom:5px;color:#344054}.tx-field.full{grid-column:1/-1}.tx-field input,.tx-field select,.tx-field textarea{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:8px;padding:9px 10px;font:inherit}.tx-field textarea{min-height:70px}.tx-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.tx-btn{border:1px solid #d0dcd6;background:#fff;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;transition:all .16s ease}.tx-btn:hover:not(:disabled){border-color:#176b55;background:#f4faf7}.tx-btn:disabled{opacity:.55;cursor:not-allowed}.tx-btn.primary{background:#245a96;color:#fff;border-color:#245a96}.tx-btn.danger{color:#b42318}.tx-note{padding:10px;border-radius:8px;margin-bottom:12px}.tx-note.ok{background:#ecfdf3;color:#027a48}.tx-note.err{background:#fef3f2;color:#b42318}.tx-table-wrap{overflow:auto}.tx-table{width:100%;border-collapse:collapse;font-size:12px}.tx-table th,.tx-table td{border-bottom:1px solid #eaf0ed;padding:10px;text-align:left;vertical-align:middle}.tx-table tbody tr:nth-child(even){background:#fbfdfc}.tx-table th{background:#f8fafc}.tx-table input,.tx-table select{min-width:90px;padding:7px;border:1px solid #d0d5dd;border-radius:6px}.tx-mini-danger{border:1px solid #fecdca;background:#fff;color:#b42318;border-radius:6px;padding:5px 8px;cursor:pointer}.tx-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.tx-kpi{background:#f8fafc;border:1px solid #e4e7ec;border-radius:10px;padding:12px}.tx-kpi b{display:block;color:#667085;font-size:11px}.tx-kpi strong{display:block;margin-top:5px;font-size:18px}.tx-subnav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
      .tx-center.tx-bom-workspace{background:#f2f6f8;color:#152a3a;padding:18px;--tx-ink:#17374c;--tx-muted:#71838e;--tx-green:#27786e;--tx-border:#d7e1e6;--tx-surface:#fff;font-family:"Segoe UI",Arial,sans-serif}
      .tx-bom-workspace>.tx-title{background:#123c55;color:#fff;padding:19px 22px;border-radius:4px;margin:0 0 17px;min-height:74px;box-sizing:border-box;box-shadow:none}
      .tx-bom-workspace>.tx-title h2{color:#fff;font-size:23px;letter-spacing:-.02em}
      .tx-bom-workspace>.tx-title p{color:#c8d9e2;font-size:12px;margin-top:6px}
      .tx-bom-workspace>.tx-title>.tx-btn{border:1px solid #668194;border-radius:2px;background:transparent;color:#fff;padding:9px 12px;white-space:nowrap}
      .tx-bom-workspace .tx-bom-section-nav{display:flex;gap:4px;flex-wrap:nowrap;width:100%;overflow-x:auto;padding:8px;margin:0 0 17px;background:#e5eff4;border:1px solid #d0dfe6;border-radius:3px;box-shadow:none;box-sizing:border-box}
      .tx-bom-workspace .tx-bom-section-nav .tx-btn{flex:0 0 auto;border:1px solid transparent;border-radius:2px;background:transparent;color:#1a3446;padding:10px 14px;font-size:12px;white-space:nowrap;box-shadow:none}
      .tx-bom-workspace .tx-bom-section-nav .tx-btn.primary{border-color:#e3b53d;background:#f4c648;color:#183348;box-shadow:none}
      .tx-bom-workspace .tx-bom-section-nav .tx-btn:hover:not(:disabled){background:#d6e7ef;border-color:#9bbbc8;transform:none}
      .tx-bom-workspace .tx-bom-section-nav .tx-btn.primary:hover{background:#f4c648}
      .tx-bom-workspace .tx-card{border:1px solid #d7e1e6;border-radius:3px;background:#fff;box-shadow:none;padding:19px;margin-bottom:15px}
      .tx-bom-workspace .tx-card:hover{border-color:#c8d8df;box-shadow:none}
      .tx-bom-workspace .tx-title{border-bottom:1px solid #e3eaee;padding:0 0 13px;margin-bottom:16px}
      .tx-bom-workspace .tx-title h3,.tx-bom-workspace h3{margin:0;color:#17374c;font-size:16px;font-weight:750}
      .tx-bom-workspace .tx-title p{color:#71838e;font-size:12px;line-height:1.5;margin:5px 0 0}
      .tx-bom-workspace h4{color:#27786e;font-size:13px;margin:17px 0 9px}
      .tx-bom-workspace .tx-field label{color:#526a77;font-size:11px;font-weight:750;margin-bottom:6px}
      .tx-bom-workspace .tx-field input,.tx-bom-workspace .tx-field select,.tx-bom-workspace .tx-table input,.tx-bom-workspace .tx-table select{border:1px solid #cbd8df;border-radius:2px;color:#203c4e;background:#fff;min-height:36px;box-sizing:border-box}
      .tx-bom-workspace .tx-field input:focus,.tx-bom-workspace .tx-field select:focus,.tx-bom-workspace .tx-table input:focus,.tx-bom-workspace .tx-table select:focus{border-color:#27786e;box-shadow:0 0 0 2px rgba(39,120,110,.12);outline:none}
      .tx-bom-workspace .tx-btn{border:1px solid #cbd8df;border-radius:2px;background:#fff;color:#31586b;box-shadow:none;font-size:12px;font-weight:700}
      .tx-bom-workspace .tx-btn:hover:not(:disabled){border-color:#4d8c86;background:#f4faf8;transform:none}
      .tx-bom-workspace .tx-btn.primary{background:#27786e;color:#fff;border-color:#27786e;box-shadow:none}
      .tx-bom-workspace .tx-btn.primary:hover:not(:disabled){background:#1d655d;border-color:#1d655d}
      .tx-bom-workspace .tx-btn.danger{color:#a83232;background:#fff;border-color:#e7caca}
      .tx-bom-workspace .tx-actions{border-top:1px solid #e6edf0;padding-top:14px}
      .tx-bom-workspace .tx-table-wrap{border:1px solid #d7e1e6;border-radius:2px;overflow:auto}
      .tx-bom-workspace .tx-table{min-width:740px;font-size:12px}
      .tx-bom-workspace .tx-table th{position:sticky;top:0;background:#f1f6f8;color:#526a77;padding:11px 12px;font-size:10px;letter-spacing:.035em;text-transform:uppercase;border-bottom:1px solid #dfe7eb;z-index:1}
      .tx-bom-workspace .tx-table td{padding:10px 12px;border-bottom:1px solid #edf1f3;color:#2f4654;vertical-align:middle}
      .tx-bom-workspace .tx-table tbody tr:nth-child(even){background:#fbfdfe}
      .tx-bom-workspace .tx-table tbody tr:hover{background:#f3f8fa}
      .tx-bom-workspace .tx-kpi{border:1px solid #d7e1e6;border-top:2px solid #27786e;border-radius:2px;background:#fff;padding:13px 14px}
      .tx-bom-workspace .tx-kpi b{color:#71838e;font-size:10px;text-transform:uppercase;letter-spacing:.035em}
      .tx-bom-workspace .tx-kpi strong{color:#17374c;font-size:18px;font-variant-numeric:tabular-nums}
      .tx-bom-workspace .tx-note.ok{background:#e9f5f1;color:#27786e;border-left:3px solid #27786e;border-radius:2px}
      .tx-bom-workspace .tx-note.err{background:#fff0f0;color:#8d2828;border-left:3px solid #c34545;border-radius:2px}
      .tx-bom-workspace .tx-bom-intro{display:flex;align-items:center;gap:15px;padding:18px 20px;margin:0 0 15px;background:#fff;border:1px solid #d7e1e6;border-left:3px solid #27786e}
      .tx-bom-workspace .tx-bom-intro-mark{width:46px;height:42px;flex:0 0 46px;display:grid;place-items:center;background:#e9f5f1;color:#27786e;font-size:11px;font-weight:900;letter-spacing:.06em}
      .tx-bom-workspace .tx-bom-intro-mark.amber{background:#fff6df;color:#916b11}
      .tx-bom-workspace .tx-bom-eyebrow{color:#348078;font-size:9px;font-weight:900;letter-spacing:1.2px;margin-bottom:4px}
      .tx-bom-workspace .tx-bom-intro h3{font-size:18px;line-height:1.3}
      .tx-bom-workspace .tx-bom-intro p{font-size:12px;color:#71838e;margin:5px 0 0;line-height:1.45}
      .tx-bom-workspace .tx-bom-intro-count{margin-left:auto;min-width:80px;text-align:right;padding-left:15px;border-left:1px solid #dfe7eb}
      .tx-bom-workspace .tx-bom-intro-count strong{display:block;color:#17374c;font-size:23px;line-height:1.15;font-variant-numeric:tabular-nums}
      .tx-bom-workspace .tx-bom-intro-count span{display:block;margin-top:4px;color:#71838e;font-size:10px}
      .tx-bom-workspace .tx-bom-status{flex:0 0 auto;padding:6px 8px;border:1px solid #cde4dc;background:#e9f5f1;color:#27786e;font-size:9px;font-weight:900;letter-spacing:.6px;white-space:nowrap}
      .tx-bom-workspace .tx-bom-status.amber{border-color:#f0dfae;background:#fff6df;color:#916b11}
      .tx-bom-workspace .tx-bom-help{display:flex;align-items:flex-end;grid-column:span 2}
      .tx-bom-workspace .tx-bom-help small,.tx-bom-workspace .tx-field small{display:block;color:#71838e;font-size:11px;line-height:1.5;margin-top:5px}
      .tx-bom-workspace .tx-bom-item-name{color:#1b3a4d;font-weight:750}
      .tx-bom-workspace .tx-bom-unit{display:inline-block;padding:4px 7px;background:#f1f6f8;color:#526a77;font-size:10px;font-weight:800;border:1px solid #dfe7eb}
      .tx-bom-workspace .tx-bom-money{font-weight:750;font-variant-numeric:tabular-nums;white-space:nowrap;color:#17374c}
      .tx-bom-workspace .tx-bom-money small{font-size:10px;font-weight:500;color:#71838e}
      .tx-bom-workspace .tx-bom-rate-source{display:inline-block;padding:5px 7px;font-size:10px;font-weight:750;white-space:nowrap}
      .tx-bom-workspace .tx-bom-rate-source.standard{background:#eef3f6;color:#536b7b}
      .tx-bom-workspace .tx-bom-rate-source.material{background:#e9f5f1;color:#27786e}
      .tx-bom-workspace .tx-bom-row-actions{display:flex;gap:6px;flex-wrap:wrap}
      .tx-bom-workspace .tx-bom-row-actions .tx-btn{padding:7px 9px}
      .tx-bom-workspace .tx-table-footer{border-top:1px solid #e7edef;padding:10px 12px;color:#82919a;font-size:10px}
      .tx-bom-workspace .tx-bom-empty{height:80px;text-align:center;color:#82919a;background:#fbfdfe;font-size:12px}
      .tx-bom-workspace .tx-bom-inline-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0 0;padding:0;border:0;background:transparent;box-shadow:none;width:auto}
      .tx-bom-workspace .tx-bom-section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:17px 0 10px}
      .tx-bom-workspace .tx-bom-section-heading h4{margin:0}
      .tx-bom-workspace .tx-bom-section-heading p{margin:4px 0 0;color:#71838e;font-size:11px}
      .tx-bom-workspace .tx-bom-section-heading>span{font-size:10px;font-weight:800;color:#27786e;background:#e9f5f1;padding:5px 8px}
      .tx-bom-workspace .tx-bom-link{display:block;border:0;background:transparent;color:#27786e;font-size:10px;text-decoration:underline;cursor:pointer;padding:4px 0}
      @media(max-width:900px){.tx-bom-workspace{padding:12px}.tx-bom-workspace .tx-grid{grid-template-columns:1fr 1fr}.tx-bom-workspace .tx-bom-section-nav{justify-content:flex-start}.tx-bom-workspace .tx-bom-intro{align-items:flex-start}}
      @media(max-width:600px){.tx-center.tx-bom-workspace{padding:8px}.tx-bom-workspace>.tx-title{padding:14px;align-items:flex-start;gap:8px}.tx-bom-workspace>.tx-title h2{font-size:19px}.tx-bom-workspace>.tx-title>.tx-btn{padding:7px 8px;font-size:10px}.tx-bom-workspace .tx-bom-section-nav{padding:6px}.tx-bom-workspace .tx-bom-section-nav .tx-btn{padding:9px 10px}.tx-bom-workspace .tx-grid{grid-template-columns:1fr}.tx-bom-workspace .tx-bom-help{grid-column:1}.tx-bom-workspace .tx-bom-intro{padding:13px;gap:10px}.tx-bom-workspace .tx-bom-intro-mark{width:38px;height:36px;flex-basis:38px;font-size:9px}.tx-bom-workspace .tx-bom-intro h3{font-size:15px}.tx-bom-workspace .tx-bom-intro-count{min-width:48px;padding-left:8px}.tx-bom-workspace .tx-bom-intro-count strong{font-size:18px}.tx-bom-workspace .tx-bom-intro-count span{font-size:9px}.tx-bom-workspace .tx-card{padding:13px}.tx-bom-workspace .tx-bom-row-actions{flex-wrap:nowrap}.tx-bom-workspace .tx-bom-status{font-size:8px;padding:5px}.tx-bom-workspace .tx-bom-kpis{grid-template-columns:1fr 1fr}}
      @media(max-width:900px){.tx-grid{grid-template-columns:1fr 1fr}.tx-kpis,.tx-stock-detail-kpis{grid-template-columns:1fr 1fr}}@media(max-width:560px){.tx-center{padding:6px}.tx-center .tx-card{padding:12px;border-radius:12px}.tx-center .tx-subnav{width:100%;box-sizing:border-box}.tx-center .tx-subnav .tx-btn{flex:1;padding:9px 8px;font-size:12px}.tx-grid{grid-template-columns:1fr}.tx-kpis,.tx-stock-detail-kpis{grid-template-columns:1fr 1fr}.tx-stock-dialog{padding:13px}.tx-stock-dialog-head{align-items:stretch}.tx-stock-dialog-head h2{font-size:17px}}
      .tx-bom-workspace .tx-bom-section-nav .tx-btn{flex:0 0 auto}
      /* Purchase-only presentation layer: no form, API, validation or calculation logic changed. */
      .tx-center .tx-purchase-nav{width:100%;box-sizing:border-box;display:flex;gap:6px;flex-wrap:wrap;padding:8px;margin:0 0 18px;background:#e8f0f4;border:1px solid #d4e0e7;border-radius:4px;box-shadow:none}
      .tx-center .tx-purchase-nav .tx-btn{border:1px solid transparent;border-radius:3px;padding:11px 16px;color:#17374c;background:transparent;font-size:12px;white-space:nowrap}
      .tx-center .tx-purchase-nav .tx-btn.primary{background:#f4c648;color:#183348;border-color:#e3b53d;box-shadow:none}
      .tx-center .tx-purchase-nav .tx-btn:hover:not(:disabled){background:#dce9ef;border-color:#b8cdd8;transform:none}
      .tx-center .tx-purchase-nav .tx-btn.primary:hover:not(:disabled){background:#f4c648;border-color:#e3b53d}
      .tx-center .tx-purchase-entry-card,.tx-center .tx-purchase-history-card{border:1px solid #d7e1e6;border-radius:4px;background:#fff;box-shadow:none;padding:20px}
      .tx-center .tx-purchase-entry-card>h3,.tx-center .tx-purchase-history-card .tx-title h3{margin:0;color:#17374c;font-size:17px;font-weight:750}
      .tx-center .tx-purchase-entry-card>h3{padding-bottom:14px;margin-bottom:17px;border-bottom:1px solid #e3eaee}
      .tx-center .tx-purchase-entry-card .tx-field label{color:#526a77;font-size:11px;font-weight:750;margin-bottom:6px}
      .tx-center .tx-purchase-entry-card .tx-field input,.tx-center .tx-purchase-entry-card .tx-field select{min-height:38px;border:1px solid #cbd8df;border-radius:3px;background:#fff;color:#203c4e}
      .tx-center .tx-purchase-entry-card h4{margin:20px 0 10px;color:#27786e;font-size:13px}
      .tx-center .tx-purchase-entry-card .tx-btn,.tx-center .tx-purchase-history-card .tx-btn{border-radius:3px;font-size:12px;font-weight:700}
      .tx-center .tx-purchase-entry-card .tx-btn.primary{background:#27786e;border-color:#27786e;color:#fff;box-shadow:none}
      .tx-center .tx-purchase-entry-card .tx-table-wrap,.tx-center .tx-purchase-history-card .tx-table-wrap{border:1px solid #d7e1e6;border-radius:3px;overflow:auto}
      .tx-center .tx-purchase-entry-card .tx-table,.tx-center .tx-purchase-history-card .tx-table{min-width:760px;font-size:12px}
      .tx-center .tx-purchase-entry-card .tx-table th,.tx-center .tx-purchase-history-card .tx-table th{background:#f1f6f8;color:#526a77;padding:11px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.035em;border-bottom:1px solid #dfe7eb}
      .tx-center .tx-purchase-entry-card .tx-table td,.tx-center .tx-purchase-history-card .tx-table td{padding:10px 12px;color:#2f4654;border-bottom:1px solid #edf1f3}
      .tx-center .tx-purchase-entry-card .tx-table tbody tr:hover,.tx-center .tx-purchase-history-card .tx-table tbody tr:hover{background:#f3f8fa}
      .tx-center .tx-purchase-history-card .tx-title{padding-bottom:13px;border-bottom:1px solid #e3eaee}
      .tx-center .tx-purchase-history-card .tx-subnav{margin:0;padding:0;border:0;background:transparent;box-shadow:none}
      /* Purchase GST totals: compact single horizontal strip, matching the GST Report card palette. */
      .tx-center .tx-purchase-entry-card .tx-kpis{display:grid;grid-template-columns:repeat(6,minmax(105px,1fr));gap:7px;margin-top:10px;padding:3px 2px 8px;overflow-x:auto;align-items:stretch}
      .tx-center .tx-purchase-entry-card .tx-kpi{min-width:0;padding:9px 10px;border:1px solid #d7e4e8;border-top:3px solid #27786e;border-radius:4px;background:#f5f9fa;box-shadow:none;gap:4px}
      .tx-center .tx-purchase-entry-card .tx-kpi b{display:block;color:#526a77;font-size:10px;line-height:1.25;font-weight:750;white-space:nowrap}
      .tx-center .tx-purchase-entry-card .tx-kpi strong{display:block;color:#17374c;font-size:12px;line-height:1.25;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
      .tx-center .tx-purchase-entry-card .tx-kpis .tx-kpi:last-child{background:#e9f5f1;border-color:#b8d9d0;border-top-color:#17374c}
      .tx-center .tx-purchase-entry-card .tx-kpis .tx-kpi:last-child strong{color:#17675d;font-size:13px}
      @media(max-width:640px){.tx-center .tx-purchase-entry-card,.tx-center .tx-purchase-history-card{padding:12px}.tx-center .tx-purchase-nav{gap:5px}.tx-center .tx-purchase-nav .tx-btn{flex:1 1 auto;padding:10px 9px}.tx-center .tx-purchase-entry-card .tx-actions{flex-wrap:wrap}.tx-center .tx-purchase-entry-card .tx-kpis{grid-template-columns:repeat(6,minmax(105px,1fr));gap:6px}.tx-center .tx-purchase-entry-card .tx-kpi{padding:8px}.tx-center .tx-purchase-history-card .tx-title{align-items:flex-start}}
    `}</style>
    <div className="tx-title"><div><h2>{tab==="bom"||tab==="bom-history"?"BOM & Costing Workspace":"Voucher & Operations"}</h2><p>{tab==="bom"||tab==="bom-history"?"Cost masters → Product recipe → Additional costs → Estimated unit cost":"Purchase → Stock → Job Order → Production → Packing → Sale → Return"}</p></div><button className="tx-btn" onClick={()=>tab==="bom"||tab==="bom-history"?(loadMasters(),loadCostItemMasters()):loadMasters()}>Refresh {tab==="bom"||tab==="bom-history"?"BOM Data":"Masters"}</button></div>
    {(tab==="purchase"||tab==="purchase-history")&&<div className="tx-subnav tx-purchase-nav"><button className={`tx-btn ${tab==="purchase"?"primary":""}`} onClick={()=>{setTab("purchase");resetFeedback()}}>Purchase Entry</button><button className={`tx-btn ${tab==="purchase-history"?"primary":""}`} onClick={()=>{setTab("purchase-history");resetFeedback()}}>Purchase History</button></div>}
    {(tab==="bom"||tab==="bom-history")&&<div className="tx-subnav tx-bom-section-nav" role="tablist" aria-label="BOM workspace sections">
      <button type="button" role="tab" aria-selected={tab==="bom"&&bomSection==="masters"} className={`tx-btn ${tab==="bom"&&bomSection==="masters"?"primary":""}`} onClick={()=>{setBomSection("masters");setTab("bom");resetFeedback()}}>Cost Item Masters</button>
      <button type="button" role="tab" aria-selected={tab==="bom"&&bomSection==="additional"} className={`tx-btn ${tab==="bom"&&bomSection==="additional"?"primary":""}`} onClick={()=>{setBomSection("additional");setTab("bom");resetFeedback()}}>Additional Cost Items</button>
      <button type="button" role="tab" aria-selected={tab==="bom"&&bomSection==="entry"} className={`tx-btn ${tab==="bom"&&bomSection==="entry"?"primary":""}`} onClick={()=>{setBomSection("entry");setTab("bom");resetFeedback()}}>BOM Entry</button>
      <button type="button" role="tab" aria-selected={tab==="bom"&&bomSection==="quick"} className={`tx-btn ${tab==="bom"&&bomSection==="quick"?"primary":""}`} onClick={()=>{setBomSection("quick");setTab("bom");resetFeedback()}}>Quick Costing</button>
      <button type="button" role="tab" aria-selected={tab==="bom-history"} className={`tx-btn ${tab==="bom-history"?"primary":""}`} onClick={()=>{setTab("bom-history");resetFeedback();loadMasters()}}>BOM History</button>
    </div>}
    {(tab==="job"||tab==="job-history"||tab==="job-return")&&<div className="tx-subnav"><button className={`tx-btn ${tab==="job"?"primary":""}`} onClick={()=>{setTab("job");resetFeedback()}}>Job Order Entry</button><button className={`tx-btn ${tab==="job-history"?"primary":""}`} onClick={()=>{setTab("job-history");resetFeedback()}}>Job Order History</button><button className={`tx-btn ${tab==="job-return"?"primary":""}`} onClick={()=>{setTab("job-return");resetFeedback()}}>Return Raw Material</button></div>}
    {tab==="purchase"&&purchaseEditId&&<div className="tx-note ok">Editing {purchaseEditNo}. Save Purchase will update this entry. <button className="tx-btn" onClick={()=>{setPurchaseEditId("");setPurchaseEditNo("");setPurchase({date:today(),location:"",supplierId:"",supplierName:"",supplierGSTIN:"",supplierInvoiceNo:"",supplierInvoiceDate:"",transportCost:0,otherCost:0,remarks:""});setPLines([blankLine()]);resetFeedback()}}>Cancel Edit</button></div>}
    {msg&&<div className="tx-note ok">{msg}</div>}{err&&<div className="tx-note err">{err}</div>}
    {tab==="bom-history"&&bomHistoryContent}

    {tab==="bom"&&bomSection==="masters"&&<>
      <div className="tx-bom-intro">
        <div className="tx-bom-intro-mark">COST</div>
        <div><div className="tx-bom-eyebrow">MASTER DATA</div><h3>Cost Item Masters</h3><p>Set standard rates once and reuse the same charges across product recipes.</p></div>
        <div className="tx-bom-intro-count"><strong>{bomCostItemMasters.length}</strong><span>Cost items</span></div>
      </div>
      <div className="tx-card tx-bom-form-card">
        <div className="tx-title"><div><h3>{editingCostMasterId?"Edit Cost Item":"Create Cost Item"}</h3><p>Define the unit, rate basis and quantity multiplier.</p></div><span className="tx-bom-status">{editingCostMasterId?"EDITING MASTER":"COST MASTER"}</span></div>
        <div className="tx-grid">
          <div className="tx-field"><label>Cost Item Name</label><input value={costMasterForm.name} placeholder="e.g. Transportation (Factory to Distributor)" onChange={event=>setCostMasterForm(current=>({...current,name:event.target.value}))}/></div>
          <div className="tx-field"><label>Unit / Rate Basis</label><input value={costMasterForm.unit} placeholder="g, Kg or PKT" onChange={event=>setCostMasterForm(current=>({...current,unit:event.target.value}))}/></div>
          <div className="tx-field"><label>Standard Cost (₹)</label><input type="number" min="0" step="0.0001" value={costMasterForm.standardRate} onChange={event=>setCostMasterForm(current=>({...current,standardRate:event.target.value}))}/></div>
          <div className="tx-field"><label>Quantity Multiplier</label><input type="number" min="0" step="0.0001" value={costMasterForm.quantityMultiplier} onChange={event=>setCostMasterForm(current=>({...current,quantityMultiplier:event.target.value}))}/><small>For g/Kg, 1 means full pack weight; 0.02 means 2% of pack weight. For PKT, it multiplies packet count.</small></div>
          <div className="tx-field"><label>Rate Source</label><select value={costMasterForm.rateSource||"STANDARD"} onChange={event=>setCostMasterForm(current=>({...current,rateSource:event.target.value}))}><option value="STANDARD">Fixed standard rate</option><option value="BOM_MATERIAL">BOM material weighted rate</option></select></div>
          <div className="tx-field tx-bom-help"><small>{costMasterForm.rateSource==="BOM_MATERIAL"?"Rate is calculated from BOM material value ÷ material weight. For Handling Loss, use Unit Kg, Multiplier 0.01 and Standard Cost 0.":"The entered standard cost is used for this cost item when selected in a BOM."}</small></div>
        </div>
        <div className="tx-actions"><button type="button" className="tx-btn" onClick={()=>{setEditingCostMasterId("");setCostMasterForm({name:"",unit:"g",standardRate:"",rateSource:"STANDARD",quantityMultiplier:1})}}>Clear Form</button><button type="button" className="tx-btn primary" onClick={saveCostItemMaster}>{editingCostMasterId?"Update Cost Master":"Save Cost Master"}</button></div>
      </div>
      <div className="tx-card">
        <div className="tx-title"><div><h3>Saved Cost Items</h3><p>Active standard costs available for BOM costing.</p></div><button type="button" className="tx-btn" onClick={loadCostItemMasters}>Refresh List</button></div>
        <div className="tx-table-wrap"><table className="tx-table tx-bom-table"><thead><tr><th>Cost Item</th><th>Unit</th><th>Standard Cost</th><th>Multiplier</th><th>Rate Source</th><th>Actions</th></tr></thead><tbody>
          {bomCostItemMasters.map(item=><tr key={item._id}><td><div className="tx-bom-item-name">{item.name}</div></td><td><span className="tx-bom-unit">{item.unit}</span></td><td className="tx-bom-money">₹ {money(item.standardRate)} <small>/ {String(item.unit||"").toLowerCase()==="g"?"Kg":item.unit}</small></td><td>{item.quantityMultiplier??1}</td><td><span className={`tx-bom-rate-source ${item.rateSource==="BOM_MATERIAL"?"material":"standard"}`}>{item.rateSource==="BOM_MATERIAL"?"Material weighted":"Standard rate"}</span></td><td><div className="tx-bom-row-actions"><button type="button" className="tx-btn" onClick={()=>editCostItemMaster(item)}>Edit</button><button type="button" className="tx-btn danger" onClick={()=>deleteCostItemMaster(item)}>Deactivate</button></div></td></tr>)}
          {!bomCostItemMasters.length&&<tr><td colSpan="6" className="tx-bom-empty">No cost items yet. Add the first cost item using the form above.</td></tr>}
        </tbody></table></div><div className="tx-table-footer">Showing {bomCostItemMasters.length} active cost item{bomCostItemMasters.length===1?"":"s"} · Rates are reused in BOM / Costing.</div>
      </div>
    </>}

    {tab==="bom"&&bomSection==="additional"&&<>
      <div className="tx-bom-intro"><div className="tx-bom-intro-mark amber">ADD</div><div><div className="tx-bom-eyebrow">BOM COST BUILD-UP</div><h3>Additional Cost Items</h3><p>Choose the standard cost masters to calculate additional charges for the current output batch.</p></div><div className="tx-bom-intro-count"><strong>{(bom.costItems||[]).length}</strong><span>Selected costs</span></div></div>
      <div className="tx-card">
        <div className="tx-title"><div><h3>Additional Cost Items</h3><p>Gram and millilitre rates are handled per kg / litre by the existing costing calculation.</p></div><span className="tx-bom-status">CURRENT BOM</span></div>
        <div className="tx-table-wrap"><table className="tx-table tx-bom-table"><thead><tr><th>Cost Item</th><th>Unit</th><th>Quantity</th><th>Rate</th><th>Calculated Amount</th><th></th></tr></thead><tbody>
          {(bom.costItems||[]).map((item,index)=><tr key={`${item.name||"cost"}-${index}`}>
            <td><SearchableSelect value={item.masterId||""} placeholder="Select cost master" options={bomCostItemMasters.map(master=>({value:master._id,label:`${master.name} · ${master.unit} · ${master.rateSource==="BOM_MATERIAL"?"BOM material rate":`₹${money(master.standardRate)}`}`}))} onChange={event=>chooseBomCostItem(index,event.target.value)}/></td>
            <td><span className="tx-bom-unit">{item.unit||"-"}</span></td>
            <td><input aria-label="Auto calculated cost quantity" type="number" min="0" step="0.001" value={item.qty??""} readOnly={!!item.masterId&&item.qty!==null&&item.qty!==undefined} onChange={event=>setBom(current=>({...current,costItems:current.costItems.map((row,rowIndex)=>rowIndex===index?{...row,qty:event.target.value}:row)}))}/></td>
            <td><input aria-label="Cost item rate" type="number" min="0" step="0.0001" value={item.rate??""} readOnly={!!item.masterId} onChange={event=>setBom(current=>({...current,costItems:current.costItems.map((row,rowIndex)=>rowIndex===index?{...row,rate:event.target.value}:row)}))}/></td>
            <td className="tx-bom-money">₹ {money(bomCostAmount(item.qty,item.unit,item.rate))}</td>
            <td><button type="button" className="tx-mini-danger" aria-label={`Remove ${item.name||"cost item"}`} onClick={()=>setBom(current=>({...current,costItems:current.costItems.filter((_,rowIndex)=>rowIndex!==index)}))}>×</button></td>
          </tr>)}
          {!(bom.costItems||[]).length&&<tr><td colSpan="6" className="tx-bom-empty">No additional cost selected. Use “Add Cost Item” to begin.</td></tr>}
        </tbody></table></div>
        <div className="tx-subnav tx-bom-inline-actions"><button type="button" className="tx-btn" onClick={()=>setBom(current=>({...current,costItems:[...current.costItems,{masterId:"",name:"",unit:"g",qty:"",rate:""}]}))}>+ Add Cost Item</button><button type="button" className="tx-btn" onClick={()=>{setBomSection("masters");setTab("bom")}}>Manage Cost Masters</button></div>
        <div className="tx-kpis tx-bom-kpis" style={{marginTop:12}}><div className="tx-kpi"><b>Additional Costs / Batch</b><strong>₹ {money(bomCostItemsTotal)}</strong></div><div className="tx-kpi"><b>Estimated Total / Output Unit</b><strong>₹ {money(bomEstimatedUnitCost)}</strong></div></div>
      </div>
    </>}

    {tab==="purchase-history"&&purchaseHistoryContent}
    {tab==="job-history"&&jobHistoryContent}
    {tab==="job-return"&&jobReturnContent}
    {tab==="job"&&<div className="tx-card"><div className="tx-field" style={{maxWidth:440}}><label>Party (Optional)</label>{commonSelect(job.partyId,e=>setJob({...job,partyId:e.target.value}),customerOpts,"Select customer / party")}</div></div>}

    {tab==="purchase"&&<div className="tx-card tx-purchase-entry-card"><h3>Purchase Entry</h3><div className="tx-grid"><div className="tx-field"><label>Date</label><input type="date" value={purchase.date} onChange={e=>setPurchase({...purchase,date:e.target.value})}/></div><div className="tx-field"><label>Location</label>{commonSelect(purchase.location,e=>setPurchase({...purchase,location:e.target.value}),locOpts,"Select location")}</div><div className="tx-field"><label>Supplier</label><SearchableSelect value={purchase.supplierId} placeholder="Search supplier name" masterType="supplier" onOpenMaster={openMaster} options={supplierOpts.map(x=>({value:x._id,label:x.name}))} onChange={e=>{const x=supplierOpts.find(v=>v._id===e.target.value);setPurchase({...purchase,supplierId:e.target.value,supplierName:x?.name||"",supplierGSTIN:x?.gstin||""})}}/></div><div className="tx-field"><label>Supplier Invoice No.</label><input value={purchase.supplierInvoiceNo} onChange={e=>setPurchase({...purchase,supplierInvoiceNo:e.target.value})}/></div><div className="tx-field"><label>Invoice Date</label><input type="date" value={purchase.supplierInvoiceDate} onChange={e=>setPurchase({...purchase,supplierInvoiceDate:e.target.value})}/></div><div className="tx-field"><label>Transport Cost</label><input type="number" value={purchase.transportCost} onChange={e=>setPurchase({...purchase,transportCost:e.target.value})}/></div><div className="tx-field"><label>Other Cost</label><input type="number" value={purchase.otherCost} onChange={e=>setPurchase({...purchase,otherCost:e.target.value})}/></div></div><h4>Raw Material Lines</h4><LineTable lines={pLines} setter={setPLines} allowedTypes={["RAW_MATERIAL"]}/><div className="tx-subnav"><button className="tx-btn" onClick={()=>addLine(setPLines,"RAW_MATERIAL")}>+ Add Raw Material</button></div><div className="tx-actions"><button className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/raw-material-purchases",{...purchase,lines:pLines.map(x=>({...x,qty:n(x.qty),purchaseRate:n(x.rate),value:lineValue(x)}))},()=>setPLines([blankLine()]))}>{busy?"Posting...":"Save Purchase"}</button></div></div>}

    {tab==="job"&&<div className="tx-card"><h3>Job Order</h3><div className="tx-grid"><div className="tx-field"><label>Date</label><input type="date" value={job.date} onChange={e=>setJob({...job,date:e.target.value})}/></div><div className="tx-field"><label>Type</label><select value={job.type} onChange={e=>{const t=e.target.value;setJob({...job,type:t});setSources([blankLine("RAW_MATERIAL")]);setOutputs([blankLine(t==="GRADING"?"GRADE":"FINISHED_GOODS")])}}><option value="GRADING">Grading</option><option value="FINISHED_GOODS">Finished Goods Production</option></select></div><div className="tx-field"><label>Location</label>{commonSelect(job.location,e=>setJob({...job,location:e.target.value}),locOpts,"Select location")}</div><div className="tx-field"><label>Labour Cost</label><input type="number" value={job.labourCost} onChange={e=>setJob({...job,labourCost:e.target.value})}/></div><div className="tx-field"><label>Transport Cost</label><input type="number" value={job.transportCost} onChange={e=>setJob({...job,transportCost:e.target.value})}/></div><div className="tx-field"><label>Other Cost</label><input type="number" value={job.otherCost} onChange={e=>setJob({...job,otherCost:e.target.value})}/></div></div><div className="tx-grid" style={{marginTop:12}}><div className="tx-field"><label>Finished Good / BOM Output</label>{commonSelect(outputs[0]?.itemId||"",e=>chooseItem(setOutputs,0,e.target.value),fgItems,"Select Finished Good")}</div><div className="tx-field"><label>Production Qty</label><input type="number" min="0.001" step="0.001" value={bomOutputQty} onChange={e=>{setBomOutputQty(e.target.value);setOutputs(a=>a.map((x,i)=>i===0?{...x,qty:e.target.value}:x))}}/></div><div className="tx-field" style={{display:"flex",alignItems:"end"}}><button type="button" className="tx-btn" disabled={bomLoading} onClick={loadBomForJob}>{bomLoading?"Loading BOM...":"Load BOM → Raw Qty / Purchase Rate"}</button></div></div><h4>Source Stock — will decrease now</h4><LineTable lines={sources} setter={setSources} allowedTypes={["RAW_MATERIAL"]}/>{bomAllocations.length>0&&<div className="tx-card" style={{marginTop:10,padding:10}}><b>Purchase-wise Raw Material Allocation</b><div className="tx-table-wrap"><table className="tx-table"><thead><tr><th>Raw Material</th><th>Purchase</th><th>Supplier</th><th>Required</th><th>Issue</th><th>Rate</th><th>Pending</th></tr></thead><tbody>{bomAllocations.flatMap(m=>(m.purchaseAllocation||[]).map((a,i)=><tr key={`${m.itemName}-${a.purchaseNo}-${i}`}><td>{m.itemName}</td><td>{a.purchaseNo}</td><td>{a.supplierName}</td><td>{m.requiredQty} {m.unit}</td><td>{a.qty} {a.unit}</td><td>₹ {money(a.rate)}</td><td>{a.pendingAfter} {a.unit}</td></tr>))}</tbody></table></div></div>}<button className="tx-btn" onClick={()=>addLine(setSources,"RAW_MATERIAL")}>+ Add Raw Material</button><h4>Planned Output — will increase only in Production Entry</h4><LineTable lines={outputs} setter={setOutputs} allowedTypes={[job.type==="GRADING"?"GRADE":"FINISHED_GOODS"]}/><button className="tx-btn" onClick={()=>addLine(setOutputs,job.type==="GRADING"?"GRADE":"FINISHED_GOODS")}>+ Add Output</button><div className="tx-actions"><button className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/job-orders",{...job,sourceItems:sources,outputItems:outputs},()=>{setSources([blankLine("RAW_MATERIAL")]);setOutputs([blankLine(job.type==="GRADING"?"GRADE":"FINISHED_GOODS")]);loadJobs()})}>{busy?"Posting...":"Create Job Order"}</button></div></div>}

    {tab==="production"&&<div className="tx-card"><h3>Production Entry — Against Job Order</h3><div className="tx-grid"><div className="tx-field"><label>Job Order</label><SearchableSelect value={selectedJob?._id||""} placeholder="Search Job Order" options={jobs.map(j=>({value:j._id,label:`${j.jobNo} · ${j.location} · ${j.status}`}))} onChange={e=>setSelectedJob(jobs.find(x=>x._id===e.target.value)||null)}/></div><div className="tx-field"><label>Date</label><input type="date" value={job.date} onChange={e=>setJob({...job,date:e.target.value})}/></div></div>{selectedJob&&<><div className="tx-kpis" style={{marginTop:12}}><div className="tx-kpi"><b>Job No.</b><strong>{selectedJob.jobNo}</strong></div><div className="tx-kpi"><b>Type</b><strong>{selectedJob.type}</strong></div><div className="tx-kpi"><b>Location</b><strong>{selectedJob.location}</strong></div><div className="tx-kpi"><b>Status</b><strong>{selectedJob.status}</strong></div></div><h4>Job Order Details</h4><div className="tx-table-wrap"><table className="tx-table"><thead><tr><th>Source Raw Material</th><th>Job Qty</th><th>Output</th><th>Planned Qty</th></tr></thead><tbody>{selectedJob.sourceItems?.map((x,i)=><tr key={i}><td>{x.itemName}</td><td>{x.qty} {x.unit}</td><td>{selectedJob.outputItems?.[i]?.itemName||selectedJob.outputItems?.[0]?.itemName||"-"}</td><td>{selectedJob.outputItems?.[i]?.qty||selectedJob.outputItems?.[0]?.qty||0}</td></tr>)}</tbody></table></div><h4>Production Output — Finished Goods stock will increase</h4><LineTable lines={outputs} setter={setOutputs} allowedTypes={[selectedJob.type==="GRADING"?"GRADE":"FINISHED_GOODS"]}/><button className="tx-btn" onClick={()=>setOutputs((selectedJob.remainingOutputItems||[]).filter(x=>x.remainingQty>0).map(x=>{const item=m.items.find(v=>v.name===x.itemName);return {...blankLine(selectedJob.type==="GRADING"?"GRADE":"FINISHED_GOODS"),itemName:x.itemName,itemId:item?._id||"",unit:x.unit||"KG",qty:x.remainingQty,rate:x.rate||0}}))}>Load Remaining Job Output</button><div className="tx-actions"><button className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/production",{jobId:selectedJob._id,date:job.date,outputItems:outputs},()=>{setOutputs([blankLine(selectedJob.type==="GRADING"?"GRADE":"FINISHED_GOODS")]);loadJobs()})}>{busy?"Posting...":"Post Production"}</button></div></>}</div>}

    {tab==="grading"&&<div className="tx-card"><h3>Grading Entry</h3><p>For stock-linked Grading, create a Grading Job Order first and then post production against that Job Order.</p></div>}

    {tab==="sale"&&<div className="tx-card"><h3>Sale Voucher</h3><div className="tx-grid"><div className="tx-field"><label>Date</label><input type="date" value={sale.date} onChange={e=>setSale({...sale,date:e.target.value})}/></div><div className="tx-field"><label>Location</label>{commonSelect(sale.location,e=>setSale({...sale,location:e.target.value}),locOpts,"Select location")}</div><div className="tx-field"><label>Customer / Party</label><SearchableSelect value={sale.partyId} placeholder="Search customer / party" masterType="party" onOpenMaster={openMaster} options={customerOpts.map(x=>({value:x._id,label:x.name}))} onChange={e=>{const x=customerOpts.find(v=>v._id===e.target.value);setSale({...sale,partyId:e.target.value,customerName:x?.name||"",customerGSTIN:x?.gstin||"",customerState:x?.state||""})}}/></div><div className="tx-field"><label>Place of Supply</label><input value={sale.placeOfSupply} onChange={e=>setSale({...sale,placeOfSupply:e.target.value})}/></div><div className="tx-field"><label>Customer State</label><input value={sale.customerState} onChange={e=>setSale({...sale,customerState:e.target.value})}/></div></div><h4>Sale Lines</h4><LineTable lines={sLines} setter={setSLines} allowedTypes={["FINISHED_GOODS","PACKED_GOODS"]}/><button className="tx-btn" onClick={()=>addLine(setSLines,"FINISHED_GOODS")}>+ Add Sale Line</button><div className="tx-actions"><button className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/sales",{...sale,lines:sLines.map(x=>({...x,rate:n(x.rate),qty:n(x.qty),gstRate:n(x.gstRate)}))},()=>setSLines([blankLine("FINISHED_GOODS")]))}>{busy?"Posting...":"Save Sale"}</button></div></div>}

    {tab==="pi"&&<div className="tx-card"><h3>Proforma Invoice</h3><div className="tx-grid"><div className="tx-field"><label>Date</label><input type="date" value={pi.date} onChange={e=>setPi({...pi,date:e.target.value})}/></div><div className="tx-field"><label>Location</label>{commonSelect(pi.location,e=>setPi({...pi,location:e.target.value}),locOpts,"Select location")}</div><div className="tx-field"><label>Customer / Party</label>{commonSelect(pi.partyId,e=>setPi({...pi,partyId:e.target.value}),customerOpts,"Select customer")}</div><div className="tx-field"><label>Reference No.</label><input value={pi.referenceNo} onChange={e=>setPi({...pi,referenceNo:e.target.value})}/></div></div><LineTable lines={piLines} setter={setPiLines} allowedTypes={["FINISHED_GOODS","PACKED_GOODS"]}/><button className="tx-btn" onClick={()=>addLine(setPiLines,"FINISHED_GOODS")}>+ Add PI Line</button><div className="tx-actions"><button className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/workflow/pi",{...pi,lines:piLines},()=>setPiLines([blankLine("FINISHED_GOODS")]))}>Save PI</button></div></div>}

    {tab==="return"&&<div className="tx-card"><h3>Return Voucher</h3><div className="tx-grid"><div className="tx-field"><label>Return Type</label><select value={ret.docType} onChange={e=>setRet({...ret,docType:e.target.value})}><option value="SALE_RETURN">Sale Return</option><option value="PURCHASE_RETURN">Purchase Return</option><option value="EXPIRED_RETURN">Expired Return</option><option value="QUALITY_RETURN">Quality Return</option></select></div><div className="tx-field"><label>Date</label><input type="date" value={ret.date} onChange={e=>setRet({...ret,date:e.target.value})}/></div><div className="tx-field"><label>Location</label>{commonSelect(ret.location,e=>setRet({...ret,location:e.target.value}),locOpts,"Select location")}</div><div className="tx-field"><label>Party</label>{commonSelect(ret.partyId,e=>setRet({...ret,partyId:e.target.value}),[...(ret.docType==="PURCHASE_RETURN"?supplierOpts:customerOpts)],"Select party")}</div><div className="tx-field"><label>Reference No.</label><input value={ret.referenceNo} onChange={e=>setRet({...ret,referenceNo:e.target.value})}/></div></div><LineTable lines={retLines} setter={setRetLines} allowedTypes={["RAW_MATERIAL","GRADE","FINISHED_GOODS","PACKED_GOODS","RETURN_GOODS"]}/><button className="tx-btn" onClick={()=>addLine(setRetLines,ret.docType==="PURCHASE_RETURN"?"RAW_MATERIAL":"FINISHED_GOODS")}>+ Add Return Line</button><div className="tx-actions"><button className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/workflow/returns",{...ret,lines:retLines},()=>setRetLines([blankLine(ret.docType==="PURCHASE_RETURN"?"RAW_MATERIAL":"FINISHED_GOODS")]))}>Post Return</button></div></div>}

    {tab==="damage"&&<div className="tx-card"><h3>Damage Voucher</h3><div className="tx-grid"><div className="tx-field"><label>Date</label><input type="date" value={damage.date} onChange={e=>setDamage({...damage,date:e.target.value})}/></div><div className="tx-field"><label>Location</label>{commonSelect(damage.location,e=>setDamage({...damage,location:e.target.value}),locOpts,"Select location")}</div></div><LineTable lines={damageLines} setter={setDamageLines} allowedTypes={["RAW_MATERIAL","GRADE","FINISHED_GOODS","PACKED_GOODS"]}/><button className="tx-btn" onClick={()=>addLine(setDamageLines,"FINISHED_GOODS")}>+ Add Damage Line</button><div className="tx-actions"><button className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/workflow/damage",{...damage,lines:damageLines},()=>setDamageLines([blankLine("FINISHED_GOODS")]))}>Post Damage</button></div></div>}

    {tab==="repack"&&<div className="tx-card"><h3>Repacking</h3><div className="tx-grid"><div className="tx-field"><label>Date</label><input type="date" value={repack.date} onChange={e=>setRepack({...repack,date:e.target.value})}/></div><div className="tx-field"><label>Location</label>{commonSelect(repack.location,e=>setRepack({...repack,location:e.target.value}),locOpts,"Select location")}</div></div><h4>Source / Open Pack</h4><LineTable lines={repackSrc} setter={setRepackSrc} allowedTypes={["RETURN_GOODS","FINISHED_GOODS","PACKED_GOODS"]}/><button className="tx-btn" onClick={()=>addLine(setRepackSrc,"RETURN_GOODS")}>+ Add Source</button><h4>Packed Output</h4><LineTable lines={repackOut} setter={setRepackOut} allowedTypes={["PACKED_GOODS","FINISHED_GOODS"]}/><button className="tx-btn" onClick={()=>addLine(setRepackOut,"PACKED_GOODS")}>+ Add Output</button><div className="tx-actions"><button className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/workflow/repack",{...repack,sourceLines:repackSrc,outputLines:repackOut},()=>{setRepackSrc([blankLine("RETURN_GOODS")]);setRepackOut([blankLine("PACKED_GOODS")])})}>Post Repacking</button></div></div>}

    {tab==="packing"&&<div className="tx-card"><h3>Packing Conversion + Conversion Charge</h3><div className="tx-grid"><div className="tx-field"><label>Date</label><input type="date" value={pack.date} onChange={e=>setPack({...pack,date:e.target.value})}/></div><div className="tx-field"><label>Location</label>{commonSelect(pack.location,e=>setPack({...pack,location:e.target.value}),locOpts,"Select location")}</div><div className="tx-field"><label>Conversion Charge</label><input type="number" min="0" value={pack.conversionCharge} onChange={e=>setPack({...pack,conversionCharge:e.target.value})}/></div></div><h4>Source Stock</h4><LineTable lines={packSrc} setter={setPackSrc} allowedTypes={["RAW_MATERIAL","FINISHED_GOODS","GRADE"]}/><button className="tx-btn" onClick={()=>addLine(setPackSrc,"RAW_MATERIAL")}>+ Add Source</button><h4>Packed Output</h4><LineTable lines={packOut} setter={setPackOut} allowedTypes={["PACKED_GOODS"]}/><button className="tx-btn" onClick={()=>addLine(setPackOut,"PACKED_GOODS")}>+ Add Output</button><div className="tx-actions"><button className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/workflow/packing-conversion",{...pack,sourceLines:packSrc,outputLines:packOut},()=>{setPackSrc([blankLine("RAW_MATERIAL")]);setPackOut([blankLine("PACKED_GOODS")])})}>Post Packing Conversion</button></div></div>}

    {tab==="bom"&&bomSection==="entry"&&<>
      <div className="tx-bom-intro"><div className="tx-bom-intro-mark">BOM</div><div><div className="tx-bom-eyebrow">PRODUCT RECIPE</div><h3>BOM Entry</h3><p>Define the finished product, batch size, raw materials and production costs.</p></div><div className="tx-bom-intro-count"><strong>{bom.materials.length}</strong><span>Materials</span></div></div>
      <div className="tx-card">
        <div className="tx-title"><div><h3>BOM / Costing</h3><p>Enter recipe details and the cost components for one output batch.</p></div><span className="tx-bom-status">{bom._id?"EDITING RECIPE":"NEW RECIPE"}</span></div>
        <div className="tx-grid"><div className="tx-field"><label>BOM Name</label><input value={bom.name} onChange={e=>setBom({...bom,name:e.target.value})} placeholder="Enter recipe / BOM name"/></div><div className="tx-field"><label>Output Product</label>{commonSelect(bom.outputItemId,e=>chooseBomOutput(e.target.value),fgItems,"Select output")}</div><div className="tx-field"><label>Output Qty (batch)</label><input type="number" min="1" step="1" value={bom.outputQty} onChange={e=>updateBomOutputQty(e.target.value)}/></div><div className="tx-field"><label>Labour Cost (₹)</label><input type="number" min="0" value={bom.labourCost} onChange={e=>setBom({...bom,labourCost:e.target.value})}/></div><div className="tx-field"><label>Packing Cost (₹)</label><input type="number" min="0" value={bom.packingCost} onChange={e=>setBom({...bom,packingCost:e.target.value})}/></div><div className="tx-field"><label>Other Cost (₹)</label><input type="number" min="0" value={bom.otherCost} onChange={e=>setBom({...bom,otherCost:e.target.value})}/></div></div>
        <div className="tx-bom-section-heading"><div><h4>BOM Materials</h4><p>Raw materials and rates used for the output batch.</p></div><span>{bom.materials.length} line{bom.materials.length===1?"":"s"}</span></div>
        <div className="tx-table-wrap"><table className="tx-table tx-bom-table"><thead><tr><th>Material</th><th>Qty for Output Batch</th><th>Unit</th><th>Rate / Unit</th><th>Batch Cost</th></tr></thead><tbody>{bom.materials.map((x,i)=><tr key={i}><td>{commonSelect(x.itemId,e=>chooseBomMaterial(i,e.target.value),rawItems,"Select material")}</td><td><input type="number" min="0" step="0.000001" value={x.qtyPerUnit} onChange={e=>setBom(b=>({...b,materials:b.materials.map((q,j)=>j===i?{...q,qtyPerUnit:e.target.value}:q)}))}/></td><td><span className="tx-bom-unit">{x.unit||"KG"}</span></td><td><input type="number" min="0" step="0.01" value={x.rate} onChange={e=>setBom(b=>({...b,materials:b.materials.map((q,j)=>j===i?{...q,rate:e.target.value}:q)}))}/>{x.itemId&&<button type="button" className="tx-bom-link" onClick={()=>chooseBomMaterial(i,x.itemId)}>Find purchase rate</button>}</td><td className="tx-bom-money">₹ {money(n(x.qtyPerUnit)*n(x.rate))}</td></tr>)}{!bom.materials.length&&<tr><td colSpan="5" className="tx-bom-empty">Add at least one raw material to this recipe.</td></tr>}</tbody></table></div>
        <div className="tx-subnav tx-bom-inline-actions"><button type="button" className="tx-btn" onClick={()=>setBom(b=>({...b,materials:[...b.materials,{itemId:"",itemName:"",unit:"KG",qtyPerUnit:1,rate:0}]}))}>+ Add Material</button><button type="button" className="tx-btn" onClick={()=>{setBomSection("additional");setTab("bom")}}>Configure Additional Costs →</button></div>
        <div className="tx-kpis tx-bom-kpis" style={{marginTop:16}}><div className="tx-kpi"><b>Material Cost / Batch</b><strong>₹ {money(bomMaterialTotal)}</strong></div><div className="tx-kpi"><b>Additional Costs / Batch</b><strong>₹ {money(bomCostItemsTotal)}</strong></div><div className="tx-kpi"><b>Other Production Costs</b><strong>₹ {money(n(bom.labourCost)+n(bom.packingCost)+n(bom.otherCost))}</strong></div><div className="tx-kpi"><b>Estimated Cost / Unit</b><strong>₹ {money(bomEstimatedUnitCost)}</strong></div></div>
        <div className="tx-actions"><button type="button" className="tx-btn" onClick={()=>{setBom({name:"",outputItemId:"",outputQty:1,labourCost:0,packingCost:0,otherCost:0,materials:[{itemId:"",itemName:"",qtyPerUnit:1,rate:0,unit:"KG"}],costItems:[]});resetFeedback()}}>Clear BOM</button><button type="button" className="tx-btn primary" disabled={busy} onClick={()=>submit("/api/inventory/workflow/boms",bom)}>{busy?"Saving BOM...":"Save BOM"}</button></div>
      </div>
    </>}

    {tab==="bom"&&bomSection==="quick"&&<>
      <div className="tx-bom-intro"><div className="tx-bom-intro-mark amber">QC</div><div><div className="tx-bom-eyebrow">ESTIMATE ONLY</div><h3>Quick Costing</h3><p>Calculate material, labour and per-unit costs without saving a product recipe.</p></div><div className="tx-bom-intro-count"><strong>{cost.materials.length}</strong><span>Cost lines</span></div></div>
      <div className="tx-card"><div className="tx-title"><div><h3>Quick Costing Calculator</h3><p>Enter raw material quantities and rates, then calculate an estimated cost.</p></div><span className="tx-bom-status amber">CALCULATOR</span></div>
        <div className="tx-grid" style={{marginBottom:14}}><div className="tx-field"><label>Output Qty</label><input type="number" min="0.001" value={cost.outputQty} onChange={e=>setCost(c=>({...c,outputQty:e.target.value}))}/></div><div className="tx-field"><label>Labour Cost (₹)</label><input type="number" min="0" value={cost.labourCost} onChange={e=>setCost(c=>({...c,labourCost:e.target.value}))}/></div><div className="tx-field"><label>Packing Cost (₹)</label><input type="number" min="0" value={cost.packingCost} onChange={e=>setCost(c=>({...c,packingCost:e.target.value}))}/></div><div className="tx-field"><label>Other Cost (₹)</label><input type="number" min="0" value={cost.otherCost} onChange={e=>setCost(c=>({...c,otherCost:e.target.value}))}/></div></div>
        <div className="tx-table-wrap"><table className="tx-table tx-bom-table"><thead><tr><th>Material</th><th>Quantity</th><th>Rate / Unit (₹)</th><th>Material Amount (₹)</th><th></th></tr></thead><tbody>{cost.materials.map((x,i)=><tr key={i}><td><input value={x.name} onChange={e=>setCost(c=>({...c,materials:c.materials.map((q,j)=>j===i?{...q,name:e.target.value}:q)}))} placeholder="Material name"/></td><td><input type="number" min="0" step="0.001" value={x.qty} onChange={e=>setCost(c=>({...c,materials:c.materials.map((q,j)=>j===i?{...q,qty:e.target.value}:q)}))}/></td><td><input type="number" min="0" step="0.01" value={x.rate} onChange={e=>setCost(c=>({...c,materials:c.materials.map((q,j)=>j===i?{...q,rate:e.target.value}:q)}))}/></td><td className="tx-bom-money">₹ {money(n(x.qty)*n(x.rate))}</td><td><button type="button" className="tx-mini-danger" aria-label="Remove material" onClick={()=>setCost(c=>({...c,materials:c.materials.filter((_,j)=>j!==i)}))}>×</button></td></tr>)}{!cost.materials.length&&<tr><td colSpan="5" className="tx-bom-empty">Add a material line to calculate cost.</td></tr>}</tbody></table></div>
        <div className="tx-subnav tx-bom-inline-actions"><button type="button" className="tx-btn" onClick={()=>setCost(c=>({...c,materials:[...c.materials,{name:"",qty:1,rate:0}]}))}>+ Add Material</button><button type="button" className="tx-btn primary" onClick={async()=>{try{const d=await post("/api/inventory/workflow/costing",cost);setCostResult(d)}catch(e){setErr(e.message)}}}>Calculate Cost</button></div>
        {costResult&&<div className="tx-kpis tx-bom-kpis" style={{marginTop:14}}><div className="tx-kpi"><b>Material</b><strong>₹ {money(costResult.materialCost)}</strong></div><div className="tx-kpi"><b>Labour</b><strong>₹ {money(costResult.labourCost)}</strong></div><div className="tx-kpi"><b>Total Cost</b><strong>₹ {money(costResult.totalCost)}</strong></div><div className="tx-kpi"><b>Cost Per Unit</b><strong>₹ {money(costResult.costPerUnit)}</strong></div></div>}
      </div>
    </>}

    {tab==="stock"&&<div className="tx-card"><h3>Stock / Ledger</h3><div className="tx-grid"><div className="tx-field"><label>Stock Type</label><select value={stockType} onChange={e=>setStockType(e.target.value)}><option>RAW_MATERIAL</option><option>GRADE</option><option>FINISHED_GOODS</option><option>PACKED_GOODS</option><option>RETURN_GOODS</option><option>REJECTED</option></select></div><div className="tx-field"><label>Location</label>{commonSelect(stockLocation,e=>setStockLocation(e.target.value),locOpts,"All locations")}</div></div><div className="tx-kpis"><div className="tx-kpi"><b>Items</b><strong>{stock.length}</strong></div><div className="tx-kpi"><b>Total Quantity</b><strong>{money(stock.reduce((s,x)=>s+n(x.qty),0))}</strong></div><div className="tx-kpi"><b>Stock Value</b><strong>₹ {money(stock.reduce((s,x)=>s+n(x.stockValue),0))}</strong></div></div><div className="tx-table-wrap" style={{marginTop:12}}><table className="tx-table"><thead><tr><th>Item</th><th>Type</th><th>Location</th><th>Qty · open details</th><th>Unit</th><th>Rate</th><th>Value</th></tr></thead><tbody>{stock.map(x=><tr key={x._id}><td>{x.itemName}</td><td>{x.itemType}</td><td>{locationLabel(x.location)}</td><td><button type="button" className="tx-stock-qty" onClick={()=>showStockMovements(x)} title="Show all stock movements">{x.qty}</button></td><td>{x.unit}</td><td>₹ {money(x.averageRate)}</td><td>₹ {money(x.stockValue)}</td></tr>)}</tbody></table></div></div>}

    {tab==="documents"&&<div className="tx-card"><h3>Workflow Documents & Stock Ledger</h3><div className="tx-table-wrap"><table className="tx-table"><thead><tr><th>No.</th><th>Type</th><th>Date</th><th>Party</th><th>Location</th><th>Value</th></tr></thead><tbody>{docs.map(x=><tr key={x._id}><td>{x.docNo}</td><td>{x.docType}</td><td>{new Date(x.date).toLocaleDateString("en-IN")}</td><td>{x.partyName||"-"}</td><td>{locationLabel(x.location)}</td><td>₹ {money(x.totalValue)}</td></tr>)}</tbody></table></div><h4 style={{marginTop:18}}>Stock Movement Ledger</h4><div className="tx-table-wrap"><table className="tx-table"><thead><tr><th>Date</th><th>Location</th><th>Item</th><th>In</th><th>Out</th><th>Balance</th><th>Source / Detail</th></tr></thead><tbody>{ledger.map(x=><tr key={x._id}><td>{dateOnly(x.date)}</td><td>{locationLabel(x.location)}</td><td>{x.itemName}</td><td><button className="tx-ledger-link" onClick={()=>showStockMovements(x)}>{x.qtyIn||"-"}</button></td><td><button className="tx-ledger-link" onClick={()=>showStockMovements(x)}>{x.qtyOut||"-"}</button></td><td>{x.balanceQty??"-"} {x.unit}</td><td>{x.sourceType} {x.sourceNo||""}<div style={{color:"#667085"}}>{x.narration||x.referenceNo||""}</div></td></tr>)}</tbody></table></div></div>}

    {masterModal&&<div className="tx-stock-overlay" style={{zIndex:3000}} onClick={()=>setMasterModal(null)}><section className="tx-stock-dialog" style={{width:"min(1250px,100%)",padding:0}} role="dialog" aria-modal="true" aria-label="Master form" onClick={e=>e.stopPropagation()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"#123c55",color:"#fff"}}><b>{masterModal.mode==="create"?"Create Master":masterModal.mode==="edit"?"Edit Master":"Master List"} · Voucher stays open</b><button type="button" className="tx-btn" onClick={()=>setMasterModal(null)}>Return to Voucher ×</button></div><div style={{maxHeight:"78vh",overflow:"auto"}}><AccountsMasterCatalog key={`${masterModal.type}-${masterModal.mode}-${masterModal.editId}`} initialType={masterModal.type} initialMode={masterModal.mode} initialEditId={masterModal.editId} onSaved={async()=>{await loadMasters();setMasterModal(null)}}/></div></section></div>}
    {stockDetail&&<div className="tx-stock-overlay" onClick={()=>setStockDetail(null)}><section className="tx-stock-dialog" role="dialog" aria-modal="true" aria-labelledby="tx-stock-title" onClick={e=>e.stopPropagation()}><div className="tx-stock-dialog-head"><div><h2 id="tx-stock-title">Stock Movement Details</h2><p>{stockDetail.itemName} · {stockDetail.itemType} · {locationLabel(stockDetail.location)}{stockDetail.batchNo?` · Batch ${stockDetail.batchNo}`:""}{stockDetail.barcode?` · Barcode ${stockDetail.barcode}`:""}</p></div><button type="button" className="tx-btn" onClick={()=>setStockDetail(null)}>Close</button></div><div className="tx-stock-detail-kpis"><div className="tx-kpi"><b>Current Stock</b><strong>{stockDetail.qty} {stockDetail.unit}</strong></div><div className="tx-kpi"><b>Total Added</b><strong>{money(stockMovements.reduce((sum,x)=>sum+n(x.qtyIn),0))} {stockDetail.unit}</strong></div><div className="tx-kpi"><b>Total Reduced</b><strong>{money(stockMovements.reduce((sum,x)=>sum+n(x.qtyOut),0))} {stockDetail.unit}</strong></div><div className="tx-kpi"><b>Movement Records</b><strong>{stockMovements.length}</strong></div></div>{stockDetailLoading?<div>Loading movement history...</div>:<div className="tx-table-wrap"><table className="tx-table"><thead><tr><th>Date</th><th>Reason</th><th>Document No.</th><th>Reference</th><th>Added</th><th>Reduced</th><th>Balance</th><th>Value</th><th>Details</th></tr></thead><tbody>{stockMovements.map(x=><tr key={x._id}><td>{dateOnly(x.date)}</td><td>{String(x.sourceType||"Movement").replaceAll("_"," ")}</td><td>{x.sourceNo||"-"}</td><td>{x.referenceNo||"-"}</td><td>{n(x.qtyIn)||"-"} {n(x.qtyIn)?x.unit:""}</td><td>{n(x.qtyOut)||"-"} {n(x.qtyOut)?x.unit:""}</td><td>{x.balanceQty??"-"} {x.unit}</td><td>₹ {money(x.valueIn||x.valueOut)}</td><td>{x.narration||"-"}</td></tr>)}{!stockMovements.length&&<tr><td colSpan="9">No movement history found for this item.</td></tr>}</tbody></table></div>}</section></div>}
  </div>
}
