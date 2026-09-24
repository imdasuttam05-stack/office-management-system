import RawMaterialPurchase from "../models/RawMaterialPurchase.js";
import InventoryStock from "../models/InventoryStock.js";
import InventoryCounter from "../models/InventoryCounter.js";
import ManufacturingJobOrder from "../models/ManufacturingJobOrder.js";
import SalesInvoice from "../models/SalesInvoice.js";
import GstLedger from "../models/GstLedger.js";
import LocationMaster from "../models/LocationMaster.js";
import SupplierMaster from "../models/SupplierMaster.js";
import InventoryItemMaster from "../models/InventoryItemMaster.js";
function clean(v){return String(v??"").trim()} function num(v){const n=Number(v);return Number.isFinite(n)?n:0} function r2(v){return Math.round((num(v)+Number.EPSILON)*100)/100} function dt(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
async function next(key,prefix){const y=new Date().getFullYear();const c=await InventoryCounter.findOneAndUpdate({key:`${key}_${y}`},{$inc:{seq:1}},{upsert:true,new:true,setDefaultsOnInsert:true});return `${prefix}-${y}-${String(c.seq).padStart(5,"0")}`}
async function adjustStock({companyId,location,itemType,itemName,unit,qty,value,mode="ADD",hsn="",batchNo="",barcode="",mfgDate=null,expiryDate=null}){
 const filter={companyId:companyId||null,location,itemType,itemName,batchNo:batchNo||"",barcode:barcode||""};
 const old=await InventoryStock.findOne(filter).select("qty stockValue").lean(); const oq=num(old?.qty), ov=num(old?.stockValue); const q=mode==="ADD"?qty:-qty; const v=mode==="ADD"?value:-value;
 if(mode!=="ADD" && oq+q < -0.000001) throw new Error(`Insufficient ${itemType} stock for ${itemName}. Available ${oq}, required ${qty}.`);
 const nq=r2(oq+q), nv=r2(Math.max(0,ov+v));
 await InventoryStock.findOneAndUpdate(filter,{$set:{hsn,unit,mfgDate,expiryDate,averageRate:nq?r2(nv/nq):0,lastPurchaseRate:mode==="ADD"?r2(value/(qty||1)):undefined,lastPurchaseDate:mode==="ADD"?new Date():undefined},$inc:{qty:q,stockValue:v},$setOnInsert:{companyId:companyId||null,location,itemType,itemName,batchNo:batchNo||"",barcode:barcode||""}},{upsert:true,new:true});
}
function buildLine(x){const qty=num(x.qty),rate=num(x.purchaseRate),gross=qty*rate,discount=Math.min(Math.max(num(x.discount),0),gross),taxable=r2(gross-discount),gstRate=Math.max(0,Math.min(num(x.gstRate),100)),gstType=["NONE","CGST_SGST","IGST"].includes(x.gstType)?x.gstType:"NONE",gst=gstType==="NONE"?0:r2(taxable*gstRate/100),cgst=gstType==="CGST_SGST"?r2(gst/2):0,sgst=gstType==="CGST_SGST"?r2(gst-cgst):0,igst=gstType==="IGST"?gst:0;return {itemName:clean(x.itemName),hsn:clean(x.hsn),unit:clean(x.unit)||"KG",batchNo:clean(x.batchNo),barcode:clean(x.barcode),mfgDate:dt(x.mfgDate),expiryDate:dt(x.expiryDate),qty,purchaseRate:rate,discount:r2(discount),taxableAmount:taxable,gstRate,gstType,cgst,sgst,igst,lineTotal:r2(taxable+cgst+sgst+igst),landedCost:0}}
export async function getPurchaseMasters(req,res){
  try{
    const companyId=req.user?.companyId||null;
    const [locations,suppliers,items]=await Promise.all([
      LocationMaster.find({companyId,active:true}).sort({name:1}).lean(),
      SupplierMaster.find({companyId,active:true}).sort({name:1}).lean(),
      InventoryItemMaster.find({companyId,active:true,itemType:"RAW_MATERIAL"}).sort({name:1}).lean()
    ]);
    return res.json({success:true,locations,suppliers,items});
  }catch(e){return res.status(500).json({success:false,message:e.message||"Master data load failed."})}
}
export async function createLocationMaster(req,res){try{const b=req.body||{},name=clean(b.name);if(!name)return res.status(400).json({success:false,message:"Location / Godown name is required."});const row=await LocationMaster.create({companyId:req.user?.companyId||null,name,code:clean(b.code).toUpperCase(),address:clean(b.address),createdBy:req.user._id});return res.status(201).json({success:true,message:"Location / Godown master created.",item:row});}catch(e){return res.status(400).json({success:false,message:e.code===11000?"Location / Godown already exists.":e.message})}}
export async function createSupplierMaster(req,res){try{const b=req.body||{},name=clean(b.name);if(!name)return res.status(400).json({success:false,message:"Supplier name is required."});const row=await SupplierMaster.create({companyId:req.user?.companyId||null,name,gstin:clean(b.gstin).toUpperCase(),state:clean(b.state),phone:clean(b.phone),address:clean(b.address),createdBy:req.user._id});return res.status(201).json({success:true,message:"Supplier master created.",item:row});}catch(e){return res.status(400).json({success:false,message:e.code===11000?"Supplier already exists.":e.message})}}
export async function createInventoryItemMaster(req,res){try{const b=req.body||{},name=clean(b.name);if(!name)return res.status(400).json({success:false,message:"Item name is required."});const itemType=["RAW_MATERIAL","GRADE","FINISHED_GOODS"].includes(b.itemType)?b.itemType:"RAW_MATERIAL";const row=await InventoryItemMaster.create({companyId:req.user?.companyId||null,name,itemType,hsn:clean(b.hsn),unit:clean(b.unit)||"KG",defaultGstRate:Math.max(0,Math.min(num(b.defaultGstRate),100)),defaultBarcode:clean(b.defaultBarcode),createdBy:req.user._id});return res.status(201).json({success:true,message:"Item master created.",item:row});}catch(e){return res.status(400).json({success:false,message:e.code===11000?"Item already exists.":e.message})}}
export async function createRawMaterialPurchase(req,res){try{const b=req.body||{},location=clean(b.location),supplierName=clean(b.supplierName),raw=Array.isArray(b.lines)?b.lines:[];if(!location||!supplierName||!raw.length)return res.status(400).json({success:false,message:"Location, Supplier and at least one line are required."});const lines=raw.map(buildLine);if(lines.some(x=>!x.itemName||x.qty<=0||x.purchaseRate<0))return res.status(400).json({success:false,message:"Each raw material needs item, quantity and rate."});const subtotal=r2(lines.reduce((s,x)=>s+x.taxableAmount,0)),cg=r2(lines.reduce((s,x)=>s+x.cgst,0)),sg=r2(lines.reduce((s,x)=>s+x.sgst,0)),ig=r2(lines.reduce((s,x)=>s+x.igst,0)),transport=Math.max(0,num(b.transportCost)),other=Math.max(0,num(b.otherCost)),extra=transport+other,totalQty=lines.reduce((s,x)=>s+x.qty,0)||1;lines.forEach(x=>x.landedCost=r2(x.taxableAmount+extra*x.qty/totalQty));const purchaseNo=await next("RAW_PURCHASE","RMP"),purchase=await RawMaterialPurchase.create({purchaseNo,date:dt(b.date)||new Date(),companyId:req.user?.companyId||null,location,supplierName,supplierGSTIN:clean(b.supplierGSTIN).toUpperCase(),supplierInvoiceNo:clean(b.supplierInvoiceNo),supplierInvoiceDate:dt(b.supplierInvoiceDate),transportCost:transport,otherCost:other,subtotal,totalCGST:cg,totalSGST:sg,totalIGST:ig,grandTotal:r2(subtotal+cg+sg+ig+transport+other),remarks:clean(b.remarks),lines,createdBy:req.user._id});for(const x of lines){await adjustStock({companyId:req.user?.companyId,location,itemType:"RAW_MATERIAL",itemName:x.itemName,unit:x.unit,qty:x.qty,value:x.landedCost,hsn:x.hsn,batchNo:x.batchNo,barcode:x.barcode,mfgDate:x.mfgDate,expiryDate:x.expiryDate});await GstLedger.create({companyId:req.user?.companyId||null,sourceType:"PURCHASE",sourceId:purchase._id,documentNo:purchaseNo,date:purchase.date,partyName:supplierName,partyGSTIN:purchase.supplierGSTIN,location,hsn:x.hsn,taxableAmount:x.taxableAmount,cgst:x.cgst,sgst:x.sgst,igst:x.igst,gstRate:x.gstRate,supplyType:x.gstType});}return res.status(201).json({success:true,message:`Purchase ${purchaseNo} posted and raw stock updated.`,purchase});}catch(e){console.error(e);return res.status(500).json({success:false,message:e.message||"Purchase failed."})}}
export async function getRawMaterialPurchases(req,res){try{return await listModel(req,res,RawMaterialPurchase,{status:"POSTED"},[{purchaseNo:1},{supplierName:1},{"lines.itemName":1}])}catch(e){return res.status(500).json({success:false,message:e.message})}}
async function listModel(req,res,Model,base,searchFields){const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(5,Number(req.query.limit)||20)),filter={...base};if(req.user?.companyId&&Model.schema.path("companyId"))filter.companyId=req.user.companyId;const q=clean(req.query.search);if(q)filter.$or=searchFields.map(f=>Object.fromEntries([[Object.keys(f)[0],{$regex:q,$options:"i"}]]));const [items,total]=await Promise.all([Model.find(filter).sort({date:-1,createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),Model.countDocuments(filter)]);return res.json({success:true,items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}})}
export async function getRawMaterialStock(req,res){return stockList(req,res,"RAW_MATERIAL")}
export async function getStock(req,res){return stockList(req,res,clean(req.query.itemType)||"RAW_MATERIAL")}
async function stockList(req,res,itemType){try{const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(5,Number(req.query.limit)||25)),filter={itemType,qty:{$gt:0}};if(req.user?.companyId)filter.companyId=req.user.companyId;if(clean(req.query.location))filter.location=clean(req.query.location);if(clean(req.query.search))filter.itemName={$regex:clean(req.query.search),$options:"i"};const [items,total]=await Promise.all([InventoryStock.find(filter).sort({itemName:1}).skip((page-1)*limit).limit(limit).lean(),InventoryStock.countDocuments(filter)]);return res.json({success:true,items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}})}catch(e){return res.status(500).json({success:false,message:e.message})}}
export async function createJobOrder(req,res){try{const b=req.body||{},type=b.type,location=clean(b.location),sources=Array.isArray(b.sourceItems)?b.sourceItems:[],outputs=Array.isArray(b.outputItems)?b.outputItems:[];if(!["GRADING","FINISHED_GOODS"].includes(type)||!location||!sources.length||!outputs.length)return res.status(400).json({success:false,message:"Type, location, source items and output items are required."});const allowedIn=type==="GRADING"?"RAW_MATERIAL":"GRADE", allowedOut=type==="GRADING"?"GRADE":"FINISHED_GOODS";let sourceValue=0,outputValue=0;for(const x of sources){const q=num(x.qty),rate=num(x.rate);if(q<=0)throw new Error(`Invalid source quantity for ${x.itemName}.`);const st=await InventoryStock.findOne({companyId:req.user?.companyId||null,location,itemType:allowedIn,itemName:clean(x.itemName),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});if(!st||num(st.qty)<q)throw new Error(`Insufficient ${allowedIn} stock for ${x.itemName}.`);sourceValue+=q*(rate>0?rate:num(st.averageRate));}for(const x of outputs){if(num(x.qty)<=0||!clean(x.itemName))throw new Error("Every output needs item and quantity.");outputValue+=num(x.qty)*num(x.rate)}const labour=Math.max(0,num(b.labourCost)),transport=Math.max(0,num(b.transportCost)),other=Math.max(0,num(b.otherCost)),totalCost=r2(sourceValue+labour+transport+other),jobNo=await next(type==="GRADING"?"GRADING_JOB":"FG_JOB",type==="GRADING"?"GRD":"FGJ");const job=await ManufacturingJobOrder.create({jobNo,companyId:req.user?.companyId||null,date:dt(b.date)||new Date(),type,location,sourceItems:sources.map(x=>({...x,itemName:clean(x.itemName),unit:clean(x.unit)||"KG",qty:num(x.qty),rate:num(x.rate),value:r2(num(x.qty)*num(x.rate)),batchNo:clean(x.batchNo),barcode:clean(x.barcode)})),outputItems:outputs.map(x=>({...x,itemName:clean(x.itemName),unit:clean(x.unit)||"PCS",qty:num(x.qty),rate:num(x.rate),value:r2(num(x.qty)*num(x.rate)),batchNo:clean(x.batchNo),barcode:clean(x.barcode)})),labourCost:labour,transportCost:transport,otherCost:other,totalCost,notes:clean(b.notes),createdBy:req.user._id});for(const x of job.sourceItems)await adjustStock({companyId:req.user?.companyId,location,itemType:allowedIn,itemName:x.itemName,unit:x.unit,qty:x.qty,value:x.value,mode:"SUBTRACT",batchNo:x.batchNo,barcode:x.barcode});const totalOutputQty=outputs.reduce((s,x)=>s+num(x.qty),0)||1;for(const x of job.outputItems){const alloc=r2(totalCost*x.qty/totalOutputQty);await adjustStock({companyId:req.user?.companyId,location,itemType:allowedOut,itemName:x.itemName,unit:x.unit,qty:x.qty,value:alloc,mode:"ADD",hsn:x.hsn||"",batchNo:x.batchNo,barcode:x.barcode,mfgDate:dt(x.mfgDate)||job.date,expiryDate:dt(x.expiryDate)});}return res.status(201).json({success:true,message:`${type} Job Order ${jobNo} posted.`,job});}catch(e){console.error(e);return res.status(400).json({success:false,message:e.message||"Job order failed."})}}
export async function getJobs(req,res){try{const filter={status:"POSTED"};if(req.user?.companyId)filter.companyId=req.user.companyId; if(req.query.type)filter.type=req.query.type;const items=await ManufacturingJobOrder.find(filter).sort({date:-1,createdAt:-1}).limit(100).lean();return res.json({success:true,items})}catch(e){return res.status(500).json({success:false,message:e.message})}}
export async function createSale(req,res){try{const b=req.body||{},location=clean(b.location),customerName=clean(b.customerName),lines=Array.isArray(b.lines)?b.lines:[];if(!location||!customerName||!lines.length)return res.status(400).json({success:false,message:"Location, customer and at least one line are required."});const supplierState=clean(b.supplierState),pos=clean(b.placeOfSupply);let subtotal=0,cg=0,sg=0,ig=0;const built=[];for(const x of lines){const qty=num(x.qty),rate=num(x.rate),discount=Math.min(Math.max(num(x.discount),0),qty*rate),taxable=r2(qty*rate-discount),gstRate=Math.max(0,num(x.gstRate)),gstType=["NONE","CGST_SGST","IGST"].includes(x.gstType)?x.gstType:"NONE",gst=gstType==="NONE"?0:r2(taxable*gstRate/100),c=gstType==="CGST_SGST"?r2(gst/2):0,s=gstType==="CGST_SGST"?r2(gst-c):0,i=gstType==="IGST"?gst:0;const st=await InventoryStock.findOne({companyId:req.user?.companyId||null,location,itemType:"FINISHED_GOODS",itemName:clean(x.itemName),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});if(!st||num(st.qty)<qty)throw new Error(`Insufficient finished goods stock for ${x.itemName}.`);built.push({...x,itemName:clean(x.itemName),stockId:st._id,unit:clean(x.unit)||st.unit,qty,rate,discount,taxableAmount:taxable,hsn:clean(x.hsn)||st.hsn,gstRate,gstType,cgst:c,sgst:s,igst:i,lineTotal:r2(taxable+c+s+i),batchNo:clean(x.batchNo),barcode:clean(x.barcode)});subtotal+=taxable;cg+=c;sg+=s;ig+=i;}const invoiceNo=await next("SALE","SAL"),inv=await SalesInvoice.create({invoiceNo,companyId:req.user?.companyId||null,date:dt(b.date)||new Date(),location,customerName,customerGSTIN:clean(b.customerGSTIN).toUpperCase(),customerState:clean(b.customerState),supplierState,supplyType:clean(b.customerGSTIN)?"B2B":"B2C",placeOfSupply:pos,lines:built,subtotal:r2(subtotal),totalCGST:r2(cg),totalSGST:r2(sg),totalIGST:r2(ig),grandTotal:r2(subtotal+cg+sg+ig),remarks:clean(b.remarks),createdBy:req.user._id});for(const x of built){const old=await InventoryStock.findById(x.stockId).lean();const cost=r2(num(old?.averageRate)*x.qty);await adjustStock({companyId:req.user?.companyId,location,itemType:"FINISHED_GOODS",itemName:x.itemName,unit:x.unit,qty:x.qty,value:cost,mode:"SUBTRACT",batchNo:x.batchNo,barcode:x.barcode});await GstLedger.create({companyId:req.user?.companyId||null,sourceType:"SALE",sourceId:inv._id,documentNo:invoiceNo,date:inv.date,partyName:customerName,partyGSTIN:inv.customerGSTIN,location,hsn:x.hsn,taxableAmount:x.taxableAmount,cgst:x.cgst,sgst:x.sgst,igst:x.igst,gstRate:x.gstRate,supplyType:inv.supplyType});}return res.status(201).json({success:true,message:`Sale ${invoiceNo} posted and finished stock reduced.`,invoice:inv});}catch(e){return res.status(400).json({success:false,message:e.message||"Sale failed."})}}
export async function getSales(req,res){try{const filter={status:"POSTED"};if(req.user?.companyId)filter.companyId=req.user.companyId;return listModel(req,res,SalesInvoice,filter,[{invoiceNo:1},{customerName:1},{"lines.itemName":1}])}catch(e){return res.status(500).json({success:false,message:e.message})}}
export async function getGstReport(req,res){try{const filter={};if(req.user?.companyId)filter.companyId=req.user.companyId;const from=dt(req.query.from),to=dt(req.query.to);if(from||to)filter.date={...(from?{$gte:from}:{}),...(to?{$lte:to}: {})};const rows=await GstLedger.find(filter).sort({date:-1}).limit(5000).lean();const out={input:{taxable:0,cgst:0,sgst:0,igst:0},output:{taxable:0,cgst:0,sgst:0,igst:0}};rows.forEach(x=>{const k=x.sourceType==="PURCHASE"?"input":"output";out[k].taxable+=num(x.taxableAmount);out[k].cgst+=num(x.cgst);out[k].sgst+=num(x.sgst);out[k].igst+=num(x.igst)});return res.json({success:true,summary:out,rows})}catch(e){return res.status(500).json({success:false,message:e.message})}}


export async function updateLocationMaster(req,res){
  try{
    const b=req.body||{};
    const row=await LocationMaster.findOneAndUpdate(
      {_id:req.params.id,companyId:req.user?.companyId||null},
      {$set:{name:clean(b.name),code:clean(b.code).toUpperCase(),address:clean(b.address)}},
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
      {$set:{name:clean(b.name),gstin:clean(b.gstin).toUpperCase(),state:clean(b.state),phone:clean(b.phone),address:clean(b.address)}},
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
