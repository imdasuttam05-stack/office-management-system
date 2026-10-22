import RawMaterialPurchase from "../models/RawMaterialPurchase.js";
import InventoryStock from "../models/InventoryStock.js";
import InventoryCounter from "../models/InventoryCounter.js";
import ManufacturingJobOrder from "../models/ManufacturingJobOrder.js";
import SalesInvoice from "../models/SalesInvoice.js";
import GstLedger from "../models/GstLedger.js";
import LocationMaster from "../models/LocationMaster.js";
import SupplierMaster from "../models/SupplierMaster.js";
import InventoryItemMaster from "../models/InventoryItemMaster.js";
import CustomerMaster from "../models/CustomerMaster.js";
import UnitMaster from "../models/UnitMaster.js";
import Group from "../models/Group.js";
import Ledger from "../models/Ledger.js";
import Voucher from "../models/Voucher.js";
import InventoryMovement from "../models/InventoryMovement.js";
import ProductionEntry from "../models/ProductionEntry.js";
import BOM from "../models/BOM.js";
import InventoryWorkflow from "../models/InventoryWorkflow.js";
function clean(v){return String(v??"").trim()} function num(v){const n=Number(v);return Number.isFinite(n)?n:0} function r2(v){return Math.round((num(v)+Number.EPSILON)*100)/100} function q6(v){return Math.round((num(v)+Number.EPSILON)*1000000)/1000000} function dt(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
function packetWeightKg(name){const match=clean(name).match(/(\d+(?:\.\d+)?)\s*(mg|g|gm|grams?|kg|kgs|kilograms?)\b/i);if(!match)return 0;const amount=Number(match[1]);return q6(/^mg$/i.test(match[2])?amount/1000000:/^kg/i.test(match[2])?amount:amount/1000)}
function packetUnit(unit){return ["PC","PCS","PACKET","PACKETS","PIECE","PIECES"].includes(clean(unit).toUpperCase())}
function plannedOutput(line){const weight=num(line.packetWeightKg)||packetWeightKg(line.itemName),hasPacketPlan=num(line.packetCount)>0;const packetCount=hasPacketPlan?num(line.packetCount):weight>0?(packetUnit(line.unit)?num(line.qty):num(line.qty)/weight):0;const qty=hasPacketPlan&&weight>0?packetCount*weight:weight>0&&!packetUnit(line.unit)?num(line.qty):weight>0?num(line.qty)*weight:num(line.qty);return {packetCount:q6(packetCount),packetWeightKg:weight,qty:q6(qty)}}
function productionOutput(line){const weight=num(line.packetWeightKg)||packetWeightKg(line.itemName),packets=num(line.packetCount);if(packets>0)return {packetCount:q6(packets),packetWeightKg:weight,qty:q6(weight>0?packets*weight:num(line.qty))};if(weight>0&&packetUnit(line.unit))return {packetCount:q6(num(line.qty)),packetWeightKg:weight,qty:q6(num(line.qty)*weight)};if(weight>0)return {packetCount:q6(num(line.qty)/weight),packetWeightKg:weight,qty:q6(num(line.qty))};return {packetCount:0,packetWeightKg:0,qty:q6(num(line.qty))}}
const GSTIN_RE=/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GST_STATE={
"01":"Jammu and Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh","05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh","10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur","15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal","20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh","24":"Gujarat","26":"Dadra and Nagar Haveli and Daman and Diu","27":"Maharashtra","28":"Andhra Pradesh","29":"Karnataka","30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu","34":"Puducherry","35":"Andaman and Nicobar Islands","36":"Telangana","37":"Andhra Pradesh","38":"Ladakh"
};
async function next(key,prefix){
 const y=new Date().getFullYear();
 const counterKey=`${key}_${y}`;
 // Use the native collection here: the legacy unique index key_1 is still present
 // in production, while the company-scope plugin adds companyId to the query.
 // That combination can hide the existing counter and make upsert hit E11000.
 // Updating by the globally unique key reuses/increments the existing counter.
 await InventoryCounter.collection.updateOne(
  {key:counterKey},
  {$inc:{seq:1},$setOnInsert:{key:counterKey}},
  {upsert:true}
 );
 const c=await InventoryCounter.collection.findOne({key:counterKey});
 if(!c)throw new Error(`Unable to create or update inventory counter ${counterKey}.`);
 return `${prefix}-${y}-${String(c.seq).padStart(5,"0")}`;
}
async function adjustStock({companyId,location,itemType,itemName,unit,qty,value,mode="ADD",hsn="",batchNo="",barcode="",mfgDate=null,expiryDate=null}){
 const filter={companyId:companyId||null,location,itemType,itemName,batchNo:batchNo||"",barcode:barcode||""};
 const old=await InventoryStock.findOne(filter).select("qty stockValue").lean(); const oq=num(old?.qty), ov=num(old?.stockValue); const q=mode==="ADD"?qty:-qty; const v=mode==="ADD"?value:-value;
 if(mode!=="ADD" && oq+q < -0.000001) throw new Error(`Insufficient ${itemType} stock for ${itemName}. Available ${oq}, required ${qty}.`);
 const nq=q6(oq+q), nv=r2(Math.max(0,ov+v));
 await InventoryStock.findOneAndUpdate(filter,{$set:{hsn,unit,mfgDate,expiryDate,averageRate:nq?r2(nv/nq):0,lastPurchaseRate:mode==="ADD"?r2(value/(qty||1)):undefined,lastPurchaseDate:mode==="ADD"?new Date():undefined},$inc:{qty:q,stockValue:v},$setOnInsert:{companyId:companyId||null,location,itemType,itemName,batchNo:batchNo||"",barcode:barcode||""}},{upsert:true,new:true});
}
function buildLine(x){const qty=num(x.qty),rate=num(x.purchaseRate),gross=qty*rate,discount=Math.min(Math.max(num(x.discount),0),gross),taxable=r2(gross-discount),gstRate=Math.max(0,Math.min(num(x.gstRate),100)),gstType=["NONE","CGST_SGST","IGST"].includes(x.gstType)?x.gstType:"NONE",gst=gstType==="NONE"?0:r2(taxable*gstRate/100),cgst=gstType==="CGST_SGST"?r2(gst/2):0,sgst=gstType==="CGST_SGST"?r2(gst-cgst):0,igst=gstType==="IGST"?gst:0;return {itemId:clean(x.itemId)||null,itemName:clean(x.itemName),hsn:clean(x.hsn),unit:clean(x.unit)||"KG",batchNo:clean(x.batchNo),barcode:clean(x.barcode),mfgDate:dt(x.mfgDate),expiryDate:dt(x.expiryDate),qty,purchaseRate:rate,discount:r2(discount),taxableAmount:taxable,gstRate,gstType,cgst,sgst,igst,lineTotal:r2(taxable+cgst+sgst+igst),landedCost:0}}
export async function lookupPincode(req,res){
  try{
    const pin=clean(req.params.pin).replace(/\D/g,"");
    if(!/^\d{6}$/.test(pin)) return res.status(400).json({success:false,message:"Enter a valid 6 digit PIN code."});
    const r=await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const d=await r.json(); const po=d?.[0]?.PostOffice;
    if(d?.[0]?.Status!=="Success" || !Array.isArray(po) || !po.length) return res.status(404).json({success:false,message:"PIN code not found."});
    const first=po[0];
    return res.json({success:true,pincode:pin,state:first.State||"",district:first.District||"",postOffices:po.map(x=>x.Name).filter(Boolean),address:(first.Name||"")+(first.District?`, ${first.District}`:"")+(first.State?`, ${first.State}`:"")});
  }catch(e){return res.status(502).json({success:false,message:"PIN lookup service unavailable."})}
}
export async function lookupGSTIN(req,res){
  try{
    const gst=clean(req.params.gstin).toUpperCase();
    if(!GSTIN_RE.test(gst)) return res.status(400).json({success:false,message:"Enter a valid 15 character GSTIN."});
    const state=GST_STATE[gst.slice(0,2)]||"";
    const key=process.env.GSTIN_API_KEY;
    if(!key) return res.json({success:true,source:"gstin-format",gstin:gst,state,verified:false,message:"GST API key is not configured. State was filled from GSTIN."});
    const r=await fetch(`https://www.gstinapi.in/v1/gstin/${gst}?include=profile`,{headers:{"x-api-key":key}});
    const d=await r.json();
    if(!r.ok || !d?.success) return res.status(r.status||400).json({success:false,message:d?.message||"GSTIN verification failed."});
    const x=d.data||{}; const ad=x.address_details||{};
    return res.json({success:true,source:"gstinapi",verified:true,gstin:gst,status:x.status||"",name:x.trade_name||x.legal_name||"",legalName:x.legal_name||"",state:ad.state||GST_STATE[x.state_code]||state,district:ad.district||"",pincode:x.pincode||ad.pincode||"",address:x.address||"",phone:x.phone||""});
  }catch(e){return res.status(502).json({success:false,message:"GST verification service unavailable."})}
}
async function ensureLedger({name, groupName, nature, req, gstin="", address="", phone=""}) {
 const ledgerName=clean(name);
 // Find the intended shared/system group first; the unique legacy index may be {name, group}.
 const groupNameClean=clean(groupName);
 const sharedGroupFilter={name:groupNameClean,parent:null,isActive:{$ne:false},$or:[{companyId:null},{companyId:{$exists:false}}]};
 let group=await Group.findOne({name:groupNameClean,parent:null});
 if(!group)group=await Group.collection.findOne(sharedGroupFilter);
 if(!group){
  try{
   group=await Group.create({name:groupNameClean,parent:null,nature,isSystem:true});
  }catch(error){
   // Another request may have created this group after our first lookup.
   if(error?.code!==11000)throw error;
   group=await Group.findOne({name:groupNameClean,parent:null});
   if(!group)group=await Group.collection.findOne(sharedGroupFilter);
   if(!group)throw error;
  }
 }
 // Bypass company-scope filtering so an existing ledger hidden by the scope plugin
 // is reused instead of triggering E11000 on the database's unique name/group index.
 let existing=await Ledger.collection.findOne({name:ledgerName,group:group._id});
 if(existing){
  if(existing.isActive===false){
   await Ledger.collection.updateOne({_id:existing._id},{$set:{isActive:true}});
   existing.isActive=true;
  }
  return existing;
 }
 try{
  return await Ledger.create({name:ledgerName,group:group._id,gstin:clean(gstin).toUpperCase(),address:clean(address),phone:clean(phone),createdBy:req.user._id});
 }catch(error){
  // Recover if a concurrent request inserted the same ledger after our lookup.
  if(error?.code!==11000)throw error;
  existing=await Ledger.collection.findOne({name:ledgerName,group:group._id});
  if(!existing)throw error;
  if(existing.isActive===false){
   await Ledger.collection.updateOne({_id:existing._id},{$set:{isActive:true}});
   existing.isActive=true;
  }
  return existing;
 }
}
async function ensureGstLedger(name,req){return ensureLedger({name,groupName:"Duties & Taxes",nature:"Liability",req});}
async function createAutoVoucher({req,date,type,partyLedger,referenceNo,narration,lines,sourceType,sourceId}){
 const normalized=lines.map(x=>({ledger:x.ledger,debit:r2(x.debit),credit:r2(x.credit),narration:x.narration||narration||""}));
 const totalDebit=r2(normalized.reduce((s,x)=>s+x.debit,0)),totalCredit=r2(normalized.reduce((s,x)=>s+x.credit,0));
 if(totalDebit<=0||Math.abs(totalDebit-totalCredit)>0.005)throw new Error("Automatic accounting voucher is not balanced.");
 const prefix=type.slice(0,3).toUpperCase();
 const year=new Date(date).getFullYear();
 const pattern=`^${prefix}-${year}-\\d{5}$`;
 const base={date,type,partyLedger,referenceNo,narration,lines:normalized,totalDebit,totalCredit,sourceType,sourceId,createdBy:req.user._id};
 // Do not use countDocuments({type}) for numbering: scoped queries and deleted/gapped
 // voucher numbers can make the count point to an already-used voucherNo.
 // Read the latest number from the raw collection to bypass company-scoped middleware.
 for(let attempt=0;attempt<10;attempt++){
  const latestRows=await Voucher.collection.find({voucherNo:{$regex:pattern}}).sort({voucherNo:-1}).limit(1).toArray();
  const latest=latestRows[0]?.voucherNo||"";
  const lastSeq=latest?Number(latest.slice(latest.lastIndexOf("-")+1))||0:0;
  const voucherNo=`${prefix}-${year}-${String(lastSeq+1).padStart(5,"0")}`;
  try{
   return await Voucher.create({...base,voucherNo});
  }catch(error){
   // If another request used the same number concurrently, retry from the new maximum.
   if(error?.code!==11000 || !(error?.keyPattern?.voucherNo || /voucherNo_1/.test(error?.message||"")))throw error;
  }
 }
 throw new Error(`Could not allocate a unique ${prefix} voucher number after several attempts. Please retry Save.`);
}

export async function getPurchaseMasters(req,res){
 try{
  const companyId=req.user?.companyId||null;
  const companyScope=companyId
   ? {$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]}
   : {$or:[{companyId:null},{companyId:{$exists:false}}]};
  const activeScope={$or:[{active:true},{active:{$exists:false}},{active:null}]};
  const masterScope={$and:[companyScope,activeScope]};
  const creditorGroup=await Group.findOne({name:"Sundry Creditors",parent:null}).select("_id").lean();
  const [locations,suppliers,items,customers,units,creditorLedgers]=await Promise.all([
   LocationMaster.find(masterScope).sort({name:1}).lean(),
   SupplierMaster.find(masterScope).populate("ledgerId","name").sort({name:1}).lean(),
   InventoryItemMaster.find({$and:[companyScope,activeScope]}).populate("purchaseLedgerId salesLedgerId","name").sort({itemType:1,name:1}).lean(),
   CustomerMaster.find(masterScope).populate("ledgerId","name").sort({name:1}).lean(),
  UnitMaster.find(masterScope).sort({name:1}).lean(),
  creditorGroup?Ledger.find({group:creditorGroup._id,isActive:true}).sort({name:1}).lean():[]
  ]);
  return res.json({success:true,locations,suppliers,items,customers,units,creditorLedgers});
 }catch(e){return res.status(500).json({success:false,message:e.message||"Master data load failed."})}
}

