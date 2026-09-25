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
import Group from "../models/Group.js";
import Ledger from "../models/Ledger.js";
import Voucher from "../models/Voucher.js";
function clean(v){return String(v??"").trim()} function num(v){const n=Number(v);return Number.isFinite(n)?n:0} function r2(v){return Math.round((num(v)+Number.EPSILON)*100)/100} function dt(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
const GSTIN_RE=/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GST_STATE={
"01":"Jammu and Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh","05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh","10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur","15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal","20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh","24":"Gujarat","26":"Dadra and Nagar Haveli and Daman and Diu","27":"Maharashtra","28":"Andhra Pradesh","29":"Karnataka","30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu","34":"Puducherry","35":"Andaman and Nicobar Islands","36":"Telangana","37":"Andhra Pradesh","38":"Ladakh"
};
async function next(key,prefix){const y=new Date().getFullYear();const c=await InventoryCounter.findOneAndUpdate({key:`${key}_${y}`},{$inc:{seq:1}},{upsert:true,new:true,setDefaultsOnInsert:true});return `${prefix}-${y}-${String(c.seq).padStart(5,"0")}`}
async function adjustStock({companyId,location,itemType,itemName,unit,qty,value,mode="ADD",hsn="",batchNo="",barcode="",mfgDate=null,expiryDate=null}){
 const filter={companyId:companyId||null,location,itemType,itemName,batchNo:batchNo||"",barcode:barcode||""};
 const old=await InventoryStock.findOne(filter).select("qty stockValue").lean(); const oq=num(old?.qty), ov=num(old?.stockValue); const q=mode==="ADD"?qty:-qty; const v=mode==="ADD"?value:-value;
 if(mode!=="ADD" && oq+q < -0.000001) throw new Error(`Insufficient ${itemType} stock for ${itemName}. Available ${oq}, required ${qty}.`);
 const nq=r2(oq+q), nv=r2(Math.max(0,ov+v));
 await InventoryStock.findOneAndUpdate(filter,{$set:{hsn,unit,mfgDate,expiryDate,averageRate:nq?r2(nv/nq):0,lastPurchaseRate:mode==="ADD"?r2(value/(qty||1)):undefined,lastPurchaseDate:mode==="ADD"?new Date():undefined},$inc:{qty:q,stockValue:v},$setOnInsert:{companyId:companyId||null,location,itemType,itemName,batchNo:batchNo||"",barcode:barcode||""}},{upsert:true,new:true});
}
function buildLine(x){const qty=num(x.qty),rate=num(x.purchaseRate),gross=qty*rate,discount=Math.min(Math.max(num(x.discount),0),gross),taxable=r2(gross-discount),gstRate=Math.max(0,Math.min(num(x.gstRate),100)),gstType=["NONE","CGST_SGST","IGST"].includes(x.gstType)?x.gstType:"NONE",gst=gstType==="NONE"?0:r2(taxable*gstRate/100),cgst=gstType==="CGST_SGST"?r2(gst/2):0,sgst=gstType==="CGST_SGST"?r2(gst-cgst):0,igst=gstType==="IGST"?gst:0;return {itemName:clean(x.itemName),hsn:clean(x.hsn),unit:clean(x.unit)||"KG",batchNo:clean(x.batchNo),barcode:clean(x.barcode),mfgDate:dt(x.mfgDate),expiryDate:dt(x.expiryDate),qty,purchaseRate:rate,discount:r2(discount),taxableAmount:taxable,gstRate,gstType,cgst,sgst,igst,lineTotal:r2(taxable+cgst+sgst+igst),landedCost:0}}
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
 const existing=await Ledger.findOne({name:clean(name),isActive:true});
 if(existing)return existing;
 let group=await Group.findOne({name:groupName,parent:null});
 if(!group)group=await Group.create({name:groupName,parent:null,nature,isSystem:true});
 return Ledger.create({name:clean(name),group:group._id,gstin:clean(gstin).toUpperCase(),address:clean(address),phone:clean(phone),createdBy:req.user._id});
}
async function ensureGstLedger(name,req){return ensureLedger({name,groupName:"Duties & Taxes",nature:"Liability",req});}
async function createAutoVoucher({req,date,type,partyLedger,referenceNo,narration,lines,sourceType,sourceId}){
 const normalized=lines.map(x=>({ledger:x.ledger,debit:r2(x.debit),credit:r2(x.credit),narration:x.narration||narration||""}));
 const totalDebit=r2(normalized.reduce((s,x)=>s+x.debit,0)),totalCredit=r2(normalized.reduce((s,x)=>s+x.credit,0));
 if(totalDebit<=0||Math.abs(totalDebit-totalCredit)>0.005)throw new Error("Automatic accounting voucher is not balanced.");
 const prefix=type.slice(0,3).toUpperCase(),count=await Voucher.countDocuments({type}),voucherNo=`${prefix}-${new Date(date).getFullYear()}-${String(count+1).padStart(5,"0")}`;
 return Voucher.create({voucherNo,date,type,partyLedger,referenceNo,narration,lines:normalized,totalDebit,totalCredit,sourceType,sourceId,createdBy:req.user._id});
}

