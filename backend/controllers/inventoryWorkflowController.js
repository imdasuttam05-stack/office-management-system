import InventoryItemMaster from "../models/InventoryItemMaster.js";
import LocationMaster from "../models/LocationMaster.js";
import SupplierMaster from "../models/SupplierMaster.js";
import CustomerMaster from "../models/CustomerMaster.js";
import InventoryStock from "../models/InventoryStock.js";
import InventoryMovement from "../models/InventoryMovement.js";
import InventoryWorkflow from "../models/InventoryWorkflow.js";
import ManufacturingJobOrder from "../models/ManufacturingJobOrder.js";
import ProductionEntry from "../models/ProductionEntry.js";
import BOM from "../models/BOM.js";
import BOMCostItemMaster from "../models/BOMCostItemMaster.js";
import PackingConversionRate from "../models/PackingConversionRate.js";
import RawMaterialPurchase from "../models/RawMaterialPurchase.js";
import Ledger from "../models/Ledger.js";
import Group from "../models/Group.js";
import Voucher from "../models/Voucher.js";
import InventoryCounter from "../models/InventoryCounter.js";
const clean=v=>String(v??"").trim(); const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0}; const r2=v=>Math.round((num(v)+Number.EPSILON)*100)/100; const q6=v=>Math.round((num(v)+Number.EPSILON)*1000000)/1000000;
const parseDateOnly=value=>{const text=clean(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return null;const date=new Date(`${text}T00:00:00.000Z`);return Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==text?null:date};
const packageWeightKg=name=>{const match=clean(name).match(/(\d+(?:\.\d+)?)\s*(mg|g|gm|grams?|kg|kgs|kilograms?)\b/i);if(!match)return 0;const amount=Number(match[1]);return /^mg$/i.test(match[2])?amount/1000000:/^kg/i.test(match[2])?amount:amount/1000};
const packetUnit=unit=>["PC","PCS","PACKET","PACKETS","PIECE","PIECES"].includes(clean(unit).toUpperCase());
export async function createJobPackingConversion(req,res){
 try{
  const body=req.body||{},companyId=req.user?.companyId||null,jobId=clean(body.jobId);
  if(!/^[a-f\d]{24}$/i.test(jobId))return res.status(400).json({success:false,message:"Select a valid Job Order."});
  const jobFilter={_id:jobId,status:{$in:["POSTED","COMPLETED"]}};
  if(companyId)jobFilter.companyId=companyId;
  const job=await ManufacturingJobOrder.findOne(jobFilter).lean();
  if(!job)return res.status(404).json({success:false,message:"Posted Job Order not found."});
  if(!clean(job.partyName))return res.status(400).json({success:false,message:"This Job Order has no party. Add a party to the Job Order before posting conversion."});

  const entries=await ProductionEntry.find({companyId,jobId:job._id,status:"POSTED"}).sort({date:1,createdAt:1}).lean();
  const productionRows=[];
  for(const entry of entries)for(const [productionLineIndex,line] of (entry.outputItems||[]).entries()){
   const itemName=clean(line.itemName),key=itemName.toLowerCase();
   if(!key)continue;
   const planned=(job.outputItems||[]).find(output=>clean(output.itemName).toLowerCase()===key);
   productionRows.push({productionEntryId:String(entry._id),productionLineIndex,productionNo:entry.productionNo||"",productionDate:entry.date,itemId:String(line.itemId||planned?.itemId||""),itemName,...productionQuantities(line)});
  }
  if(!productionRows.length)return res.status(400).json({success:false,message:`No production has been posted against Job Order ${job.jobNo}.`});

  const date=body.date?parseDateOnly(body.date):parseDateOnly(new Date().toISOString().slice(0,10));
  if(!date)return res.status(400).json({success:false,message:"Enter a valid conversion date."});
  const previous=await InventoryWorkflow.find({companyId,docType:"PACKING_CONVERSION","meta.jobId":String(job._id),status:"POSTED"}).select("meta").lean();
  const convertedByProduction=new Map(),legacyByProduct=new Map();
  for(const document of previous)for(const line of document.meta?.conversionLines||[]){
   const entryId=String(line.productionEntryId||line.entryId||""),productKey=clean(line.itemName).toLowerCase(),converted={qtyKg:num(line.qtyKg),packetCount:num(line.packetCount)};
   if(entryId){
    const key=`${entryId}:${line.productionLineIndex??0}`,current=convertedByProduction.get(key)||{qtyKg:0,packetCount:0};
    current.qtyKg+=converted.qtyKg;current.packetCount+=converted.packetCount;convertedByProduction.set(key,current);
   }else{
    const current=legacyByProduct.get(productKey)||{qtyKg:0,packetCount:0};
    current.qtyKg+=converted.qtyKg;current.packetCount+=converted.packetCount;legacyByProduct.set(productKey,current);
   }
  }

  const rateScope=companyId?{$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]}:{$or:[{companyId:null},{companyId:{$exists:false}}]};
  const rates=await PackingConversionRate.find({$and:[rateScope,{active:true}]}).lean();
  const conversionLines=[];
  for(const produced of productionRows){
   const previousQty=convertedByProduction.get(`${produced.productionEntryId}:${produced.productionLineIndex}`)||{qtyKg:0,packetCount:0};
   const legacy=legacyByProduct.get(produced.itemName.toLowerCase())||{qtyKg:0,packetCount:0};
   const legacyQty=Math.min(Math.max(0,produced.qtyKg-previousQty.qtyKg),legacy.qty),legacyPackets=Math.min(Math.max(0,produced.packetCount-previousQty.packetCount),legacy.packetCount);
   legacy.qty=Math.max(0,legacy.qty-legacyQty);legacy.packetCount=Math.max(0,legacy.packetCount-legacyPackets);
   legacyByProduct.set(produced.itemName.toLowerCase(),legacy);
   const qtyKg=Math.max(0,produced.qtyKg-previousQty.qtyKg-legacyQty),packetCount=Math.max(0,produced.packetCount-previousQty.packetCount-legacyPackets);
   if(qtyKg<=0.000001&&packetCount<=0.000001)continue;
   const matchingRates=rates.filter(item=>(produced.itemId&&String(item.itemId)===produced.itemId)||clean(item.itemName).toLowerCase()===produced.itemName.toLowerCase());
   const master=matchingRates.find(item=>(item.periods||[]).some(period=>new Date(period.effectiveFrom)<=date&&new Date(period.effectiveTo)>=date));
   const rate=master?.periods.find(period=>new Date(period.effectiveFrom)<=date&&new Date(period.effectiveTo)>=date);
   if(!rate)return res.status(400).json({success:false,message:`No Packing Conversion Rate for ${produced.itemName} is valid on ${date.toISOString().slice(0,10)}. Add or update its date range.`});
   const basisQty=rate.rateBasis==="PCS"?packetCount:qtyKg;
   if(basisQty<=0)return res.status(400).json({success:false,message:`${produced.itemName} has no ${rate.rateBasis} production quantity to convert.`});
   if(num(rate.rate)<=0)return res.status(400).json({success:false,message:`Enter a conversion rate greater than zero for ${produced.itemName}.`});
   conversionLines.push({productionEntryId:produced.productionEntryId,productionLineIndex:produced.productionLineIndex,productionNo:produced.productionNo,productionDate:produced.productionDate,itemId:produced.itemId||String(master.itemId),itemName:produced.itemName,rateBasis:rate.rateBasis,basisQty:q6(basisQty),rate:num(rate.rate),effectiveFrom:rate.effectiveFrom,effectiveTo:rate.effectiveTo,amount:r2(basisQty*num(rate.rate)),qtyKg:q6(qtyKg),packetCount:q6(packetCount),packetWeightKg:q6(produced.packetWeightKg)});
  }
  if(!conversionLines.length)return res.status(400).json({success:false,message:`All production for Job Order ${job.jobNo} has already been converted.`});

  const charge=r2(conversionLines.reduce((sum,line)=>sum+line.amount,0));
  if(charge<=0)return res.status(400).json({success:false,message:"The total conversion charge must be greater than zero after rounding to currency precision."});
  const partyScope={$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]};
  const customer=(job.partyId?await CustomerMaster.findOne({_id:job.partyId,active:true,...partyScope}):null)||await CustomerMaster.findOne({name:clean(job.partyName),active:true,...partyScope});
  let partyLedger=customer?.ledgerId?await Ledger.findOne({_id:customer.ledgerId,isActive:true}):null;
  if(!partyLedger)partyLedger=await Ledger.findOne({name:customer?.name||job.partyName,isActive:true});
  if(!partyLedger)partyLedger=await ledger(customer?.name||job.partyName,"Sundry Debtors","Asset",req);
  if(customer&&!customer.ledgerId){customer.ledgerId=partyLedger._id;await customer.save();}
  const incomeLedger=await ledger("Packing Conversion Income","Direct Incomes","Income",req);
  const locationId=clean(job.location);
  const location=/^[a-f\d]{24}$/i.test(locationId)?await LocationMaster.findOne({_id:locationId,$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]}).select("name").lean():null;
  const docNo=await next("PACKING_CONVERSION","PCV"),itemType=job.type==="GRADING"?"GRADE":"FINISHED_GOODS";
  const outputLines=conversionLines.map(line=>({itemId:line.itemId,itemName:line.itemName,itemType,unit:"KG",qty:line.qtyKg,rate:0,value:0}));
  const partyName=customer?.name||job.partyName,partyId=customer?._id||job.partyId||null;
  const document=await InventoryWorkflow.create({companyId,docNo,docType:"PACKING_CONVERSION",date,location:location?.name||locationId,partyId,partyName,referenceNo:job.jobNo,sourceLines:[],outputLines,totalValue:charge,notes:clean(body.notes),meta:{jobId:String(job._id),jobNo:job.jobNo,locationId,conversionCharge:charge,conversionLines},createdBy:req.user._id});
  let accountingVoucher;
  try{
   accountingVoucher=await voucher(req,date,"Journal",partyLedger._id,docNo,[
    {ledger:partyLedger._id,debit:charge,credit:0,narration:`Packing conversion charge for Job Order ${job.jobNo}`},
    {ledger:incomeLedger._id,debit:0,credit:charge,narration:`Packing conversion income for Job Order ${job.jobNo}`},
   ],`Packing conversion for Job Order ${job.jobNo} · ${partyName}`,document._id);
   document.meta={...document.meta,voucherNo:accountingVoucher.voucherNo};
   await document.save();
  }catch(error){
   if(accountingVoucher)await Voucher.deleteOne({_id:accountingVoucher._id});
   await InventoryWorkflow.deleteOne({_id:document._id,companyId});
   throw error;
  }
  return res.status(201).json({success:true,message:`Packing conversion ${docNo} posted against Job Order ${job.jobNo} for ${partyName}. Accounting voucher ${accountingVoucher.voucherNo} created.`,item:document,conversionLines,voucherNo:accountingVoucher.voucherNo});
 }catch(error){
  return res.status(400).json({success:false,message:error.message||"Packing conversion could not be posted."});
 }
}
function productionQuantities(line){const weight=num(line.packetWeightKg)||packageWeightKg(line.itemName),packets=num(line.packetCount);if(packets>0)return {packetCount:packets,qtyKg:weight>0?packets*weight:num(line.qty),packetWeightKg:weight};if(weight>0&&packetUnit(line.unit))return {packetCount:num(line.qty),qtyKg:num(line.qty)*weight,packetWeightKg:weight};if(weight>0)return {packetCount:num(line.qty)/weight,qtyKg:num(line.qty),packetWeightKg:weight};return {packetCount:0,qtyKg:num(line.qty),packetWeightKg:0}}
const bomCostAmount=(qty,unit,rate)=>{const normalized=clean(unit).toLowerCase();const divisor=["g","gm","gram","grams","ml","milliliter","milliliters","millilitre","millilitres"].includes(normalized)?1000:normalized==="mg"?1000000:1;return r2(num(qty)*num(rate)/divisor)};
const bomMaterialRatePerKg=materials=>{const factors={kg:1,kgs:1,kilogram:1,kilograms:1,g:.001,gm:.001,gram:.001,grams:.001,mg:.000001};let totalKg=0,totalValue=0;for(const line of materials){const factor=factors[clean(line.unit).toLowerCase()];if(!factor)continue;const qty=num(line.qtyPerUnit);totalKg+=qty*factor;totalValue+=qty*num(line.rate)}return totalKg?r2(totalValue/totalKg):null};
const packageWeightGrams=name=>{const match=String(name||"").match(/(\d+(?:\.\d+)?)\s*(mg|g|gm|grams?|kg|kgs|kilograms?)\b/i);if(!match)return 0;const amount=Number(match[1]);return /^mg$/i.test(match[2])?amount/1000:/^kg/i.test(match[2])?amount*1000:amount};
const bomCostQuantity=(master,outputName,outputQty,materials=[])=>{const unit=clean(master.unit).toLowerCase(),multiplier=num(master.quantityMultiplier??1),materialGrams=materials.reduce((sum,line)=>{const materialUnit=clean(line.unit).toLowerCase(),factor=["kg","kgs","kilogram","kilograms"].includes(materialUnit)?1000:["g","gm","gram","grams"].includes(materialUnit)?1:materialUnit==="mg"?.001:0;return sum+num(line.qtyPerUnit)*factor},0),weight=materialGrams||packageWeightGrams(outputName)*(num(outputQty)||1),count=num(outputQty)||1;if(["pkt","pack","packet","pcs","pc","piece","pieces","ea"].includes(unit))return r2(count*multiplier);if(["g","gm","gram","grams"].includes(unit))return weight?r2(weight*multiplier):null;if(["kg","kgs","kilogram","kilograms"].includes(unit))return weight?r2(weight*multiplier/1000):null;return r2(count*multiplier)};
async function next(key,prefix){const y=new Date().getFullYear();const c=await InventoryCounter.findOneAndUpdate({key:`${key}_${y}`},{$inc:{seq:1}},{upsert:true,new:true,setDefaultsOnInsert:true});return `${prefix}-${y}-${String(c.seq).padStart(5,"0")}`}
async function ledger(name,groupName,nature,req){let l=await Ledger.findOne({name,isActive:true});if(l)return l;let g=await Group.findOne({name:groupName,parent:null});if(!g)g=await Group.create({name:groupName,parent:null,nature,isSystem:true});return Ledger.create({name,group:g._id,createdBy:req.user._id});}
async function voucher(req,date,type,partyLedger,referenceNo,lines,narration,sourceId){const cleanLines=lines.map(x=>({ledger:x.ledger,debit:r2(x.debit),credit:r2(x.credit),narration:x.narration||narration}));const d=r2(cleanLines.reduce((s,x)=>s+x.debit,0)),c=r2(cleanLines.reduce((s,x)=>s+x.credit,0));if(d<=0||Math.abs(d-c)>0.005)throw Error("Accounting voucher is not balanced.");const no=await next("WF_VOUCHER",type.slice(0,3).toUpperCase());return Voucher.create({voucherNo:no,date,type,partyLedger,referenceNo,narration,lines:cleanLines,totalDebit:d,totalCredit:c,sourceType:"INVENTORY_WORKFLOW",sourceId,createdBy:req.user._id})}
export async function getWorkflowMasters(req,res){try{const companyId=req.user?.companyId||null;const scope=companyId?{$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]}:{$or:[{companyId:null},{companyId:{$exists:false}}]};const active={$or:[{active:true},{active:{$exists:false}},{active:null}]};const master={$and:[scope,active]};const [items,locations,suppliers,customers]=await Promise.all([InventoryItemMaster.find({$and:[scope,active]}).sort({itemType:1,name:1}).lean(),LocationMaster.find(master).sort({name:1}).lean(),SupplierMaster.find(master).sort({name:1}).lean(),CustomerMaster.find(master).sort({name:1}).lean()]);res.json({success:true,items,locations,suppliers,customers})}catch(e){res.status(500).json({success:false,message:e.message})}}