export async function createLocationMaster(req,res){try{const b=req.body||{},name=clean(b.name);if(!name)return res.status(400).json({success:false,message:"Location / Godown name is required."});const code=clean(b.code).toUpperCase()||await next("LOCATION","LOC");const row=await LocationMaster.create({companyId:req.user?.companyId||null,name,code,pin:clean(b.pin),state:clean(b.state),district:clean(b.district),address:clean(b.address),createdBy:req.user._id});return res.status(201).json({success:true,message:"Location / Godown master created.",item:row});}catch(e){return res.status(400).json({success:false,message:e.code===11000?"Location / Godown already exists.":e.message})}}
export async function createSupplierMaster(req,res){try{const b=req.body||{},name=clean(b.name);if(!name)return res.status(400).json({success:false,message:"Supplier name is required."});const row=await SupplierMaster.create({companyId:req.user?.companyId||null,name,gstin:clean(b.gstin).toUpperCase(),state:clean(b.state),district:clean(b.district),pin:clean(b.pin),phone:clean(b.phone),address:clean(b.address),gstStatus:clean(b.gstStatus),createdBy:req.user._id});return res.status(201).json({success:true,message:"Supplier master created.",item:row});}catch(e){return res.status(400).json({success:false,message:e.code===11000?"Supplier already exists.":e.message})}}
export async function createInventoryItemMaster(req,res){try{const b=req.body||{},name=clean(b.name);if(!name)return res.status(400).json({success:false,message:"Item name is required."});const itemType=["RAW_MATERIAL","GRADE","FINISHED_GOODS","PACKED_GOODS","RETURN_GOODS","REJECTED"].includes(b.itemType)?b.itemType:"RAW_MATERIAL";const row=await InventoryItemMaster.create({companyId:req.user?.companyId||null,name,itemType,hsn:clean(b.hsn),unit:clean(b.unit)||"KG",defaultGstRate:Math.max(0,Math.min(num(b.defaultGstRate),100)),defaultBarcode:clean(b.defaultBarcode),createdBy:req.user._id});return res.status(201).json({success:true,message:"Item master created.",item:row});}catch(e){return res.status(400).json({success:false,message:e.code===11000?"Item already exists.":e.message})}}
export async function createUnitMaster(req,res){
 try{
  const b=req.body||{}, name=clean(b.name), code=clean(b.code).toUpperCase();
  if(!name||!code)return res.status(400).json({success:false,message:"Unit name and unit code are required."});
  const decimalPlaces=Math.max(0,Math.min(6,Number(b.decimalPlaces)||0));
  const row=await UnitMaster.create({companyId:req.user?.companyId||null,name,code,decimalPlaces,createdBy:req.user._id});
  return res.status(201).json({success:true,message:"Unit master created.",item:row});
 }catch(e){return res.status(400).json({success:false,message:e.code===11000?"Unit name or code already exists.":e.message})}
}
export async function updateUnitMaster(req,res){
 try{
  const b=req.body||{}, name=clean(b.name), code=clean(b.code).toUpperCase();
  if(!name||!code)return res.status(400).json({success:false,message:"Unit name and unit code are required."});
  const decimalPlaces=Math.max(0,Math.min(6,Number(b.decimalPlaces)||0));
  const row=await UnitMaster.findOneAndUpdate({_id:req.params.id,companyId:req.user?.companyId||null},
   {$set:{name,code,decimalPlaces}},{new:true,runValidators:true});
  if(!row)return res.status(404).json({success:false,message:"Unit not found."});
  return res.json({success:true,message:"Unit master updated.",item:row});
 }catch(e){return res.status(400).json({success:false,message:e.code===11000?"Unit name or code already exists.":e.message})}
}
export async function deleteUnitMaster(req,res){
 try{
  const row=await UnitMaster.findOneAndUpdate({_id:req.params.id,companyId:req.user?.companyId||null},{$set:{active:false}},{new:true});
  if(!row)return res.status(404).json({success:false,message:"Unit not found."});
  return res.json({success:true,message:"Unit master deleted.",item:row});
 }catch(e){return res.status(400).json({success:false,message:e.message})}
}