export async function getPurchaseMasters(req,res){
 try{
  const companyId=req.user?.companyId||null;
  const [locations,suppliers,items,customers]=await Promise.all([
   LocationMaster.find({companyId,active:true}).sort({name:1}).lean(),
   SupplierMaster.find({companyId,active:true}).populate("ledgerId","name").sort({name:1}).lean(),
   InventoryItemMaster.find({companyId,active:true,itemType:"RAW_MATERIAL"}).populate("purchaseLedgerId salesLedgerId","name").sort({name:1}).lean(),
   CustomerMaster.find({companyId,active:true}).populate("ledgerId","name").sort({name:1}).lean()
  ]);
  return res.json({success:true,locations,suppliers,items,customers});
 }catch(e){return res.status(500).json({success:false,message:e.message||"Master data load failed."})}
}
export async function createLocationMaster(req,res){try{const b=req.body||{},name=clean(b.name);if(!name)return res.status(400).json({success:false,message:"Location / Godown name is required."});const code=clean(b.code).toUpperCase()||await next("LOCATION","LOC");const row=await LocationMaster.create({companyId:req.user?.companyId||null,name,code,pin:clean(b.pin),state:clean(b.state),district:clean(b.district),address:clean(b.address),createdBy:req.user._id});return res.status(201).json({success:true,message:"Location / Godown master created.",item:row});}catch(e){return res.status(400).json({success:false,message:e.code===11000?"Location / Godown already exists.":e.message})}}
export async function createSupplierMaster(req,res){try{const b=req.body||{},name=clean(b.name);if(!name)return res.status(400).json({success:false,message:"Supplier name is required."});const row=await SupplierMaster.create({companyId:req.user?.companyId||null,name,gstin:clean(b.gstin).toUpperCase(),state:clean(b.state),district:clean(b.district),pin:clean(b.pin),phone:clean(b.phone),address:clean(b.address),gstStatus:clean(b.gstStatus),createdBy:req.user._id});return res.status(201).json({success:true,message:"Supplier master created.",item:row});}catch(e){return res.status(400).json({success:false,message:e.code===11000?"Supplier already exists.":e.message})}}
export async function createInventoryItemMaster(req,res){try{const b=req.body||{},name=clean(b.name);if(!name)return res.status(400).json({success:false,message:"Item name is required."});const itemType=["RAW_MATERIAL","GRADE","FINISHED_GOODS"].includes(b.itemType)?b.itemType:"RAW_MATERIAL";const row=await InventoryItemMaster.create({companyId:req.user?.companyId||null,name,itemType,hsn:clean(b.hsn),unit:clean(b.unit)||"KG",defaultGstRate:Math.max(0,Math.min(num(b.defaultGstRate),100)),defaultBarcode:clean(b.defaultBarcode),createdBy:req.user._id});return res.status(201).json({success:true,message:"Item master created.",item:row});}catch(e){return res.status(400).json({success:false,message:e.code===11000?"Item already exists.":e.message})}}
export async function createRawMaterialPurchase(req,res){
  try{
    const b=req.body||{},location=clean(b.location),supplierName=clean(b.supplierName),raw=Array.isArray(b.lines)?b.lines:[];
    if(!location||!supplierName||!raw.length)return res.status(400).json({success:false,message:"Location, Supplier and at least one line are required."});
    const companyId=req.user?.companyId||null;
    const supplier=await SupplierMaster.findOne({companyId,name:supplierName,active:true});
    if(!supplier)return res.status(400).json({success:false,message:"Supplier master not found. Create the supplier first."});
    const supplierLedger=supplier.ledgerId?await Ledger.findById(supplier.ledgerId):await ensureLedger({name:supplier.name,groupName:"Sundry Creditors",nature:"Liability",req,gstin:supplier.gstin,address:supplier.address,phone:supplier.phone});
    if(!supplier.ledgerId){supplier.ledgerId=supplierLedger._id;await supplier.save();}
    const purchaseLedger=await ensureLedger({name:"Purchase",groupName:"Purchase",nature:"Expense",req});
    const inputCgst=await ensureGstLedger("Input CGST",req),inputSgst=await ensureGstLedger("Input SGST",req),inputIgst=await ensureGstLedger("Input IGST",req);
    const lines=raw.map(buildLine);
    if(lines.some(x=>!x.itemName||x.qty<=0||x.purchaseRate<0))return res.status(400).json({success:false,message:"Each raw material needs item, quantity and rate."});
    const subtotal=r2(lines.reduce((s,x)=>s+x.taxableAmount,0)),cg=r2(lines.reduce((s,x)=>s+x.cgst,0)),sg=r2(lines.reduce((s,x)=>s+x.sgst,0)),ig=r2(lines.reduce((s,x)=>s+x.igst,0)),transport=Math.max(0,num(b.transportCost)),other=Math.max(0,num(b.otherCost)),extra=transport+other,totalQty=lines.reduce((s,x)=>s+x.qty,0)||1;
    lines.forEach(x=>x.landedCost=r2(x.taxableAmount+extra*x.qty/totalQty));
    const purchaseNo=await next("RAW_PURCHASE","RMP");
    const purchase=await RawMaterialPurchase.create({purchaseNo,date:dt(b.date)||new Date(),companyId,location,supplierId:supplier._id,supplierLedgerId:supplierLedger._id,supplierName,supplierGSTIN:clean(b.supplierGSTIN||supplier.gstin).toUpperCase(),supplierInvoiceNo:clean(b.supplierInvoiceNo),supplierInvoiceDate:dt(b.supplierInvoiceDate),transportCost:transport,otherCost:other,subtotal,totalCGST:cg,totalSGST:sg,totalIGST:ig,grandTotal:r2(subtotal+cg+sg+ig+transport+other),remarks:clean(b.remarks),lines,createdBy:req.user._id});
    for(const x of lines){await adjustStock({companyId,location,itemType:"RAW_MATERIAL",itemName:x.itemName,unit:x.unit,qty:x.qty,value:x.landedCost,hsn:x.hsn,batchNo:x.batchNo,barcode:x.barcode,mfgDate:x.mfgDate,expiryDate:x.expiryDate});await GstLedger.create({companyId,sourceType:"PURCHASE",sourceId:purchase._id,documentNo:purchaseNo,date:purchase.date,partyName:supplierName,partyGSTIN:purchase.supplierGSTIN,location,hsn:x.hsn,taxableAmount:x.taxableAmount,cgst:x.cgst,sgst:x.sgst,igst:x.igst,gstRate:x.gstRate,supplyType:x.gstType});}
    const voucherLines=[{ledger:purchaseLedger._id,debit:subtotal+transport+other,credit:0,narration:`Purchase ${purchaseNo}`},{ledger:supplierLedger._id,debit:0,credit:subtotal+cg+sg+ig+transport+other,narration:`Payable to ${supplier.name}`}];
    if(cg)voucherLines.push({ledger:inputCgst._id,debit:cg,credit:0,narration:`Input CGST ${purchaseNo}`});
    if(sg)voucherLines.push({ledger:inputSgst._id,debit:sg,credit:0,narration:`Input SGST ${purchaseNo}`});
    if(ig)voucherLines.push({ledger:inputIgst._id,debit:ig,credit:0,narration:`Input IGST ${purchaseNo}`});
    const voucher=await createAutoVoucher({req,date:purchase.date,type:"Purchase",partyLedger:supplierLedger._id,referenceNo:purchaseNo,narration:`Automatic purchase accounting for ${purchaseNo}`,lines:voucherLines,sourceType:"RAW_MATERIAL_PURCHASE",sourceId:purchase._id});
    return res.status(201).json({success:true,message:`Purchase ${purchaseNo} posted, stock updated and accounting voucher ${voucher.voucherNo} created.`,purchase,voucher});
  }catch(e){console.error(e);return res.status(500).json({success:false,message:e.message||"Purchase failed."})}
}
export async function getRawMaterialPurchases(req,res){try{return await listModel(req,res,RawMaterialPurchase,{status:"POSTED"},[{purchaseNo:1},{supplierName:1},{"lines.itemName":1}])}catch(e){return res.status(500).json({success:false,message:e.message})}}
async function listModel(req,res,Model,base,searchFields){const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(5,Number(req.query.limit)||20)),filter={...base};if(req.user?.companyId&&Model.schema.path("companyId"))filter.companyId=req.user.companyId;const q=clean(req.query.search);if(q)filter.$or=searchFields.map(f=>Object.fromEntries([[Object.keys(f)[0],{$regex:q,$options:"i"}]]));const [items,total]=await Promise.all([Model.find(filter).sort({date:-1,createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),Model.countDocuments(filter)]);return res.json({success:true,items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}})}
export async function getRawMaterialStock(req,res){return stockList(req,res,"RAW_MATERIAL")}
export async function getStock(req,res){return stockList(req,res,clean(req.query.itemType)||"RAW_MATERIAL")}
async function stockList(req,res,itemType){try{const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(5,Number(req.query.limit)||25)),filter={itemType,qty:{$gt:0}};if(req.user?.companyId)filter.companyId=req.user.companyId;if(clean(req.query.location))filter.location=clean(req.query.location);if(clean(req.query.search))filter.itemName={$regex:clean(req.query.search),$options:"i"};const [items,total]=await Promise.all([InventoryStock.find(filter).sort({itemName:1}).skip((page-1)*limit).limit(limit).lean(),InventoryStock.countDocuments(filter)]);return res.json({success:true,items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}})}catch(e){return res.status(500).json({success:false,message:e.message})}}
export async function createJobOrder(req,res){try{const b=req.body||{},type=b.type,location=clean(b.location),sources=Array.isArray(b.sourceItems)?b.sourceItems:[],outputs=Array.isArray(b.outputItems)?b.outputItems:[];if(!["GRADING","FINISHED_GOODS"].includes(type)||!location||!sources.length||!outputs.length)return res.status(400).json({success:false,message:"Type, location, source items and output items are required."});const allowedIn=type==="GRADING"?"RAW_MATERIAL":"GRADE", allowedOut=type==="GRADING"?"GRADE":"FINISHED_GOODS";let sourceValue=0,outputValue=0;for(const x of sources){const q=num(x.qty),rate=num(x.rate);if(q<=0)throw new Error(`Invalid source quantity for ${x.itemName}.`);const st=await InventoryStock.findOne({companyId:req.user?.companyId||null,location,itemType:allowedIn,itemName:clean(x.itemName),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});if(!st||num(st.qty)<q)throw new Error(`Insufficient ${allowedIn} stock for ${x.itemName}.`);sourceValue+=q*(rate>0?rate:num(st.averageRate));}for(const x of outputs){if(num(x.qty)<=0||!clean(x.itemName))throw new Error("Every output needs item and quantity.");outputValue+=num(x.qty)*num(x.rate)}const labour=Math.max(0,num(b.labourCost)),transport=Math.max(0,num(b.transportCost)),other=Math.max(0,num(b.otherCost)),totalCost=r2(sourceValue+labour+transport+other),jobNo=await next(type==="GRADING"?"GRADING_JOB":"FG_JOB",type==="GRADING"?"GRD":"FGJ");const job=await ManufacturingJobOrder.create({jobNo,companyId:req.user?.companyId||null,date:dt(b.date)||new Date(),type,location,sourceItems:sources.map(x=>({...x,itemName:clean(x.itemName),unit:clean(x.unit)||"KG",qty:num(x.qty),rate:num(x.rate),value:r2(num(x.qty)*num(x.rate)),batchNo:clean(x.batchNo),barcode:clean(x.barcode)})),outputItems:outputs.map(x=>({...x,itemName:clean(x.itemName),unit:clean(x.unit)||"PCS",qty:num(x.qty),rate:num(x.rate),value:r2(num(x.qty)*num(x.rate)),batchNo:clean(x.batchNo),barcode:clean(x.barcode)})),labourCost:labour,transportCost:transport,otherCost:other,totalCost,notes:clean(b.notes),createdBy:req.user._id});for(const x of job.sourceItems)await adjustStock({companyId:req.user?.companyId,location,itemType:allowedIn,itemName:x.itemName,unit:x.unit,qty:x.qty,value:x.value,mode:"SUBTRACT",batchNo:x.batchNo,barcode:x.barcode});const totalOutputQty=outputs.reduce((s,x)=>s+num(x.qty),0)||1;for(const x of job.outputItems){const alloc=r2(totalCost*x.qty/totalOutputQty);await adjustStock({companyId:req.user?.companyId,location,itemType:allowedOut,itemName:x.itemName,unit:x.unit,qty:x.qty,value:alloc,mode:"ADD",hsn:x.hsn||"",batchNo:x.batchNo,barcode:x.barcode,mfgDate:dt(x.mfgDate)||job.date,expiryDate:dt(x.expiryDate)});}return res.status(201).json({success:true,message:`${type} Job Order ${jobNo} posted.`,job});}catch(e){console.error(e);return res.status(400).json({success:false,message:e.message||"Job order failed."})}}
export async function getJobs(req,res){try{const filter={status:"POSTED"};if(req.user?.companyId)filter.companyId=req.user.companyId; if(req.query.type)filter.type=req.query.type;const items=await ManufacturingJobOrder.find(filter).sort({date:-1,createdAt:-1}).limit(100).lean();return res.json({success:true,items})}catch(e){return res.status(500).json({success:false,message:e.message})}}
export async function createSale(req,res){
  try{
    const b=req.body||{},location=clean(b.location),customerName=clean(b.customerName),lines=Array.isArray(b.lines)?b.lines:[];
    if(!location||!customerName||!lines.length)return res.status(400).json({success:false,message:"Location, customer and at least one line are required."});
    const companyId=req.user?.companyId||null;
    const customer=await CustomerMaster.findOne({companyId,name:customerName,active:true});
    if(!customer)return res.status(400).json({success:false,message:"Customer / Party master not found. Create the customer first."});
    const customerLedger=customer.ledgerId?await Ledger.findById(customer.ledgerId):await ensureLedger({name:customer.name,groupName:"Sundry Debtors",nature:"Asset",req,gstin:customer.gstin,address:customer.address,phone:customer.phone});
    if(!customer.ledgerId){customer.ledgerId=customerLedger._id;await customer.save();}
    const salesLedger=await ensureLedger({name:"Sales",groupName:"Sales",nature:"Income",req});
    const outputCgst=await ensureGstLedger("Output CGST",req),outputSgst=await ensureGstLedger("Output SGST",req),outputIgst=await ensureGstLedger("Output IGST",req);
    const built=[];let subtotal=0,cg=0,sg=0,ig=0;
    for(const x of lines){const qty=num(x.qty),rate=num(x.rate),discount=Math.min(Math.max(num(x.discount),0),qty*rate),taxable=r2(qty*rate-discount),gstRate=Math.max(0,num(x.gstRate)),gstType=["NONE","CGST_SGST","IGST"].includes(x.gstType)?x.gstType:"NONE",gst=gstType==="NONE"?0:r2(taxable*gstRate/100),c=gstType==="CGST_SGST"?r2(gst/2):0,s=gstType==="CGST_SGST"?r2(gst-c):0,i=gstType==="IGST"?gst:0;const st=await InventoryStock.findOne({companyId,location,itemType:"FINISHED_GOODS",itemName:clean(x.itemName),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});if(!st||num(st.qty)<qty)throw new Error(`Insufficient finished goods stock for ${x.itemName}.`);built.push({...x,itemName:clean(x.itemName),stockId:st._id,unit:clean(x.unit)||st.unit,qty,rate,discount,taxableAmount:taxable,hsn:clean(x.hsn)||st.hsn,gstRate,gstType,cgst:c,sgst:s,igst:i,lineTotal:r2(taxable+c+s+i),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});subtotal+=taxable;cg+=c;sg+=s;ig+=i;}
    const invoiceNo=await next("SALE","SAL");
    const inv=await SalesInvoice.create({invoiceNo,companyId,date:dt(b.date)||new Date(),location,customerId:customer._id,customerLedgerId:customerLedger._id,customerName,customerGSTIN:clean(b.customerGSTIN||customer.gstin).toUpperCase(),customerState:clean(b.customerState||customer.state),supplierState:clean(b.supplierState),supplyType:clean(b.customerGSTIN||customer.gstin)?"B2B":"B2C",placeOfSupply:clean(b.placeOfSupply),lines:built,subtotal:r2(subtotal),totalCGST:r2(cg),totalSGST:r2(sg),totalIGST:r2(ig),grandTotal:r2(subtotal+cg+sg+ig),remarks:clean(b.remarks),createdBy:req.user._id});
    for(const x of built){const old=await InventoryStock.findById(x.stockId).lean();const cost=r2(num(old?.averageRate)*x.qty);await adjustStock({companyId,location,itemType:"FINISHED_GOODS",itemName:x.itemName,unit:x.unit,qty:x.qty,value:cost,mode:"SUBTRACT",batchNo:x.batchNo,barcode:x.barcode});await GstLedger.create({companyId,sourceType:"SALE",sourceId:inv._id,documentNo:invoiceNo,date:inv.date,partyName:customerName,partyGSTIN:inv.customerGSTIN,location,hsn:x.hsn,taxableAmount:x.taxableAmount,cgst:x.cgst,sgst:x.sgst,igst:x.igst,gstRate:x.gstRate,supplyType:inv.supplyType});}
    const voucherLines=[{ledger:customerLedger._id,debit:subtotal+cg+sg+ig,credit:0,narration:`Sales ${invoiceNo}`},{ledger:salesLedger._id,debit:0,credit:subtotal,narration:`Sales ${invoiceNo}`}];
    if(cg)voucherLines.push({ledger:outputCgst._id,debit:0,credit:cg,narration:`Output CGST ${invoiceNo}`});
    if(sg)voucherLines.push({ledger:outputSgst._id,debit:0,credit:sg,narration:`Output SGST ${invoiceNo}`});
    if(ig)voucherLines.push({ledger:outputIgst._id,debit:0,credit:ig,narration:`Output IGST ${invoiceNo}`});
    const voucher=await createAutoVoucher({req,date:inv.date,type:"Sales",partyLedger:customerLedger._id,referenceNo:invoiceNo,narration:`Automatic sales accounting for ${invoiceNo}`,lines:voucherLines,sourceType:"SALES_INVOICE",sourceId:inv._id});
    return res.status(201).json({success:true,message:`Sale ${invoiceNo} posted, stock reduced and accounting voucher ${voucher.voucherNo} created.`,invoice:inv,voucher});
  }catch(e){return res.status(400).json({success:false,message:e.message||"Sale failed."})}
}
export async function getSales(req,res){try{const filter={status:"POSTED"};if(req.user?.companyId)filter.companyId=req.user.companyId;return listModel(req,res,SalesInvoice,filter,[{invoiceNo:1},{customerName:1},{"lines.itemName":1}])}catch(e){return res.status(500).json({success:false,message:e.message})}}
export async function getGstReport(req,res){try{const filter={};if(req.user?.companyId)filter.companyId=req.user.companyId;const from=dt(req.query.from),to=dt(req.query.to);if(from||to)filter.date={...(from?{$gte:from}:{}),...(to?{$lte:to}: {})};const rows=await GstLedger.find(filter).sort({date:-1}).limit(5000).lean();const out={input:{taxable:0,cgst:0,sgst:0,igst:0},output:{taxable:0,cgst:0,sgst:0,igst:0}};rows.forEach(x=>{const k=x.sourceType==="PURCHASE"?"input":"output";out[k].taxable+=num(x.taxableAmount);out[k].cgst+=num(x.cgst);out[k].sgst+=num(x.sgst);out[k].igst+=num(x.igst)});return res.json({success:true,summary:out,rows})}catch(e){return res.status(500).json({success:false,message:e.message})}}



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
    const itemType=["RAW_MATERIAL","GRADE","FINISHED_GOODS"].includes(b.itemType)?b.itemType:"RAW_MATERIAL";
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