export async function listPackingConversionRates(req,res){
 try{
  const companyId=req.user?.companyId||null,scope=companyId?{$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]}:{$or:[{companyId:null},{companyId:{$exists:false}}]};
  const masters=await PackingConversionRate.find({$and:[scope,{active:true}]}).sort({itemName:1}).lean();
  const items=masters.flatMap(master=>{
   if(master.periods?.length)return master.periods.map(period=>({...period,_id:String(period._id),periodId:String(period._id),masterId:String(master._id),itemId:String(master.itemId),itemName:master.itemName}));
   return [{_id:String(master._id),masterId:String(master._id),periodId:"",itemId:String(master.itemId),itemName:master.itemName,rateBasis:master.rateBasis,rate:master.rate,effectiveFrom:null,effectiveTo:null,legacy:true}];
  });
  return res.json({success:true,items});
 }catch(e){return res.status(500).json({success:false,message:e.message})}
}
export async function savePackingConversionRate(req,res){
 try{
  const body=req.body||{},companyId=req.user?.companyId||null,itemId=clean(body.itemId),rateBasis=clean(body.rateBasis).toUpperCase(),rate=Number(body.rate),effectiveFrom=parseDateOnly(body.effectiveFrom),effectiveTo=parseDateOnly(body.effectiveTo);
  if(!/^[a-f\d]{24}$/i.test(itemId)||!["PCS","KG"].includes(rateBasis)||!Number.isFinite(rate)||rate<0)return res.status(400).json({success:false,message:"Select a product, choose PCS or KG, and enter a valid non-negative rate."});
  if(!effectiveFrom||!effectiveTo||effectiveFrom>effectiveTo)return res.status(400).json({success:false,message:"Enter a valid From date and To date; the From date must not be after the To date."});
  const item=await InventoryItemMaster.findOne({_id:itemId,active:true,$or:[{companyId},{companyId:null},{companyId:{$exists:false}}]});
  if(!item||!["GRADE","FINISHED_GOODS","PACKED_GOODS"].includes(item.itemType))return res.status(400).json({success:false,message:"Choose an active production output product."});
  let master=await PackingConversionRate.findOne({companyId,itemId:item._id});
  if(req.params.id){
   master=await PackingConversionRate.findOne({_id:req.params.id,companyId});
   if(!master)return res.status(404).json({success:false,message:"Packing conversion rate not found."});
   if(String(master.itemId)!==itemId)return res.status(400).json({success:false,message:"The selected product does not match this rate master."});
   if(!body.periodId){
    if(master.periods.length)return res.status(400).json({success:false,message:"Select a rate period to edit."});
    master.periods.push({effectiveFrom,effectiveTo,rateBasis,rate});
   }else{
    const period=master.periods.id(body.periodId);
    if(!period)return res.status(404).json({success:false,message:"Packing conversion rate period not found."});
    period.effectiveFrom=effectiveFrom;
    period.effectiveTo=effectiveTo;
    period.rateBasis=rateBasis;
    period.rate=rate;
   }
  }else{
   if(master?.active&&!master.periods.length)return res.status(409).json({success:false,message:"This product has an older rate without dates. Edit that rate and set its date range before adding another period."});
   if(!master)master=new PackingConversionRate({companyId,itemId:item._id,itemName:item.name,rateBasis,rate,createdBy:req.user._id});
   master.periods.push({effectiveFrom,effectiveTo,rateBasis,rate});
  }
  const currentPeriodId=body.periodId||String(master.periods[master.periods.length-1]._id);
  const overlaps=master.periods.some(period=>String(period._id)!==String(currentPeriodId)&&effectiveFrom<=period.effectiveTo&&effectiveTo>=period.effectiveFrom);
  if(overlaps)return res.status(409).json({success:false,message:"This date range overlaps another rate period for the selected product."});
  master.itemName=item.name;
  master.rateBasis=rateBasis;
  master.rate=rate;
  master.active=true;
  await master.save();
  return res.status(req.params.id?200:201).json({success:true,message:req.params.id?"Packing conversion rate period saved.":"Packing conversion rate period added.",item:master});
 }catch(e){return res.status(e?.code===11000?409:400).json({success:false,message:e?.code===11000?"A conversion rate for this product already exists.":e.message})}
}
export async function deletePackingConversionRate(req,res){
 try{
  const companyId=req.user?.companyId||null,master=await PackingConversionRate.findOne({_id:req.params.id,companyId});
  if(!master)return res.status(404).json({success:false,message:"Packing conversion rate not found."});
  const periodId=clean(req.params.periodId);
  if(periodId){
   const period=master.periods.id(periodId);
   if(!period)return res.status(404).json({success:false,message:"Packing conversion rate period not found."});
   period.deleteOne();
   if(!master.periods.length)master.active=false;
   await master.save();
  }else{
   if(master.periods.length)return res.status(400).json({success:false,message:"Choose a specific rate period to deactivate."});
   master.active=false;
   await master.save();
  }
  return res.json({success:true,message:"Packing conversion rate period deactivated."});
 }catch(e){return res.status(400).json({success:false,message:e.message})}
}
export async function getPurchaseRate(req,res){try{const itemId=clean(req.query.itemId),itemName=clean(req.query.itemName);const filter={status:"POSTED"};if(req.user?.companyId)filter.companyId=req.user.companyId;const rows=await RawMaterialPurchase.find(filter).sort({date:-1,createdAt:-1}).lean();for(const p of rows){for(const l of p.lines||[]){if((itemId&&String(l.itemId)===String(itemId))||(!itemId&&itemName&&clean(l.itemName).toLowerCase()===itemName.toLowerCase()))return res.json({success:true,rate:num(l.purchaseRate),purchaseNo:p.purchaseNo,date:p.date,supplierName:p.supplierName});}}return res.json({success:true,rate:0});}catch(e){res.status(500).json({success:false,message:e.message})}}
export async function listBoms(req,res){const filter={active:true,companyId:req.user?.companyId||null};res.json({success:true,items:await BOM.find(filter).sort({name:1}).lean()})}
export async function listBomCostItems(req,res){try{const items=await BOMCostItemMaster.find({companyId:req.user?.companyId||null,active:true}).sort({name:1}).lean();return res.json({success:true,items})}catch(e){return res.status(500).json({success:false,message:e.message})}}
export async function saveBomCostItem(req,res){try{const b=req.body||{},companyId=req.user?.companyId||null,name=clean(b.name),unit=clean(b.unit),rateSource=b.rateSource==="BOM_MATERIAL"?"BOM_MATERIAL":"STANDARD",standardRate=rateSource==="BOM_MATERIAL"?0:num(b.standardRate),quantityMultiplier=num(b.quantityMultiplier??1);if(!name||!unit||standardRate<0||quantityMultiplier<0)return res.status(400).json({success:false,message:"Cost item name, unit, rate and a valid quantity multiplier are required."});const values={name,unit,standardRate,rateSource,quantityMultiplier,active:true};let item;if(req.params.id){item=await BOMCostItemMaster.findOneAndUpdate({_id:req.params.id,companyId},{$set:values},{new:true,runValidators:true});if(!item)return res.status(404).json({success:false,message:"BOM cost item master not found."})}else{item=await BOMCostItemMaster.findOneAndUpdate({companyId,name},{$set:values,$setOnInsert:{companyId,createdBy:req.user._id}},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true})}return res.status(req.params.id?200:201).json({success:true,message:req.params.id?"Cost item master updated.":"Cost item master saved.",item})}catch(e){return res.status(e?.code===11000?409:400).json({success:false,message:e?.code===11000?"Cost item master already exists.":e.message})}}
export async function deleteBomCostItem(req,res){try{const item=await BOMCostItemMaster.findOneAndUpdate({_id:req.params.id,companyId:req.user?.companyId||null},{$set:{active:false}},{new:true});if(!item)return res.status(404).json({success:false,message:"BOM cost item master not found."});return res.json({success:true,message:"Cost item master deactivated."})}catch(e){return res.status(400).json({success:false,message:e.message})}}
export async function createBom(req,res){
 try{
  const b=req.body||{},companyId=req.user?.companyId||null,out=await InventoryItemMaster.findOne({_id:b.outputItemId,companyId,active:true});
  if(!out)throw Error("Output product must be selected from Product Master.");
  const materials=Array.isArray(b.materials)?b.materials:[];
  if(!materials.length)throw Error("BOM needs at least one material.");
  let materialCost=0;
  const lines=[];
  for(const x of materials){
   const item=await InventoryItemMaster.findOne({_id:x.itemId,companyId,active:true});
   if(!item)throw Error("BOM material not found in Product Master.");
   const qty=num(x.qtyPerUnit);
   if(qty<=0)throw Error(`Invalid BOM quantity for ${item.name}.`);
   const rate=num(x.rate),cost=r2(qty*rate);
   materialCost+=cost;
   lines.push({itemId:item._id,itemName:item.name,qtyPerUnit:qty,unit:clean(x.unit)||item.unit,rate,cost});
  }
    const costItems=[];
    for(const x of Array.isArray(b.costItems)?b.costItems:[]){
     const master=x.masterId?await BOMCostItemMaster.findOne({_id:x.masterId,companyId,active:true}):null;
     if(x.masterId&&!master)throw Error("Selected BOM cost item master is inactive or unavailable.");
    const name=master?.name||clean(x.name),unit=master?.unit||clean(x.unit),qty=master?(bomCostQuantity(master,out.name,b.outputQty,lines)??num(x.qty)):num(x.qty),rateSource=master?.rateSource||x.rateSource||"STANDARD",rate=rateSource==="BOM_MATERIAL"?bomMaterialRatePerKg(lines):master?num(master.standardRate):num(x.rate),quantityMultiplier=master?num(master.quantityMultiplier??1):num(x.quantityMultiplier??1);
     if(!name||qty<=0||rate===null||rate<0)throw Error(rateSource==="BOM_MATERIAL"?"BOM material rate requires weight-based materials with quantities and rates.":"Each BOM cost item needs a name, quantity and valid rate.");
    costItems.push({masterId:master?._id||null,name,unit,qty,rate,rateSource,quantityMultiplier,cost:bomCostAmount(qty,unit,rate)});
    }
  const costItemsTotal=r2(costItems.reduce((sum,item)=>sum+item.cost,0));
  const labour=Math.max(0,num(b.labourCost)),packing=Math.max(0,num(b.packingCost)),other=Math.max(0,num(b.otherCost));
  const total=r2(materialCost+costItemsTotal+labour+packing+other),outputQty=num(b.outputQty)||1,per=r2(total/outputQty);
  const values={name:clean(b.name),outputItemId:out._id,outputItemName:out.name,outputUnit:out.unit,outputQty,materials:lines,costItems,labourCost:labour,packingCost:packing,otherCost:other,totalCost:total,costPerUnit:per,active:true,createdBy:req.user._id};
  let row;
  if(b._id){
   row=await BOM.findOneAndUpdate({_id:b._id,companyId},{$set:values},{new:true,runValidators:true});
   if(!row)throw Error("BOM not found.");
  }else{
   row=await BOM.findOneAndUpdate({companyId,name:values.name},{$set:values,$setOnInsert:{companyId}},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});
  }
  res.status(b._id?200:201).json({success:true,message:b._id?"BOM updated.":"BOM saved.",item:row});
 }catch(e){res.status(400).json({success:false,message:e.message})}
}
export async function costing(req,res){try{const b=req.body||{},materials=Array.isArray(b.materials)?b.materials:[];const rows=materials.map(x=>({name:clean(x.name),qty:num(x.qty),rate:num(x.rate),cost:r2(num(x.qty)*num(x.rate))}));const material=r2(rows.reduce((s,x)=>s+x.cost,0)),labour=Math.max(0,num(b.labourCost)),packing=Math.max(0,num(b.packingCost)),other=Math.max(0,num(b.otherCost)),total=r2(material+labour+packing+other),outputQty=num(b.outputQty)||1;res.json({success:true,materials:rows,materialCost:material,labourCost:labour,packingCost:packing,otherCost:other,totalCost:total,outputQty,costPerUnit:r2(total/outputQty)})}catch(e){res.status(400).json({success:false,message:e.message})}}
async function stockMove({req,location,line,mode,value,sourceType,sourceNo}){const filter={companyId:req.user?.companyId||null,location,itemType:line.itemType,itemName:line.itemName,batchNo:clean(line.batchNo),barcode:clean(line.barcode)};const old=await InventoryStock.findOne(filter).lean();const oq=num(old?.qty),ov=num(old?.stockValue),q=num(line.qty),v=r2(value);if(mode==="OUT"&&oq<q-0.000001)throw Error(`Insufficient ${line.itemType} stock for ${line.itemName}. Available ${oq}, required ${q}.`);const nq=r2(mode==="OUT"?oq-q:oq+q),nv=r2(Math.max(0,mode==="OUT"?ov-v:ov+v));await InventoryStock.findOneAndUpdate(filter,{$set:{unit:clean(line.unit)||"KG",averageRate:nq?r2(nv/nq):0},$inc:{qty:mode==="OUT"?-q:q,stockValue:mode==="OUT"?-v:v},$setOnInsert:{companyId:req.user?.companyId||null,location,itemType:line.itemType,itemName:line.itemName,batchNo:clean(line.batchNo),barcode:clean(line.barcode)}},{upsert:true,new:true});await InventoryMovement.create({companyId:req.user?.companyId||null,date:new Date(),location,itemName:line.itemName,itemType:line.itemType,unit:line.unit||"KG",qtyIn:mode==="IN"?q:0,qtyOut:mode==="OUT"?q:0,valueIn:mode==="IN"?v:0,valueOut:mode==="OUT"?v:0,balanceQty:nq,sourceType,sourceNo,batchNo:clean(line.batchNo),barcode:clean(line.barcode),createdBy:req.user?._id});return nq}
export async function createPI(req,res){try{const b=req.body||{},customer=await CustomerMaster.findOne({_id:b.partyId,companyId:req.user?.companyId||null,active:true});if(!customer)throw Error("Customer / Party must come from Customer Master.");const lines=(Array.isArray(b.lines)?b.lines:[]).map(x=>({itemId:x.itemId,itemName:clean(x.itemName),itemType:clean(x.itemType)||"FINISHED_GOODS",unit:clean(x.unit)||"KG",qty:num(x.qty),rate:num(x.rate),value:r2(num(x.qty)*num(x.rate)),batchNo:clean(x.batchNo),barcode:clean(x.barcode)}));if(!lines.length||lines.some(x=>!x.itemName||x.qty<=0))throw Error("PI needs valid product lines.");const total=r2(lines.reduce((s,x)=>s+x.value,0)),no=await next("PI","PI");const row=await InventoryWorkflow.create({companyId:req.user?.companyId||null,docNo:no,docType:"PI",date:new Date(b.date||Date.now()),location:clean(b.location),partyId:customer._id,partyName:customer.name,sourceLines:lines,totalValue:total,referenceNo:clean(b.referenceNo),notes:clean(b.notes),createdBy:req.user._id});res.status(201).json({success:true,message:`PI ${no} saved. No stock has been reduced.`,item:row})}catch(e){res.status(400).json({success:false,message:e.message})}}
export async function createReturn(req,res){try{const b=req.body||{},type=clean(b.docType),lines=Array.isArray(b.lines)?b.lines:[],location=clean(b.location);if(!["PURCHASE_RETURN","SALE_RETURN","QUALITY_RETURN","EXPIRED_RETURN"].includes(type)||!location||!lines.length)throw Error("Return type, location and lines are required.");const partyId=b.partyId||null;const party=partyId?(await SupplierMaster.findOne({_id:partyId,companyId:req.user?.companyId||null,active:true}))||(await CustomerMaster.findOne({_id:partyId,companyId:req.user?.companyId||null,active:true})):null;const normalized=lines.map(x=>({...x,itemName:clean(x.itemName),itemType:clean(x.itemType)||"FINISHED_GOODS",unit:clean(x.unit)||"KG",qty:num(x.qty),rate:num(x.rate),value:r2(num(x.qty)*num(x.rate)),batchNo:clean(x.batchNo),barcode:clean(x.barcode)}));if(normalized.some(x=>!x.itemName||x.qty<=0))throw Error("Invalid return line.");const no=await next("RETURN",type==="SALE_RETURN"?"SRN":type==="PURCHASE_RETURN"?"PRN":type==="QUALITY_RETURN"?"QRT":"ERT");const row=await InventoryWorkflow.create({companyId:req.user?.companyId||null,docNo:no,docType:type,date:new Date(b.date||Date.now()),location,partyId:party?._id||null,partyName:party?.name||"",referenceNo:clean(b.referenceNo),sourceLines:normalized,totalValue:r2(normalized.reduce((s,x)=>s+x.value,0)),notes:clean(b.notes),createdBy:req.user._id});for(const x of normalized)await stockMove({req,location,line:x,mode:type==="PURCHASE_RETURN"||type==="QUALITY_RETURN"||type==="EXPIRED_RETURN"?"OUT":"IN",value:x.value,sourceType:type,sourceNo:no});if(party?.ledgerId){const returnLedger=await ledger(type==="SALE_RETURN"?"Sales Return":"Purchase Return",type==="SALE_RETURN"?"Sales Return":"Purchase Return",type==="SALE_RETURN"?"Income":"Expense",req);const linesA=type==="SALE_RETURN"?[{ledger:returnLedger._id,debit:row.totalValue,credit:0},{ledger:party.ledgerId,debit:0,credit:row.totalValue}]:[{ledger:party.ledgerId,debit:row.totalValue,credit:0},{ledger:returnLedger._id,debit:0,credit:row.totalValue}];await voucher(req,row.date,type==="SALE_RETURN"?"Credit Note":"Debit Note",party.ledgerId,no,linesA,`${type} ${no}`,row._id)}res.status(201).json({success:true,message:`${type} ${no} posted with stock and accounts effect.`,item:row})}catch(e){res.status(400).json({success:false,message:e.message})}}
export async function createRepack(req,res){try{const b=req.body||{},location=clean(b.location),sources=Array.isArray(b.sourceLines)?b.sourceLines:[],outputs=Array.isArray(b.outputLines)?b.outputLines:[];if(!location||!sources.length||!outputs.length)throw Error("Location, source and output lines are required.");const no=await next("REPACK","RPK");const row=await InventoryWorkflow.create({companyId:req.user?.companyId||null,docNo:no,docType:"REPACK",date:new Date(b.date||Date.now()),location,sourceLines:sources,outputLines:outputs,notes:clean(b.notes),createdBy:req.user._id});for(const x of sources)await stockMove({req,location,line:{...x,itemType:clean(x.itemType)||"RETURN_GOODS"},mode:"OUT",value:num(x.value)||num(x.qty)*num(x.rate),sourceType:"REPACK",sourceNo:no});for(const x of outputs)await stockMove({req,location,line:{...x,itemType:clean(x.itemType)||"PACKED_GOODS"},mode:"IN",value:num(x.value)||num(x.qty)*num(x.rate),sourceType:"REPACK",sourceNo:no});res.status(201).json({success:true,message:`Repacking ${no} posted.`,item:row})}catch(e){res.status(400).json({success:false,message:e.message})}}
export async function createDamage(req,res){try{const b=req.body||{},location=clean(b.location),lines=Array.isArray(b.lines)?b.lines:[];if(!location||!lines.length)throw Error("Location and damage lines are required.");const normalized=lines.map(x=>({...x,itemName:clean(x.itemName),itemType:clean(x.itemType)||"REJECTED",unit:clean(x.unit)||"KG",qty:num(x.qty),rate:num(x.rate),value:r2(num(x.value)||num(x.qty)*num(x.rate)),batchNo:clean(x.batchNo),barcode:clean(x.barcode)}));if(normalized.some(x=>!x.itemName||x.qty<=0))throw Error("Every damage line needs item and quantity.");const no=await next("DAMAGE","DMG");const row=await InventoryWorkflow.create({companyId:req.user?.companyId||null,docNo:no,docType:"DAMAGE",date:new Date(b.date||Date.now()),location,sourceLines:normalized,totalValue:r2(normalized.reduce((s,x)=>s+x.value,0)),notes:clean(b.notes),createdBy:req.user._id});for(const x of normalized)await stockMove({req,location,line:x,mode:"OUT",value:x.value,sourceType:"DAMAGE",sourceNo:no});res.status(201).json({success:true,message:`Damage voucher ${no} posted and stock reduced.`,item:row})}catch(e){res.status(400).json({success:false,message:e.message})}}
export async function createPackingConversion(req,res){try{const b=req.body||{},location=clean(b.location),sources=Array.isArray(b.sourceLines)?b.sourceLines:[],outputs=Array.isArray(b.outputLines)?b.outputLines:[];if(!location||!sources.length||!outputs.length)throw Error("Location, source and output lines are required.");const charge=Math.max(0,num(b.conversionCharge)),no=await next("PACKING_CONVERSION","PCV");const sourceValue=r2(sources.reduce((s,x)=>s+(num(x.value)||num(x.qty)*num(x.rate)),0)),outputValue=r2(outputs.reduce((s,x)=>s+(num(x.value)||num(x.qty)*num(x.rate)),0));const row=await InventoryWorkflow.create({companyId:req.user?.companyId||null,docNo:no,docType:"PACKING_CONVERSION",date:new Date(b.date||Date.now()),location,sourceLines:sources,outputLines:outputs,totalValue:r2(outputValue+charge),notes:clean(b.notes),meta:{conversionCharge:charge,sourceValue,outputValue},createdBy:req.user._id});for(const x of sources)await stockMove({req,location,line:{...x,itemType:clean(x.itemType)||"RAW_MATERIAL"},mode:"OUT",value:num(x.value)||num(x.qty)*num(x.rate),sourceType:"PACKING_CONVERSION",sourceNo:no});for(const x of outputs)await stockMove({req,location,line:{...x,itemType:clean(x.itemType)||"PACKED_GOODS"},mode:"IN",value:num(x.value)||num(x.qty)*num(x.rate),sourceType:"PACKING_CONVERSION",sourceNo:no});res.status(201).json({success:true,message:`Packing conversion ${no} posted. Conversion charge ₹${charge.toFixed(2)} recorded.`,item:row})}catch(e){res.status(400).json({success:false,message:e.message})}}
export async function getWorkflowDocs(req,res){try{const filter={companyId:req.user?.companyId||null};if(req.query.docType)filter.docType=clean(req.query.docType);const items=await InventoryWorkflow.find(filter).sort({date:-1,createdAt:-1}).limit(300).lean();res.json({success:true,items})}catch(e){res.status(500).json({success:false,message:e.message})}}
export async function getStockLedger(req,res){try{const filter={companyId:req.user?.companyId||null};for(const field of ["location","itemName","itemType","batchNo","barcode"]){const value=clean(req.query[field]);if(value)filter[field]=value;}const movements=await InventoryMovement.find(filter).sort({date:1,createdAt:1}).limit(1000).lean();let items=movements;if(filter.itemType==="RAW_MATERIAL"&&filter.itemName&&filter.location){const purchaseFilter={companyId:req.user?.companyId||null,location:filter.location,status:"POSTED","lines.itemName":filter.itemName};const purchases=await RawMaterialPurchase.find(purchaseFilter).sort({date:1,createdAt:1}).lean();const loggedPurchaseNos=new Set(movements.filter(x=>x.sourceType==="PURCHASE").map(x=>x.sourceNo));for(const purchase of purchases){if(loggedPurchaseNos.has(purchase.purchaseNo))continue;for(const [index,line] of (purchase.lines||[]).entries()){if(line.itemName!==filter.itemName||(filter.batchNo&&(line.batchNo||"")!==filter.batchNo)||(filter.barcode&&(line.barcode||"")!==filter.barcode))continue;items.push({_id:`legacy-${purchase._id}-${index}`,companyId:purchase.companyId,date:purchase.date,createdAt:purchase.createdAt,location:purchase.location,itemName:line.itemName,itemType:"RAW_MATERIAL",unit:line.unit||"KG",qtyIn:num(line.qty),qtyOut:0,valueIn:num(line.landedCost),valueOut:0,sourceType:"PURCHASE",sourceNo:purchase.purchaseNo,referenceNo:purchase.supplierInvoiceNo||purchase.purchaseNo,batchNo:line.batchNo||"",barcode:line.barcode||"",narration:`Raw material purchased from ${purchase.supplierName} (${purchase.purchaseNo})`});}}items.sort((a,b)=>new Date(a.date)-new Date(b.date)||new Date(a.createdAt||a.date)-new Date(b.createdAt||b.date));let balance=0;for(const movement of items){balance+=num(movement.qtyIn)-num(movement.qtyOut);movement.balanceQty=r2(balance);}items=items.sort((a,b)=>new Date(b.date)-new Date(a.date)||new Date(b.createdAt||b.date)-new Date(a.createdAt||a.date)).slice(0,1000);}else{items=items.reverse();}res.json({success:true,items})}catch(e){res.status(500).json({success:false,message:e.message})}}