export async function createRawMaterialPurchase(req,res){
  try{
    const b=req.body||{},location=clean(b.location),supplierName=clean(b.supplierName),raw=Array.isArray(b.lines)?b.lines:[];
    if(!location||!supplierName||!raw.length)return res.status(400).json({success:false,message:"Location, Supplier and at least one line are required."});
    const companyId=req.user?.companyId||null;
    const supplierScope={$and:[{$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]},{$or:[{active:true},{active:{$exists:false}},{active:null}]}]};
    let supplier=b.supplierId?await SupplierMaster.findOne({$and:[{_id:b.supplierId},...supplierScope.$and]}):await SupplierMaster.findOne({$and:[{name:supplierName},...supplierScope.$and]});
    let creditorLedger=null;
    const selectedLedgerId=b.supplierLedgerId||(!supplier?b.supplierId:"");
    if(selectedLedgerId){
      creditorLedger=await Ledger.findById(selectedLedgerId).populate("group","name");
      if(!creditorLedger||!creditorLedger.isActive||creditorLedger.group?.name!=="Sundry Creditors")throw new Error("Selected ledger must be an active Sundry Creditors ledger.");
    }
    if(!supplier&&creditorLedger){
      supplier=await SupplierMaster.findOneAndUpdate({companyId,name:supplierName},{$set:{gstin:clean(b.supplierGSTIN||creditorLedger.gstin).toUpperCase(),address:creditorLedger.address||"",phone:creditorLedger.phone||"",ledgerId:creditorLedger._id,active:true,createdBy:req.user._id},$setOnInsert:{companyId,name:supplierName}},{new:true,upsert:true,setDefaultsOnInsert:true});
    }
    if(!supplier)return res.status(400).json({success:false,message:"Select a Supplier or an active Sundry Creditors ledger."});
    const supplierLedger=supplier.ledgerId?await Ledger.findById(supplier.ledgerId):creditorLedger||await ensureLedger({name:supplier.name,groupName:"Sundry Creditors",nature:"Liability",req,gstin:supplier.gstin,address:supplier.address,phone:supplier.phone});
    if(!supplier.ledgerId){supplier.ledgerId=supplierLedger._id;await supplier.save();}
    const purchaseLedger=await ensureLedger({name:"Purchase",groupName:"Purchase",nature:"Expense",req});
    const inputCgst=await ensureGstLedger("Input CGST",req),inputSgst=await ensureGstLedger("Input SGST",req),inputIgst=await ensureGstLedger("Input IGST",req);
    const lines=raw.map(buildLine);
    for(const x of lines){
      if(!x.itemId){
        const item=await InventoryItemMaster.findOne({name:x.itemName,companyId});
        if(item)x.itemId=item._id;
      }
    }
    if(lines.some(x=>!x.itemName||x.qty<=0||x.purchaseRate<0))return res.status(400).json({success:false,message:"Each raw material needs item, quantity and rate."});
    const subtotal=r2(lines.reduce((s,x)=>s+x.taxableAmount,0)),cg=r2(lines.reduce((s,x)=>s+x.cgst,0)),sg=r2(lines.reduce((s,x)=>s+x.sgst,0)),ig=r2(lines.reduce((s,x)=>s+x.igst,0)),transport=Math.max(0,num(b.transportCost)),other=Math.max(0,num(b.otherCost)),extra=transport+other,totalQty=lines.reduce((s,x)=>s+x.qty,0)||1;
    lines.forEach(x=>x.landedCost=r2(x.taxableAmount+extra*x.qty/totalQty));
    const purchaseNo=await next("RAW_PURCHASE","RMP");
    const purchase=await RawMaterialPurchase.create({purchaseNo,date:dt(b.date)||new Date(),companyId,location,supplierId:supplier._id,supplierLedgerId:supplierLedger._id,supplierName,supplierGSTIN:clean(b.supplierGSTIN||supplier.gstin).toUpperCase(),supplierInvoiceNo:clean(b.supplierInvoiceNo),supplierInvoiceDate:dt(b.supplierInvoiceDate),transportCost:transport,otherCost:other,subtotal,totalCGST:cg,totalSGST:sg,totalIGST:ig,grandTotal:r2(subtotal+cg+sg+ig+transport+other),remarks:clean(b.remarks),lines,createdBy:req.user._id});
    for(const x of lines){await adjustStock({companyId,location,itemType:"RAW_MATERIAL",itemName:x.itemName,unit:x.unit,qty:x.qty,value:x.landedCost,hsn:x.hsn,batchNo:x.batchNo,barcode:x.barcode,mfgDate:x.mfgDate,expiryDate:x.expiryDate});const stock=await InventoryStock.findOne({companyId:companyId||null,location,itemType:"RAW_MATERIAL",itemName:x.itemName,batchNo:x.batchNo||"",barcode:x.barcode||""}).lean();await InventoryMovement.create({companyId,date:purchase.date,location,itemName:x.itemName,itemType:"RAW_MATERIAL",unit:x.unit||"KG",qtyIn:x.qty,valueIn:x.landedCost,balanceQty:num(stock?.qty),sourceType:"PURCHASE",sourceNo:purchaseNo,referenceNo:clean(b.supplierInvoiceNo)||purchaseNo,batchNo:x.batchNo||"",barcode:x.barcode||"",narration:`Raw material purchased from ${supplierName} (${purchaseNo})`,createdBy:req.user._id});await GstLedger.create({companyId,sourceType:"PURCHASE",sourceId:purchase._id,documentNo:purchaseNo,date:purchase.date,partyName:supplierName,partyGSTIN:purchase.supplierGSTIN,location,hsn:x.hsn,taxableAmount:x.taxableAmount,cgst:x.cgst,sgst:x.sgst,igst:x.igst,gstRate:x.gstRate,supplyType:x.gstType});}
    const voucherLines=[{ledger:purchaseLedger._id,debit:subtotal+transport+other,credit:0,narration:`Purchase ${purchaseNo}`},{ledger:supplierLedger._id,debit:0,credit:subtotal+cg+sg+ig+transport+other,narration:`Payable to ${supplier.name}`}];
    if(cg)voucherLines.push({ledger:inputCgst._id,debit:cg,credit:0,narration:`Input CGST ${purchaseNo}`});
    if(sg)voucherLines.push({ledger:inputSgst._id,debit:sg,credit:0,narration:`Input SGST ${purchaseNo}`});
    if(ig)voucherLines.push({ledger:inputIgst._id,debit:ig,credit:0,narration:`Input IGST ${purchaseNo}`});
    const voucher=await createAutoVoucher({req,date:purchase.date,type:"Purchase",partyLedger:supplierLedger._id,referenceNo:purchaseNo,narration:`Automatic purchase accounting for ${purchaseNo}`,lines:voucherLines,sourceType:"RAW_MATERIAL_PURCHASE",sourceId:purchase._id});
    return res.status(201).json({success:true,message:`Purchase ${purchaseNo} posted, stock updated and accounting voucher ${voucher.voucherNo} created.`,purchase,voucher});
  }catch(e){console.error(e);return res.status(500).json({success:false,message:e.message||"Purchase failed."})}
}
export async function getRawMaterialPurchases(req,res){try{return await listModel(req,res,RawMaterialPurchase,{status:"POSTED"},[{purchaseNo:1},{supplierName:1},{"lines.itemName":1}])}catch(e){return res.status(500).json({success:false,message:e.message})}}
async function getEditablePurchase(req){return RawMaterialPurchase.findOne({_id:req.params.id,companyId:req.user?.companyId||null,status:"POSTED"})}
async function assertPurchaseEditable(purchase,companyId){const allocated=await ManufacturingJobOrder.exists({companyId:companyId||null,status:{$ne:"CANCELLED"},"sourceItems.purchaseAllocations.purchaseId":purchase._id});if(allocated)throw new Error("This purchase is linked to a Job Order and cannot be edited or deleted.")}
async function assertPurchaseStockAvailable(purchase,companyId){const totals=new Map();for(const line of purchase.lines||[]){const key=JSON.stringify([purchase.location,line.itemName,line.batchNo||"",line.barcode||""]);const entry=totals.get(key)||{line,qty:0};entry.qty+=num(line.qty);totals.set(key,entry)}for(const {line,qty} of totals.values()){const stock=await InventoryStock.findOne({companyId:companyId||null,location:purchase.location,itemType:"RAW_MATERIAL",itemName:line.itemName,batchNo:line.batchNo||"",barcode:line.barcode||""}).select("qty").lean();if(num(stock?.qty)+0.000001<qty)throw new Error(`Cannot edit or delete this purchase because ${line.itemName} stock has already been used. Available ${num(stock?.qty)}, purchase quantity ${qty}.`)}}
async function normalizePurchaseEdit(req,b){const location=clean(b.location),supplierName=clean(b.supplierName),raw=Array.isArray(b.lines)?b.lines:[],companyId=req.user?.companyId||null;if(!location||!supplierName||!raw.length)throw new Error("Location, Supplier and at least one line are required.");const supplier=await SupplierMaster.findOne({$and:[{$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]},{name:supplierName},{$or:[{active:true},{active:{$exists:false}},{active:null}]}]});if(!supplier)throw new Error("Supplier master not found. Create the supplier first.");const supplierLedger=supplier.ledgerId?await Ledger.findById(supplier.ledgerId):await ensureLedger({name:supplier.name,groupName:"Sundry Creditors",nature:"Liability",req,gstin:supplier.gstin,address:supplier.address,phone:supplier.phone});if(!supplier.ledgerId){supplier.ledgerId=supplierLedger._id;await supplier.save();}const lines=raw.map(buildLine);for(const line of lines){if(!line.itemId){const item=await InventoryItemMaster.findOne({name:line.itemName,companyId});if(item)line.itemId=item._id;}}if(lines.some(line=>!line.itemName||line.qty<=0||line.purchaseRate<0))throw new Error("Each raw material needs item, quantity and rate.");const subtotal=r2(lines.reduce((sum,line)=>sum+line.taxableAmount,0)),totalCGST=r2(lines.reduce((sum,line)=>sum+line.cgst,0)),totalSGST=r2(lines.reduce((sum,line)=>sum+line.sgst,0)),totalIGST=r2(lines.reduce((sum,line)=>sum+line.igst,0)),transportCost=Math.max(0,num(b.transportCost)),otherCost=Math.max(0,num(b.otherCost)),totalQty=lines.reduce((sum,line)=>sum+line.qty,0)||1;lines.forEach(line=>line.landedCost=r2(line.taxableAmount+(transportCost+otherCost)*line.qty/totalQty));return {companyId,location,supplier,supplierLedger,lines,date:dt(b.date)||new Date(),supplierGSTIN:clean(b.supplierGSTIN||supplier.gstin).toUpperCase(),supplierInvoiceNo:clean(b.supplierInvoiceNo),supplierInvoiceDate:dt(b.supplierInvoiceDate),transportCost,otherCost,subtotal,totalCGST,totalSGST,totalIGST,grandTotal:r2(subtotal+totalCGST+totalSGST+totalIGST+transportCost+otherCost),remarks:clean(b.remarks)}}
async function recordPurchaseMovements(req,purchase){for(const line of purchase.lines){const stock=await InventoryStock.findOne({companyId:purchase.companyId||null,location:purchase.location,itemType:"RAW_MATERIAL",itemName:line.itemName,batchNo:line.batchNo||"",barcode:line.barcode||""}).select("qty").lean();await InventoryMovement.create({companyId:purchase.companyId||null,date:purchase.date,location:purchase.location,itemName:line.itemName,itemType:"RAW_MATERIAL",unit:line.unit||"KG",qtyIn:line.qty,valueIn:line.landedCost,balanceQty:num(stock?.qty),sourceType:"PURCHASE",sourceNo:purchase.purchaseNo,referenceNo:purchase.supplierInvoiceNo||purchase.purchaseNo,batchNo:line.batchNo||"",barcode:line.barcode||"",narration:`Raw material purchased from ${purchase.supplierName} (${purchase.purchaseNo})`,createdBy:req.user._id});await GstLedger.create({companyId:purchase.companyId||null,sourceType:"PURCHASE",sourceId:purchase._id,documentNo:purchase.purchaseNo,date:purchase.date,partyName:purchase.supplierName,partyGSTIN:purchase.supplierGSTIN,location:purchase.location,hsn:line.hsn,taxableAmount:line.taxableAmount,cgst:line.cgst,sgst:line.sgst,igst:line.igst,gstRate:line.gstRate,supplyType:line.gstType})}}
function purchaseVoucherLines(purchase,purchaseLedger,supplierLedger,inputCgst,inputSgst,inputIgst){const lines=[{ledger:purchaseLedger._id,debit:purchase.subtotal+purchase.transportCost+purchase.otherCost,credit:0,narration:`Purchase ${purchase.purchaseNo}`},{ledger:supplierLedger._id,debit:0,credit:purchase.grandTotal,narration:`Payable to ${purchase.supplierName}`}];if(purchase.totalCGST)lines.push({ledger:inputCgst._id,debit:purchase.totalCGST,credit:0,narration:`Input CGST ${purchase.purchaseNo}`});if(purchase.totalSGST)lines.push({ledger:inputSgst._id,debit:purchase.totalSGST,credit:0,narration:`Input SGST ${purchase.purchaseNo}`});if(purchase.totalIGST)lines.push({ledger:inputIgst._id,debit:purchase.totalIGST,credit:0,narration:`Input IGST ${purchase.purchaseNo}`});return lines}
export async function updateRawMaterialPurchase(req,res){try{const purchase=await getEditablePurchase(req);if(!purchase)return res.status(404).json({success:false,message:"Purchase not found."});const companyId=req.user?.companyId||null;await assertPurchaseEditable(purchase,companyId);await assertPurchaseStockAvailable(purchase,companyId);const values=await normalizePurchaseEdit(req,req.body||{});for(const line of purchase.lines)await adjustStock({companyId,location:purchase.location,itemType:"RAW_MATERIAL",itemName:line.itemName,unit:line.unit,qty:line.qty,value:line.landedCost,mode:"SUBTRACT",hsn:line.hsn,batchNo:line.batchNo,barcode:line.barcode,mfgDate:line.mfgDate,expiryDate:line.expiryDate});Object.assign(purchase,{date:values.date,location:values.location,supplierId:values.supplier._id,supplierLedgerId:values.supplierLedger._id,supplierName:values.supplier.name,supplierGSTIN:values.supplierGSTIN,supplierInvoiceNo:values.supplierInvoiceNo,supplierInvoiceDate:values.supplierInvoiceDate,transportCost:values.transportCost,otherCost:values.otherCost,subtotal:values.subtotal,totalCGST:values.totalCGST,totalSGST:values.totalSGST,totalIGST:values.totalIGST,grandTotal:values.grandTotal,remarks:values.remarks,lines:values.lines,updatedBy:req.user._id});await purchase.save();for(const line of purchase.lines)await adjustStock({companyId,location:purchase.location,itemType:"RAW_MATERIAL",itemName:line.itemName,unit:line.unit,qty:line.qty,value:line.landedCost,hsn:line.hsn,batchNo:line.batchNo,barcode:line.barcode,mfgDate:line.mfgDate,expiryDate:line.expiryDate});await InventoryMovement.deleteMany({companyId,sourceType:"PURCHASE",sourceNo:purchase.purchaseNo});await GstLedger.deleteMany({companyId,sourceType:"PURCHASE",sourceId:purchase._id});await recordPurchaseMovements(req,purchase);const purchaseLedger=await ensureLedger({name:"Purchase",groupName:"Purchase",nature:"Expense",req}),inputCgst=await ensureGstLedger("Input CGST",req),inputSgst=await ensureGstLedger("Input SGST",req),inputIgst=await ensureGstLedger("Input IGST",req),voucherLines=purchaseVoucherLines(purchase,purchaseLedger,values.supplierLedger,inputCgst,inputSgst,inputIgst),voucher=await Voucher.findOne({sourceType:"RAW_MATERIAL_PURCHASE",sourceId:purchase._id});if(voucher){voucher.date=purchase.date;voucher.partyLedger=values.supplierLedger._id;voucher.referenceNo=purchase.purchaseNo;voucher.narration=`Automatic purchase accounting for ${purchase.purchaseNo}`;voucher.lines=voucherLines.map(line=>({ledger:line.ledger,debit:r2(line.debit),credit:r2(line.credit),narration:line.narration}));voucher.totalDebit=r2(voucher.lines.reduce((sum,line)=>sum+line.debit,0));voucher.totalCredit=r2(voucher.lines.reduce((sum,line)=>sum+line.credit,0));await voucher.save()}else await createAutoVoucher({req,date:purchase.date,type:"Purchase",partyLedger:values.supplierLedger._id,referenceNo:purchase.purchaseNo,narration:`Automatic purchase accounting for ${purchase.purchaseNo}`,lines:voucherLines,sourceType:"RAW_MATERIAL_PURCHASE",sourceId:purchase._id});return res.json({success:true,message:`Purchase ${purchase.purchaseNo} updated. Stock and accounting were updated.`,purchase})}catch(e){return res.status(400).json({success:false,message:e.message||"Purchase update failed."})}}
export async function deleteRawMaterialPurchase(req,res){try{const purchase=await getEditablePurchase(req);if(!purchase)return res.status(404).json({success:false,message:"Purchase not found."});const companyId=req.user?.companyId||null;await assertPurchaseEditable(purchase,companyId);await assertPurchaseStockAvailable(purchase,companyId);for(const line of purchase.lines)await adjustStock({companyId,location:purchase.location,itemType:"RAW_MATERIAL",itemName:line.itemName,unit:line.unit,qty:line.qty,value:line.landedCost,mode:"SUBTRACT",hsn:line.hsn,batchNo:line.batchNo,barcode:line.barcode,mfgDate:line.mfgDate,expiryDate:line.expiryDate});await InventoryMovement.deleteMany({companyId,sourceType:"PURCHASE",sourceNo:purchase.purchaseNo});await GstLedger.deleteMany({companyId,sourceType:"PURCHASE",sourceId:purchase._id});await Voucher.deleteMany({sourceType:"RAW_MATERIAL_PURCHASE",sourceId:purchase._id});await purchase.deleteOne();return res.json({success:true,message:`Purchase ${purchase.purchaseNo} deleted and stock reversed.`})}catch(e){return res.status(400).json({success:false,message:e.message||"Purchase delete failed."})}}
async function listModel(req,res,Model,base,searchFields){const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(5,Number(req.query.limit)||20)),filter={...base};if(req.user?.companyId&&Model.schema.path("companyId"))filter.companyId=req.user.companyId;const q=clean(req.query.search);if(q)filter.$or=searchFields.map(f=>Object.fromEntries([[Object.keys(f)[0],{$regex:q,$options:"i"}]]));const [items,total]=await Promise.all([Model.find(filter).sort({date:-1,createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),Model.countDocuments(filter)]);return res.json({success:true,items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}})}
export async function getRawMaterialStock(req,res){return stockList(req,res,"RAW_MATERIAL")}
export async function getStock(req,res){return stockList(req,res,clean(req.query.itemType)||"RAW_MATERIAL")}
async function stockList(req,res,itemType){try{const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(5,Number(req.query.limit)||25)),filter={itemType,qty:{$gt:0}};if(req.user?.companyId)filter.companyId=req.user.companyId;if(clean(req.query.location))filter.location=clean(req.query.location);if(clean(req.query.search))filter.itemName={$regex:clean(req.query.search),$options:"i"};const [items,total]=await Promise.all([InventoryStock.find(filter).sort({itemName:1}).skip((page-1)*limit).limit(limit).lean(),InventoryStock.countDocuments(filter)]);return res.json({success:true,items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}})}catch(e){return res.status(500).json({success:false,message:e.message})}}
async function getPurchaseAllocation({companyId,location,itemId,itemName,requiredQty}){
  const purchaseFilter={status:"POSTED"};
  if(companyId) purchaseFilter.companyId=companyId;
  const purchases=await RawMaterialPurchase.find(purchaseFilter).sort({date:1,createdAt:1}).lean();
  const jobsFilter={status:{$ne:"CANCELLED"}};
  if(companyId) jobsFilter.companyId=companyId;
  if(location) jobsFilter.location=location;
  const jobs=await ManufacturingJobOrder.find(jobsFilter).sort({date:1,createdAt:1}).lean();
  const usedByPurchase={};
  for(const j of jobs){
    for(const line of j.sourceItems||[]){
      if(String(line.itemId||"")!==String(itemId||"") && clean(line.itemName).toLowerCase()!==clean(itemName).toLowerCase()) continue;
      for(const a of line.purchaseAllocations||[]){
        const k=String(a.purchaseId||"")+":"+String(a.lineId||"");
        usedByPurchase[k]=(usedByPurchase[k]||0)+num(a.qty);
      }
    }
  }
  let remain=Math.max(0,num(requiredQty));
  const allocations=[];
  for(const p of purchases){
    for(const line of p.lines||[]){
      const same=String(line.itemId||"")===String(itemId||"") || clean(line.itemName).toLowerCase()===clean(itemName).toLowerCase();
      if(!same) continue;
      const key=String(p._id)+":"+String(line._id);
      const already=usedByPurchase[key]||0;
      const pending=Math.max(0,num(line.qty)-already);
      if(pending<=0) continue;
      const take=Math.min(remain,pending);
      allocations.push({purchaseId:p._id,lineId:line._id,purchaseNo:p.purchaseNo,date:p.date,supplierName:p.supplierName,qty:take,purchaseQty:num(line.qty),pendingAfter:q6(pending-take),rate:num(line.purchaseRate),unit:line.unit||"KG"});
      remain=q6(remain-take);
      if(remain<=0.000001) break;
    }
    if(remain<=0.000001) break;
  }
  const allocated=q6(num(requiredQty)-remain);
  const weightedRate=allocated>0?r2(allocations.reduce((sum,a)=>sum+a.qty*a.rate,0)/allocated):0;
  return {requiredQty:q6(requiredQty),allocatedQty:allocated,shortQty:q6(remain),weightedRate,allocations};
}

export async function getBomProductionRequirements(req,res){
 try{
  const outputItemId=clean(req.query.outputItemId),location=clean(req.query.location),qty=num(req.query.qty),companyId=req.user?.companyId||null;
  if(!outputItemId||qty<=0)return res.status(400).json({success:false,message:"Output product and production quantity are required."});
  const output=await InventoryItemMaster.findOne({_id:outputItemId,companyId,active:true}).select("name").lean();
  if(!output)return res.status(404).json({success:false,message:"Selected Finished Good was not found in this company."});
  const bomScope={companyId,active:true};
  let bom=await BOM.findOne({...bomScope,outputItemId}).lean();
  if(!bom){
   const sameNameBoms=await BOM.find({...bomScope,outputItemName:output.name}).sort({updatedAt:-1}).limit(2).lean();
   if(sameNameBoms.length===1)bom=sameNameBoms[0];
   else if(sameNameBoms.length>1)return res.status(409).json({success:false,message:`More than one active BOM matches ${output.name}. Edit the BOM and select this Finished Good again.`});
  }
  if(!bom)return res.status(404).json({success:false,message:`Active BOM not found for ${output.name}. Check that BOM History uses the same Finished Good and company.`});
  const scale=qty/num(bom.outputQty||1);
  const materials=[];
  for(const m of bom.materials||[]){
    const required=q6(num(m.qtyPerUnit)*scale);
    const allocation=await getPurchaseAllocation({companyId:req.user?.companyId||null,location,itemId:m.itemId,itemName:m.itemName,requiredQty:required});
    materials.push({...m,requiredQty:required,rate:allocation.weightedRate||num(m.rate),value:r2(required*(allocation.weightedRate||num(m.rate))),purchaseAllocation:allocation.allocations,shortQty:allocation.shortQty});
  }
  return res.json({success:true,bom,outputQty:qty,materials,totalMaterialCost:r2(materials.reduce((s,x)=>s+x.value,0)),ready:materials.every(x=>x.shortQty<=0.000001)});
 }catch(e){return res.status(500).json({success:false,message:e.message})}
}

export async function createJobOrder(req,res){
 try{
  const b=req.body||{},type=b.type,location=clean(b.location),sources=Array.isArray(b.sourceItems)?b.sourceItems:[],outputs=Array.isArray(b.outputItems)?b.outputItems:[];
  if(!["GRADING","FINISHED_GOODS"].includes(type)||!location||!sources.length||!outputs.length)return res.status(400).json({success:false,message:"Type, location, source items and output items are required."});
  const companyId=req.user?.companyId||null,requestedJobNo=clean(b.jobNo),jobNoMode=clean(b.jobNoMode)||(requestedJobNo?"MANUAL":"AUTO");
  if(!["AUTO","MANUAL"].includes(jobNoMode))return res.status(400).json({success:false,message:"Select Auto Generate or Manual Entry for Job Order No."});
  if(jobNoMode==="MANUAL"&&!requestedJobNo)return res.status(400).json({success:false,message:"Enter a Job Order No. or select Auto Generate."});
  if(jobNoMode==="MANUAL"){
   const duplicate=await ManufacturingJobOrder.findOne({jobNo:requestedJobNo,companyId}).select("_id").lean();
   if(duplicate)return res.status(409).json({success:false,message:`Job Order No. ${requestedJobNo} already exists. Enter a different number.`});
  }
  const allowedIn="RAW_MATERIAL", allowedOut=type==="GRADING"?"GRADE":"FINISHED_GOODS";
  let sourceValue=0;
  for(const x of sources){
   const q=num(x.qty),rate=num(x.rate); if(q<=0)throw new Error(`Invalid source quantity for ${x.itemName}.`);
   const st=await InventoryStock.findOne({companyId:req.user?.companyId||null,location,itemType:allowedIn,itemName:clean(x.itemName),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});
   if(!st||num(st.qty)<q)throw new Error(`Insufficient Raw Material stock for ${x.itemName}. Available ${num(st?.qty)}.`);
   sourceValue+=q*(rate>0?rate:num(st.averageRate));
  }
  for(const x of outputs){const plan=plannedOutput(x);if(plan.qty<=0||!clean(x.itemName))throw new Error("Every output needs item and quantity.");}
  const labour=Math.max(0,num(b.labourCost)),transport=Math.max(0,num(b.transportCost)),other=Math.max(0,num(b.otherCost)),totalCost=r2(sourceValue+labour+transport+other);
  const jobNo=jobNoMode==="MANUAL"?requestedJobNo:await next(type==="GRADING"?"GRADING_JOB":"FG_JOB",type==="GRADING"?"GRD":"FGJ");
  let party=b.partyId&&/^[a-f\d]{24}$/i.test(clean(b.partyId))?await CustomerMaster.findOne({$and:[{_id:b.partyId},{$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]},{$or:[{active:true},{active:{$exists:false}},{active:null}]}]}):null;
  const partyName=clean(party?.name||b.partyName);
  if(b.partyId&&!party&&!partyName)throw new Error("Selected party was not found. Please select the party again.");
  if(!party&&partyName)party=await CustomerMaster.findOne({$and:[{name:partyName},{$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]},{$or:[{active:true},{active:{$exists:false}},{active:null}]}]});
  const job=await ManufacturingJobOrder.create({jobNo,companyId,date:dt(b.date)||new Date(),type,location,partyId:party?._id||null,partyName:party?.name||partyName,
   sourceItems:sources.map(x=>({...x,itemId:clean(x.itemId)||null,itemName:clean(x.itemName),unit:clean(x.unit)||"KG",qty:num(x.qty),rate:num(x.rate),value:r2(num(x.qty)*num(x.rate)),batchNo:clean(x.batchNo),barcode:clean(x.barcode),purchaseAllocations:Array.isArray(x.purchaseAllocations)?x.purchaseAllocations.map(a=>({...a,qty:num(a.qty),rate:num(a.rate),pendingAfter:num(a.pendingAfter)})):[]})),
   outputItems:outputs.map(x=>{const itemName=clean(x.itemName),packetCount=x.packetCount===undefined?undefined:num(x.packetCount),packetWeightKg=num(x.packetWeightKg)||packetWeightKg(itemName),qty=packetCount>0&&packetWeightKg>0?q6(packetCount*packetWeightKg):num(x.qty);return {...x,itemName,unit:packetWeightKg>0?"KG":clean(x.unit)||"KG",qty,packetCount,packetWeightKg,rate:num(x.rate),value:r2(qty*num(x.rate)),batchNo:clean(x.batchNo),barcode:clean(x.barcode)}}),
   labourCost:labour,transportCost:transport,otherCost:other,totalCost,notes:clean(b.notes),createdBy:req.user._id});
  for(const x of job.sourceItems){
   await adjustStock({companyId:req.user?.companyId,location,itemType:allowedIn,itemName:x.itemName,unit:x.unit,qty:x.qty,value:x.value,mode:"SUBTRACT",batchNo:x.batchNo,barcode:x.barcode});
   const st=await InventoryStock.findOne({companyId:req.user?.companyId||null,location,itemType:allowedIn,itemName:x.itemName,batchNo:x.batchNo||"",barcode:x.barcode||""}).lean();
   await InventoryMovement.create({companyId:req.user?.companyId||null,date:job.date,location,itemName:x.itemName,itemType:allowedIn,unit:x.unit||"KG",qtyOut:x.qty,valueOut:x.value,balanceQty:num(st?.qty),sourceType:"JOB_ORDER",sourceNo:job.jobNo,referenceNo:job.jobNo,batchNo:x.batchNo||"",barcode:x.barcode||"",narration:`Raw Material issued against Job Order ${job.jobNo}`,createdBy:req.user._id});
  }
  return res.status(201).json({success:true,message:`Job Order ${jobNo} created. Raw Material stock issued. Production entry is required to increase output stock.`,job});
 }catch(e){console.error(e);if(e?.code===11000)return res.status(409).json({success:false,message:"This Job Order No. already exists. Enter a different number."});return res.status(400).json({success:false,message:e.message||"Job order failed."})}
}

export async function createJobOrderReturn(req,res){
 try{
  const body=req.body||{},jobId=clean(req.params.id||body.jobId),lines=Array.isArray(body.lines)?body.lines:[];
  if(!jobId||!lines.length)throw new Error("Select a Job Order and at least one raw material to return.");
  const jobFilter={_id:jobId};if(req.user?.companyId)jobFilter.companyId=req.user.companyId;
  const job=await ManufacturingJobOrder.findOne(jobFilter).lean();
  if(!job)return res.status(404).json({success:false,message:"Job Order not found."});
  const existingReturns=await InventoryWorkflow.find({companyId:req.user?.companyId||null,docType:"JOB_ORDER_RETURN","meta.jobId":job._id,status:"POSTED"}).lean();
  const keyOf=x=>`${clean(x.itemName).toLowerCase()}|${clean(x.batchNo)}|${clean(x.barcode)}`;
  const returned={};
  for(const document of existingReturns)for(const line of document.sourceLines||[])returned[keyOf(line)]=(returned[keyOf(line)]||0)+num(line.qty);
  const normalized=[];
  for(const line of lines){
   const key=keyOf(line),issued=job.sourceItems.filter(x=>keyOf(x)===key),qty=num(line.qty);
   const issuedQty=issued.reduce((sum,x)=>sum+num(x.qty),0),issuedValue=issued.reduce((sum,x)=>sum+num(x.qty)*num(x.rate),0);
   if(!issued.length||qty<=0)throw new Error(`Invalid returned raw material: ${clean(line.itemName)}.`);
   const available=Math.max(0,issuedQty-(returned[key]||0));
   if(qty>available+0.000001)throw new Error(`${clean(line.itemName)}: return quantity exceeds unreturned issued quantity ${available}.`);
   returned[key]=(returned[key]||0)+qty;
   const rate=issuedQty?issuedValue/issuedQty:0;
   normalized.push({itemId:issued[0].itemId||null,itemName:clean(issued[0].itemName),itemType:"RAW_MATERIAL",unit:clean(issued[0].unit)||"KG",qty,rate,value:r2(qty*rate),batchNo:clean(issued[0].batchNo),barcode:clean(issued[0].barcode)});
  }
  const totalValue=r2(normalized.reduce((sum,line)=>sum+line.value,0));
  const returnNo=await next("JOB_ORDER_RETURN","JOR");
  const document=await InventoryWorkflow.create({companyId:req.user?.companyId||null,docNo:returnNo,docType:"JOB_ORDER_RETURN",date:dt(body.date)||new Date(),location:job.location,partyId:job.partyId||null,partyName:job.partyName||"",referenceNo:job.jobNo,sourceLines:normalized,totalValue,notes:clean(body.notes),meta:{jobId:job._id,jobNo:job.jobNo},createdBy:req.user._id});
  for(const line of normalized){
   await adjustStock({companyId:job.companyId,location:job.location,itemType:"RAW_MATERIAL",itemName:line.itemName,unit:line.unit,qty:line.qty,value:line.value,mode:"ADD",batchNo:line.batchNo,barcode:line.barcode});
   const stock=await InventoryStock.findOne({companyId:job.companyId||null,location:job.location,itemType:"RAW_MATERIAL",itemName:line.itemName,batchNo:line.batchNo||"",barcode:line.barcode||""}).lean();
   await InventoryMovement.create({companyId:job.companyId||null,date:document.date,location:job.location,itemName:line.itemName,itemType:"RAW_MATERIAL",unit:line.unit,qtyIn:line.qty,valueIn:line.value,balanceQty:num(stock?.qty),sourceType:"JOB_ORDER_RETURN",sourceNo:returnNo,referenceNo:job.jobNo,batchNo:line.batchNo,barcode:line.barcode,narration:`Raw material returned from Job Order ${job.jobNo}`,createdBy:req.user._id});
  }
  return res.status(201).json({success:true,message:`Raw material return ${returnNo} posted against ${job.jobNo}.`,item:document});
 }catch(error){return res.status(400).json({success:false,message:error.message||"Job Order return failed."})}
}

export async function createProductionEntry(req,res){
 try{
  const b=req.body||{},jobId=clean(b.jobId),outputs=Array.isArray(b.outputItems)?b.outputItems:[];
  if(!jobId||!outputs.length)return res.status(400).json({success:false,message:"Job Order and output items are required."});
  const filter={_id:jobId,status:{$in:["POSTED","COMPLETED"]}}; if(req.user?.companyId)filter.companyId=req.user.companyId;
  const job=await ManufacturingJobOrder.findOne(filter); if(!job)return res.status(404).json({success:false,message:"Job Order not found."});
  const prior=await ProductionEntry.find({jobId:job._id,status:"POSTED"}).lean();
  const used={}; for(const e of prior)for(const x of e.outputItems||[])used[x.itemName]=(used[x.itemName]||0)+productionOutput(x).qty;
  let totalValue=0;
  for(const x of outputs){
   const planned=(job.outputItems||[]).find(o=>o.itemName===clean(x.itemName));
   if(!planned)throw new Error(`${x.itemName} is not an output of Job Order ${job.jobNo}.`);
   const qty=num(x.qty),remain=Math.max(0,plannedOutput(planned).qty-(used[x.itemName]||0));
   if(qty<=0||qty>remain+0.000001)throw new Error(`${x.itemName}: production quantity ${qty} exceeds remaining ${remain}.`);
   totalValue+=qty*(num(x.rate)>0?num(x.rate):num(planned.rate));
  }
  const productionNo=await next("PRODUCTION","PROD");
  const productionDate=dt(b.date)||new Date(), productionMfgDate=dt(b.mfgDate)||productionDate, productionExpiryDate=dt(b.expiryDate);
  const entry=await ProductionEntry.create({productionNo,jobId:job._id,jobNo:job.jobNo,companyId:job.companyId,date:productionDate,mfgDate:productionMfgDate,expiryDate:productionExpiryDate,batchNo:clean(b.batchNo),location:job.location,outputItems:outputs.map(x=>{const planned=(job.outputItems||[]).find(o=>o.itemName===clean(x.itemName));const rate=num(x.rate)>0?num(x.rate):num(planned?.rate),packetWeight=num(x.packetWeightKg)||packetWeightKg(x.itemName);return {...x,itemName:clean(x.itemName),unit:packetWeight>0?"KG":clean(x.unit)||planned?.unit||"KG",qty:num(x.qty),packetCount:num(x.packetCount),packetWeightKg:packetWeight,rate,value:r2(num(x.qty)*rate),batchNo:clean(x.batchNo)||clean(b.batchNo)||clean(planned?.batchNo),mfgDate:dt(x.mfgDate)||productionMfgDate,expiryDate:dt(x.expiryDate)||productionExpiryDate,barcode:clean(x.barcode)||clean(planned?.barcode)}}),notes:clean(b.notes),createdBy:req.user._id});
  for(const x of entry.outputItems){
   const value=r2(num(x.qty)*(num(x.rate)>0?num(x.rate):((job.outputItems||[]).find(o=>o.itemName===x.itemName)?.rate||0)));
   await adjustStock({companyId:job.companyId||req.user?.companyId||null,location:job.location,itemType:job.type==="GRADING"?"GRADE":"FINISHED_GOODS",itemName:x.itemName,unit:x.unit,qty:x.qty,value,batchNo:x.batchNo,barcode:x.barcode,mfgDate:x.mfgDate||entry.mfgDate||entry.date,expiryDate:x.expiryDate||entry.expiryDate});
   const st=await InventoryStock.findOne({companyId:job.companyId||req.user?.companyId||null,location:job.location,itemType:job.type==="GRADING"?"GRADE":"FINISHED_GOODS",itemName:x.itemName,batchNo:x.batchNo||"",barcode:x.barcode||""}).lean();
   await InventoryMovement.create({companyId:job.companyId||req.user?.companyId||null,date:entry.date,location:job.location,itemName:x.itemName,itemType:job.type==="GRADING"?"GRADE":"FINISHED_GOODS",unit:x.unit||"KG",qtyIn:x.qty,valueIn:value,balanceQty:num(st?.qty),sourceType:"PRODUCTION",sourceNo:entry.productionNo,referenceNo:job.jobNo,batchNo:x.batchNo||"",barcode:x.barcode||"",narration:`Production ${entry.productionNo} against Job Order ${job.jobNo}`,createdBy:req.user._id});
  }
  const all=await ProductionEntry.find({jobId:job._id,status:"POSTED"}).lean();
  const done={}; for(const e of all)for(const x of e.outputItems||[])done[x.itemName]=(done[x.itemName]||0)+productionOutput(x).qty;
  const complete=(job.outputItems||[]).every(x=>(done[x.itemName]||0)>=plannedOutput(x).qty-0.000001);
  if(complete){job.status="COMPLETED";await job.save();}
  return res.status(201).json({success:true,message:`Production ${productionNo} posted against Job Order ${job.jobNo}. Finished Goods stock increased.`,production:entry,jobStatus:job.status});
 }catch(e){console.error(e);return res.status(400).json({success:false,message:e.message||"Production entry failed."})}
}

export async function getProductionEntries(req,res){try{const filter={};if(req.user?.companyId)filter.companyId=req.user.companyId;if(req.query.jobId)filter.jobId=req.query.jobId;const items=await ProductionEntry.find(filter).sort({date:-1,createdAt:-1}).limit(300).lean();return res.json({success:true,items})}catch(e){return res.status(500).json({success:false,message:e.message})}}

export async function getJobs(req,res){
 try{
  const filter={};if(req.user?.companyId)filter.companyId=req.user.companyId;if(req.query.type)filter.type=req.query.type;
  const items=await ManufacturingJobOrder.find(filter).sort({date:-1,createdAt:-1}).limit(300).lean();
  const ids=items.map(x=>x._id),entryFilter={jobId:{$in:ids},status:"POSTED"};if(req.user?.companyId)entryFilter.companyId=req.user.companyId;
  const entries=ids.length?await ProductionEntry.find(entryFilter).lean():[];
  const byJob={}; for(const e of entries){const k=String(e.jobId);byJob[k]??={};for(const x of e.outputItems||[]){const actual=productionOutput(x),name=clean(x.itemName),current=byJob[k][name]||{itemId:x.itemId||null,qty:0,packetCount:0,packetWeightKg:actual.packetWeightKg};current.qty+=actual.qty;current.packetCount+=actual.packetCount;if(!current.itemId)current.itemId=x.itemId||null;if(!current.packetWeightKg)current.packetWeightKg=actual.packetWeightKg;byJob[k][name]=current;}}
  const conversionFilter={docType:"PACKING_CONVERSION",status:"POSTED","meta.jobId":{$in:ids.map(String)}};if(req.user?.companyId)conversionFilter.companyId=req.user.companyId;
  const conversions=ids.length?await InventoryWorkflow.find(conversionFilter).select("meta").lean():[];
  const convertedByJob={};for(const conversion of conversions){const jobKey=String(conversion.meta?.jobId);convertedByJob[jobKey]??={};for(const line of conversion.meta?.conversionLines||[]){const key=clean(line.itemName).toLowerCase(),current=convertedByJob[jobKey][key]||{qty:0,packetCount:0};current.qty+=num(line.qtyKg);current.packetCount+=num(line.packetCount);convertedByJob[jobKey][key]=current;}}
  const enriched=items.map(j=>{const producedItems=Object.entries(byJob[String(j._id)]||{}).map(([itemName,values])=>{const planned=(j.outputItems||[]).find(x=>clean(x.itemName).toLowerCase()===itemName.toLowerCase()),itemId=values.itemId||planned?.itemId||null,converted=convertedByJob[String(j._id)]?.[itemName.toLowerCase()]||{qty:0,packetCount:0},packetWeightKg=values.packetWeightKg||plannedOutput(planned||{}).packetWeightKg;return {itemId,itemName,qty:values.qty,packetCount:values.packetCount,packetWeightKg,unit:"KG",convertedQty:converted.qty,convertedPacketCount:converted.packetCount,unconvertedQty:Math.max(0,values.qty-converted.qty),unconvertedPacketCount:Math.max(0,values.packetCount-converted.packetCount)}});return {...j,producedItems,remainingOutputItems:(j.outputItems||[]).map(x=>{const plan=plannedOutput(x),produced=byJob[String(j._id)]?.[x.itemName]||{qty:0,packetCount:0};return {...x,unit:plan.packetWeightKg>0?"KG":x.unit,qty:plan.qty,plannedQty:plan.qty,plannedPacketCount:plan.packetCount,packetWeightKg:plan.packetWeightKg,producedQty:produced.qty,producedPacketCount:produced.packetCount,remainingQty:Math.max(0,plan.qty-produced.qty),remainingPacketCount:Math.max(0,plan.packetCount-produced.packetCount)}})}});
  return res.json({success:true,items:enriched});
 }catch(e){return res.status(500).json({success:false,message:e.message})}
}
export async function getJobOrderStockReport(req,res){
 try{
  const filter={status:{$ne:"CANCELLED"}};if(req.user?.companyId)filter.companyId=req.user.companyId;
  const from=clean(req.query.from),to=clean(req.query.to);
  if(from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))return res.status(400).json({success:false,message:"Enter a valid start date."});
  if(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))return res.status(400).json({success:false,message:"Enter a valid end date."});
  const start=from?dt(`${from}T00:00:00.000Z`):null,end=to?dt(`${to}T00:00:00.000Z`):null;
  if((from&&(!start||start.toISOString().slice(0,10)!==from))||(to&&(!end||end.toISOString().slice(0,10)!==to)))return res.status(400).json({success:false,message:"Enter valid report dates."});
  if(start&&end&&end<start)return res.status(400).json({success:false,message:"End date must be on or after start date."});
  if(start&&end&&end-start>370*86400000)return res.status(400).json({success:false,message:"Date range cannot exceed 370 days."});
  if(start||end)filter.date={...(start?{$gte:start}:{}),...(end?{$lt:new Date(end.getTime()+86400000)}:{})};
  const party=clean(req.query.party),jobNo=clean(req.query.jobNo),product=clean(req.query.product);
  if(party)filter.partyName={$regex:party.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),$options:"i"};
  if(jobNo)filter.jobNo={$regex:jobNo.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),$options:"i"};
  if(req.query.status&&["POSTED","COMPLETED","CANCELLED"].includes(clean(req.query.status)))filter.status=clean(req.query.status);
  const jobs=await ManufacturingJobOrder.find(filter).sort({partyName:1,date:-1,jobNo:1}).limit(5000).lean();
  const jobIds=jobs.map(job=>job._id);
  const entries=jobIds.length?await ProductionEntry.find({companyId:req.user?.companyId||null,jobId:{$in:jobIds},status:"POSTED"}).lean():[];
  const produced=new Map();
  for(const entry of entries)for(const line of entry.outputItems||[]){
   const actual=productionOutput(line),unit=actual.packetWeightKg>0?"KG":line.unit||"KG";
   const key=`${String(entry.jobId)}|${clean(line.itemName).toLowerCase()}|${clean(unit).toLowerCase()}`;
   const current=produced.get(key)||{qty:0,packetCount:0};
   current.qty+=actual.qty;
   current.packetCount+=actual.packetCount;
   produced.set(key,current);
  }
  const productMatches=product.toLowerCase();
  const outputMap=new Map();
  for(const job of jobs)for(const output of job.outputItems||[]){
   if(productMatches&&!clean(output.itemName).toLowerCase().includes(productMatches))continue;
   const itemType=job.type==="GRADING"?"GRADE":"FINISHED_GOODS";
   const plan=plannedOutput(output),unit=plan.packetWeightKg>0?"KG":output.unit||"KG",key=`${String(job._id)}|${clean(output.itemName).toLowerCase()}|${clean(unit).toLowerCase()}`;
   const row=outputMap.get(key);
   if(row){row.plannedQty+=plan.qty;row.plannedPacketCount+=plan.packetCount;if(!row.packetWeightKg)row.packetWeightKg=plan.packetWeightKg;}
   else{
    const production=produced.get(key)||{qty:0,packetCount:0};
    outputMap.set(key,{jobId:job._id,jobNo:job.jobNo||"",date:job.date,partyName:job.partyName||"",type:job.type,location:job.location,itemName:output.itemName,unit,plannedQty:plan.qty,plannedPacketCount:plan.packetCount,packetWeightKg:plan.packetWeightKg,producedQty:production.qty,producedPacketCount:production.packetCount,itemType});
   }
  }
  const lines=[...outputMap.values()];
  const stockKeys=[...new Map(lines.map(x=>[`${x.location}|${x.itemType}|${x.itemName}`,{location:x.location,itemType:x.itemType,itemName:x.itemName,packetWeightKg:x.packetWeightKg}])).values()];
  const stockFilter={companyId:req.user?.companyId||null,$or:stockKeys.map(x=>({location:x.location,itemType:x.itemType,itemName:x.itemName}))};
  const stocks=stockKeys.length?await InventoryStock.find(stockFilter).select("location itemType itemName unit qty").lean():[];
  const stockWeightByKey=new Map(stockKeys.map(x=>[`${x.location}|${x.itemType}|${x.itemName}`,num(x.packetWeightKg)]));
  const stockMap=new Map(stockKeys.map(x=>[`${x.location}|${x.itemType}|${x.itemName}`,{qty:0,packetCount:0,unit:num(x.packetWeightKg)>0?"KG":""}]));
  for(const stock of stocks){const key=`${stock.location}|${stock.itemType}|${stock.itemName}`,weight=stockWeightByKey.get(key)||0,current=stockMap.get(key)||{qty:0,packetCount:0,unit:""};if(weight>0){if(packetUnit(stock.unit)){current.packetCount+=num(stock.qty);current.qty+=num(stock.qty)*weight;}else{current.qty+=num(stock.qty);current.packetCount+=num(stock.qty)/weight;}}else current.qty+=num(stock.qty);current.unit=weight>0?"KG":current.unit||stock.unit;stockMap.set(key,current);}
  const rows=lines.map(line=>{const currentStock=stockMap.get(`${line.location}|${line.itemType}|${line.itemName}`)||{qty:0,packetCount:0,unit:""};return {...line,remainingQty:Math.max(0,line.plannedQty-line.producedQty),remainingPacketCount:Math.max(0,line.plannedPacketCount-line.producedPacketCount),currentStockQty:currentStock.qty,currentStockPacketCount:currentStock.packetCount,currentStockUnit:currentStock.unit||line.unit}});
  return res.json({success:true,rows,limited:jobs.length===5000});
 }catch(e){return res.status(500).json({success:false,message:e.message})}
}
export async function getJobOrderReportDetail(req,res){
 try{
  const id=clean(req.params.id);
  if(!/^[a-f\d]{24}$/i.test(id))return res.status(400).json({success:false,message:"Invalid Job Order ID."});
  const filter={_id:id,status:{$ne:"CANCELLED"}};
  if(req.user?.companyId)filter.companyId=req.user.companyId;
  const job=await ManufacturingJobOrder.findOne(filter).lean();
  if(!job)return res.status(404).json({success:false,message:"Job Order not found."});
  const locationId=clean(job.location);
  const location= /^[a-f\d]{24}$/i.test(locationId)
   ? await LocationMaster.findOne({ _id: locationId, $or: [{companyId:req.user?.companyId||null},{companyId:null},{companyId:{$exists:false}}] }).select("name").lean()
   : null;
  const entryFilter={jobId:job._id,status:"POSTED",companyId:req.user?.companyId||null};
  const entries=await ProductionEntry.find(entryFilter).sort({date:1,createdAt:1}).lean();
  const plannedProducts=new Map();
  for(const output of job.outputItems||[]){
   const plan=plannedOutput(output),unit=plan.packetWeightKg>0?"KG":clean(output.unit)||"KG",key=`${clean(output.itemName).toLowerCase()}|${unit.toLowerCase()}`;
   const product=plannedProducts.get(key);
   if(product){product.plannedQty+=plan.qty;product.plannedPacketCount+=plan.packetCount;if(!product.packetWeightKg)product.packetWeightKg=plan.packetWeightKg;}
   else plannedProducts.set(key,{itemName:output.itemName,unit,plannedQty:plan.qty,plannedPacketCount:plan.packetCount,packetWeightKg:plan.packetWeightKg});
  }
  const products=[...plannedProducts.values()].map(output=>{
   const unit=output.unit;
   const productions=[];
   let producedQty=0,producedPacketCount=0;
   for(const entry of entries)for(const line of entry.outputItems||[]){
    const actual=productionOutput(line),productionUnit=actual.packetWeightKg>0?"KG":line.unit||"KG";
    if(clean(line.itemName).toLowerCase()!==clean(output.itemName).toLowerCase()||clean(productionUnit).toLowerCase()!==unit.toLowerCase())continue;
    producedQty+=actual.qty;
    producedPacketCount+=actual.packetCount;
    productions.push({productionNo:entry.productionNo||"",date:entry.date,itemName:line.itemName,unit:actual.packetWeightKg>0?"KG":line.unit||"KG",qty:actual.qty,packetCount:actual.packetCount,packetWeightKg:actual.packetWeightKg,batchNo:line.batchNo||entry.batchNo||"",mfgDate:line.mfgDate||entry.mfgDate||entry.date,expiryDate:line.expiryDate||entry.expiryDate||null});
   }
   return {...output,unit,producedQty,producedPacketCount,remainingQty:Math.max(0,output.plannedQty-producedQty),remainingPacketCount:Math.max(0,output.plannedPacketCount-producedPacketCount),productions};
  });
  return res.json({success:true,job:{...job,locationName:location?.name||job.location},products});
 }catch(e){return res.status(500).json({success:false,message:e.message})}
}
export async function createSale(req,res){
  try{
    const b=req.body||{},location=clean(b.location),customerName=clean(b.customerName),lines=Array.isArray(b.lines)?b.lines:[];
    if(!location||!customerName||!lines.length)return res.status(400).json({success:false,message:"Location, customer and at least one line are required."});
    const companyId=req.user?.companyId||null;
    const customer=await CustomerMaster.findOne({$and:[{$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]},{name:customerName},{$or:[{active:true},{active:{$exists:false}},{active:null}]}]});
    if(!customer)return res.status(400).json({success:false,message:"Customer / Party master not found. Create the customer first."});
    const customerLedger=customer.ledgerId?await Ledger.findById(customer.ledgerId):await ensureLedger({name:customer.name,groupName:"Sundry Debtors",nature:"Asset",req,gstin:customer.gstin,address:customer.address,phone:customer.phone});
    if(!customer.ledgerId){customer.ledgerId=customerLedger._id;await customer.save();}
    const salesLedger=await ensureLedger({name:"Sales",groupName:"Sales",nature:"Income",req});
    const outputCgst=await ensureGstLedger("Output CGST",req),outputSgst=await ensureGstLedger("Output SGST",req),outputIgst=await ensureGstLedger("Output IGST",req);
    const built=[];let subtotal=0,cg=0,sg=0,ig=0;
    for(const x of lines){const qty=num(x.qty),rate=num(x.rate),discount=Math.min(Math.max(num(x.discount),0),qty*rate),taxable=r2(qty*rate-discount),gstRate=Math.max(0,num(x.gstRate)),gstType=["NONE","CGST_SGST","IGST"].includes(x.gstType)?x.gstType:"NONE",gst=gstType==="NONE"?0:r2(taxable*gstRate/100),c=gstType==="CGST_SGST"?r2(gst/2):0,s=gstType==="CGST_SGST"?r2(gst-c):0,i=gstType==="IGST"?gst:0;const requestedItemType=["FINISHED_GOODS","PACKED_GOODS"].includes(String(x.itemType||""))?String(x.itemType):"FINISHED_GOODS";let st=await InventoryStock.findOne({companyId,location,itemType:requestedItemType,itemName:clean(x.itemName),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});if(!st && requestedItemType==="PACKED_GOODS") st=await InventoryStock.findOne({companyId,location,itemType:"FINISHED_GOODS",itemName:clean(x.itemName),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});if(!st||num(st.qty)<qty)throw new Error(`Insufficient ${requestedItemType===`PACKED_GOODS`?"packing":"finished goods"} stock for ${x.itemName}.`);built.push({...x,itemName:clean(x.itemName),itemType:st.itemType,stockId:st._id,unit:clean(x.unit)||st.unit,qty,rate,discount,taxableAmount:taxable,hsn:clean(x.hsn)||st.hsn,gstRate,gstType,cgst:c,sgst:s,igst:i,lineTotal:r2(taxable+c+s+i),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});subtotal+=taxable;cg+=c;sg+=s;ig+=i;}
    const invoiceNo=await next("SALE","SAL");
    const inv=await SalesInvoice.create({invoiceNo,companyId,date:dt(b.date)||new Date(),location,customerId:customer._id,customerLedgerId:customerLedger._id,customerName,customerGSTIN:clean(b.customerGSTIN||customer.gstin).toUpperCase(),customerState:clean(b.customerState||customer.state),supplierState:clean(b.supplierState),supplyType:clean(b.customerGSTIN||customer.gstin)?"B2B":"B2C",placeOfSupply:clean(b.placeOfSupply),lines:built,subtotal:r2(subtotal),totalCGST:r2(cg),totalSGST:r2(sg),totalIGST:r2(ig),grandTotal:r2(subtotal+cg+sg+ig),remarks:clean(b.remarks),createdBy:req.user._id});
    for(const x of built){const old=await InventoryStock.findById(x.stockId).lean();const cost=r2(num(old?.averageRate)*x.qty);await adjustStock({companyId,location,itemType:x.itemType||"FINISHED_GOODS",itemName:x.itemName,unit:x.unit,qty:x.qty,value:cost,mode:"SUBTRACT",batchNo:x.batchNo,barcode:x.barcode});await GstLedger.create({companyId,sourceType:"SALE",sourceId:inv._id,documentNo:invoiceNo,date:inv.date,partyName:customerName,partyGSTIN:inv.customerGSTIN,location,hsn:x.hsn,taxableAmount:x.taxableAmount,cgst:x.cgst,sgst:x.sgst,igst:x.igst,gstRate:x.gstRate,supplyType:inv.supplyType});}
    const voucherLines=[{ledger:customerLedger._id,debit:subtotal+cg+sg+ig,credit:0,narration:`Sales ${invoiceNo}`},{ledger:salesLedger._id,debit:0,credit:subtotal,narration:`Sales ${invoiceNo}`}];
    if(cg)voucherLines.push({ledger:outputCgst._id,debit:0,credit:cg,narration:`Output CGST ${invoiceNo}`});
    if(sg)voucherLines.push({ledger:outputSgst._id,debit:0,credit:sg,narration:`Output SGST ${invoiceNo}`});
    if(ig)voucherLines.push({ledger:outputIgst._id,debit:0,credit:ig,narration:`Output IGST ${invoiceNo}`});
    const voucher=await createAutoVoucher({req,date:inv.date,type:"Sales",partyLedger:customerLedger._id,referenceNo:invoiceNo,narration:`Automatic sales accounting for ${invoiceNo}`,lines:voucherLines,sourceType:"SALES_INVOICE",sourceId:inv._id});
    return res.status(201).json({success:true,message:`Sale ${invoiceNo} posted, stock reduced and accounting voucher ${voucher.voucherNo} created.`,invoice:inv,voucher});
  }catch(e){return res.status(400).json({success:false,message:e.message||"Sale failed."})}
}
export async function getSales(req,res){try{const filter={status:"POSTED"};if(req.user?.companyId)filter.companyId=req.user.companyId;return listModel(req,res,SalesInvoice,filter,[{invoiceNo:1},{customerName:1},{"lines.itemName":1}])}catch(e){return res.status(500).json({success:false,message:e.message})}}
export async function getGstReport(req,res){try{const filter={};if(req.user?.companyId)filter.companyId=req.user.companyId;const from=dt(req.query.from),to=dt(req.query.to);if(to&&/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to||"")))to.setUTCHours(23,59,59,999);if(from||to)filter.date={...(from?{$gte:from}:{}),...(to?{$lte:to}: {})};const rows=await GstLedger.find(filter).sort({date:-1}).limit(5000).lean();const out={input:{taxable:0,cgst:0,sgst:0,igst:0},output:{taxable:0,cgst:0,sgst:0,igst:0}};rows.forEach(x=>{const k=x.sourceType==="PURCHASE"?"input":"output";out[k].taxable+=num(x.taxableAmount);out[k].cgst+=num(x.cgst);out[k].sgst+=num(x.sgst);out[k].igst+=num(x.igst)});return res.json({success:true,summary:out,rows})}catch(e){return res.status(500).json({success:false,message:e.message})}}




export async function createCustomerMaster(req,res){
 try{
  const b=req.body||{};
  const companyId=req.user?.companyId||null;
  const name=clean(b.name);
  if(!name)return res.status(400).json({success:false,message:"Customer / Party name is required."});
  const existing=await CustomerMaster.findOne({companyId,name,active:true});
  if(existing)return res.status(409).json({success:false,message:"Customer / Party already exists."});
  const row=await CustomerMaster.create({companyId,name,gstin:clean(b.gstin).toUpperCase(),gstStatus:clean(b.gstStatus),state:clean(b.state),district:clean(b.district),pin:clean(b.pin),phone:clean(b.phone),address:clean(b.address),createdBy:req.user._id});
  const ledger=await ensureLedger({name,groupName:"Sundry Debtors",nature:"Asset",req,gstin:row.gstin,address:row.address,phone:row.phone});
  row.ledgerId=ledger._id;
  await row.save();
  return res.status(201).json({success:true,message:"Customer / Party created and ledger mapped successfully.",item:row,ledger});
 }catch(e){return res.status(400).json({success:false,message:e.code===11000?"Customer / Party already exists.":e.message})}
}

export async function updateCustomerMaster(req,res){
 try{
  const b=req.body||{};
  const row=await CustomerMaster.findOneAndUpdate({_id:req.params.id,companyId:req.user?.companyId||null},{$set:{name:clean(b.name),gstin:clean(b.gstin).toUpperCase(),state:clean(b.state),district:clean(b.district),pin:clean(b.pin),phone:clean(b.phone),address:clean(b.address),gstStatus:clean(b.gstStatus)}},{new:true,runValidators:true});
  if(!row)return res.status(404).json({success:false,message:"Customer not found."});
  if(row.ledgerId)await Ledger.findByIdAndUpdate(row.ledgerId,{$set:{name:row.name,gstin:row.gstin,address:row.address,phone:row.phone}});
  return res.json({success:true,message:"Customer updated and ledger mapping preserved.",item:row});
 }catch(e){return res.status(400).json({success:false,message:e.code===11000?"Customer already exists.":e.message})}
}
export async function deleteCustomerMaster(req,res){
 try{
  const row=await CustomerMaster.findOneAndUpdate({_id:req.params.id,companyId:req.user?.companyId||null},{$set:{active:false}},{new:true});
  if(!row)return res.status(404).json({success:false,message:"Customer not found."});
  return res.json({success:true,message:"Customer deleted."});
 }catch(e){return res.status(400).json({success:false,message:e.message})}
}
export async function updateLocationMaster(req,res){
  try{
    const b=req.body||{};
    const row=await LocationMaster.findOneAndUpdate(
      {_id:req.params.id,companyId:req.user?.companyId||null},
      {$set:{name:clean(b.name),code:clean(b.code).toUpperCase(),pin:clean(b.pin),state:clean(b.state),district:clean(b.district),address:clean(b.address)}},
      {new:true,runValidators:true}
    );
    if(!row)return res.status(404).json({success:false,message:"Location not found."});
    return res.json({success:true,message:"Location / Godown updated.",item:row});
  }catch(e){return res.status(400).json({success:false,message:e.code===11000?"Location / Godown already exists.":e.message})}
}
export async function deleteLocationMaster(req,res){
  try{
    const row=await LocationMaster.findOneAndUpdate({_id:req.params.id,companyId:req.user?.companyId||null},{$set:{active:false}},{new:true});
    if(!row)return res.status(404).json({success:false,message:"Location not found."});
    return res.json({success:true,message:"Location deleted."});
  }catch(e){return res.status(400).json({success:false,message:e.message})}
}
export async function updateSupplierMaster(req,res){
  try{
    const b=req.body||{};
    const row=await SupplierMaster.findOneAndUpdate(
      {_id:req.params.id,companyId:req.user?.companyId||null},
      {$set:{name:clean(b.name),gstin:clean(b.gstin).toUpperCase(),state:clean(b.state),district:clean(b.district),pin:clean(b.pin),phone:clean(b.phone),address:clean(b.address),gstStatus:clean(b.gstStatus)}},
      {new:true,runValidators:true}
    );
    if(!row)return res.status(404).json({success:false,message:"Supplier not found."});
    return res.json({success:true,message:"Supplier updated.",item:row});
  }catch(e){return res.status(400).json({success:false,message:e.code===11000?"Supplier already exists.":e.message})}
}
export async function deleteSupplierMaster(req,res){
  try{
    const row=await SupplierMaster.findOneAndUpdate({_id:req.params.id,companyId:req.user?.companyId||null},{$set:{active:false}},{new:true});
    if(!row)return res.status(404).json({success:false,message:"Supplier not found."});
    return res.json({success:true,message:"Supplier deleted."});
  }catch(e){return res.status(400).json({success:false,message:e.message})}
}
export async function updateInventoryItemMaster(req,res){
  try{
    const b=req.body||{};
    const itemType=["RAW_MATERIAL","GRADE","FINISHED_GOODS","PACKED_GOODS","RETURN_GOODS","REJECTED"].includes(b.itemType)?b.itemType:"RAW_MATERIAL";
    const row=await InventoryItemMaster.findOneAndUpdate(
      {_id:req.params.id,companyId:req.user?.companyId||null},
      {$set:{name:clean(b.name),itemType,hsn:clean(b.hsn),unit:clean(b.unit)||"KG",defaultGstRate:Math.max(0,Math.min(num(b.defaultGstRate),100)),defaultBarcode:clean(b.defaultBarcode)}},
      {new:true,runValidators:true}
    );
    if(!row)return res.status(404).json({success:false,message:"Product / Item not found."});
    return res.json({success:true,message:"Product / Item updated.",item:row});
  }catch(e){return res.status(400).json({success:false,message:e.code===11000?"Item already exists.":e.message})}
}
export async function deleteInventoryItemMaster(req,res){
  try{
    const row=await InventoryItemMaster.findOneAndUpdate({_id:req.params.id,companyId:req.user?.companyId||null},{$set:{active:false}},{new:true});
    if(!row)return res.status(404).json({success:false,message:"Product / Item not found."});
    return res.json({success:true,message:"Product / Item deleted."});
  }catch(e){return res.status(400).json({success:false,message:e.message})}
}
