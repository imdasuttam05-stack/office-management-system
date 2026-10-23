import AccountsMaster from "../models/AccountsMaster.js";
import Group from "../models/Group.js";
import Ledger from "../models/Ledger.js";
import CustomerMaster from "../models/CustomerMaster.js";
import SupplierMaster from "../models/SupplierMaster.js";
import UnitMaster from "../models/UnitMaster.js";
import LocationMaster from "../models/LocationMaster.js";
import InventoryItemMaster from "../models/InventoryItemMaster.js";
import InventoryStock from "../models/InventoryStock.js";
import InventoryMovement from "../models/InventoryMovement.js";

const clean = (v) => String(v ?? "").trim();
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const packageWeightKg = name => {
  const match=clean(name).match(/(\d+(?:\.\d+)?)\s*(mg|g|gm|grams?|kg|kgs|kilograms?)\b/i);
  if(!match)return 0;
  const amount=Number(match[1]);
  return /^mg$/i.test(match[2])?amount/1000000:/^kg/i.test(match[2])?amount:amount/1000;
};
const objectIdOrNull = (v) => {
  const value = clean(v);
  return /^[a-fA-F0-9]{24}$/.test(value) ? value : null;
};
const activeFilter = {$or:[{active:true},{active:{$exists:false}}]};

function requireContext(ctx={}) {
  if (!ctx.user?._id) throw new Error("Authentication is required for master changes.");
  return ctx;
}

async function resolveProductStockLocation(master, companyId) {
  const accountLocation=master.locationId
    ? await AccountsMaster.findOne({_id:master.locationId,masterType:"location"}).select("name").lean()
    : null;
  return accountLocation
    ? LocationMaster.findOne({companyId,name:accountLocation.name}).select("_id name").lean()
    : null;
}

export async function ensureProductOpeningStock(master, ctx={}, {requireLocation=false}={}) {
  const openingQty=num(master.openingQty);
  if(openingQty<0)throw new Error("Opening quantity cannot be negative.");
  const {user}=requireContext(ctx);
  const companyId=user.companyId||null;
  const sourceNo=`PRODUCT-${master._id}`;
  const existing=await InventoryMovement.findOne({companyId,sourceType:"OPENING_STOCK",sourceNo}).lean();
  if(openingQty===0&&!existing)return;
  const location=openingQty>0?await resolveProductStockLocation(master,companyId):null;
  if(openingQty>0&&!location){
    if(requireLocation)throw new Error("Select a valid Location for the product opening stock.");
    return;
  }
  let openingDate=null;
  if(openingQty>0){
    const financialYear=clean(ctx.financialYear||user.financialYear);
    const financialYearMatch=/^(\d{4})-(\d{2})$/.exec(financialYear);
    if(!financialYearMatch||Number(financialYearMatch[2])!==(Number(financialYearMatch[1])+1)%100){
      throw new Error("A valid financial year is required to date product opening stock.");
    }
    openingDate=new Date(Date.UTC(Number(financialYearMatch[1]),3,1));
  }
  const itemType=["RAW_MATERIAL","GRADE","FINISHED_GOODS","PACKED_GOODS","RETURN_GOODS","REJECTED"].includes(master.itemType)?master.itemType:"RAW_MATERIAL";
  const itemName=clean(master.name),unit=clean(master.unit)||"KG",hsn=clean(master.hsn),packetWeight=packageWeightKg(itemName);
  const stockQty=packetWeight>0?openingQty*packetWeight:openingQty,stockUnit=packetWeight>0?"KG":unit;
  const openingValue=num(master.openingValue),target=openingQty>0?{companyId,location:String(location._id),itemType,itemName,unit:stockUnit,hsn,qty:stockQty,value:openingValue}:null;
  const previous=existing?{companyId:existing.companyId||null,location:existing.location,itemType:existing.itemType,itemName:existing.itemName,unit:existing.unit||"KG",hsn:"",qty:num(existing.qtyIn)-num(existing.qtyOut),value:num(existing.valueIn)-num(existing.valueOut)}:null;
  const stockKey=row=>[String(row.companyId||""),row.location,row.itemType,row.itemName,"",""].join("|");
  const stockUpdates=new Map();
  for(const row of [previous,target].filter(Boolean)){
    const key=stockKey(row),update=stockUpdates.get(key)||{row,qtyDelta:0,valueDelta:0};
    const sign=row===target?1:-1;
    update.qtyDelta+=sign*row.qty;update.valueDelta+=sign*row.value;
    if(row===target)update.row=row;
    stockUpdates.set(key,update);
  }
  const stockPlans=[];
  for(const [key,update] of stockUpdates){
    const {row,qtyDelta,valueDelta}=update;
    const filter={companyId:row.companyId||null,location:row.location,itemType:row.itemType,itemName:row.itemName,batchNo:"",barcode:""};
    const stock=await InventoryStock.findOne(filter).select("qty stockValue").lean();
    const nextQty=num(stock?.qty)+qtyDelta,nextValue=num(stock?.stockValue)+valueDelta;
    if(nextQty< -0.000001)throw new Error(`Opening quantity cannot be reduced because ${row.itemName} stock has already been consumed.`);
    if(nextValue< -0.01)throw new Error(`Opening value cannot be reduced below the remaining stock value for ${row.itemName}.`);
    const safeQty=Math.max(0,nextQty),safeValue=Math.max(0,nextValue);
    stockPlans.push({key,row,filter,safeQty,safeValue});
  }
  const nextStockByKey=new Map();
  for(const {key,row,filter,safeQty,safeValue} of stockPlans){
    await InventoryStock.findOneAndUpdate(filter,{$set:{qty:safeQty,stockValue:safeValue,averageRate:safeQty?safeValue/safeQty:0,...(row===target?{unit:stockUnit,hsn}:{})},$setOnInsert:{companyId:row.companyId||null,location:row.location,itemType:row.itemType,itemName:row.itemName,batchNo:"",barcode:""}},{upsert:true,new:true,setDefaultsOnInsert:true});
    nextStockByKey.set(key,safeQty);
  }
  if(!target){
    if(existing)await InventoryMovement.deleteOne({_id:existing._id});
    return;
  }
  const targetBalance=nextStockByKey.get(stockKey(target))||0;
  const movementData={companyId,date:openingDate,location:target.location,itemName,itemType,unit:stockUnit,qtyIn:stockQty,qtyOut:0,valueIn:openingValue,valueOut:0,balanceQty:targetBalance,sourceType:"OPENING_STOCK",sourceNo,referenceNo:clean(master.code)||itemName,narration:`Opening stock for ${itemName}`,createdBy:existing?.createdBy||user._id};
  if(existing)await InventoryMovement.findByIdAndUpdate(existing._id,{$set:movementData});
  else{
    try{await InventoryMovement.create(movementData)}
    catch(error){if(error?.code!==11000)throw error}
  }
}

function inferNature(name, fallback="Asset") {
  const s = clean(name).toLowerCase();
  if (s.includes("income")) return "Income";
  if (s.includes("expense") || s.includes("purchase")) return "Expense";
  if (s.includes("creditor") || s.includes("liabil")) return "Liability";
  if (s.includes("capital")) return "Capital";
  return fallback;
}

async function ensureRealGroup(name, nature, userId, parentName = "") {
  const groupName = clean(name) || "Current Assets";
  const parentLabel = clean(parentName).toLowerCase() === "primary" ? "" : clean(parentName);
  const parent = parentLabel ? await Group.findOne({name:parentLabel}) : null;
  if (parentLabel && !parent) throw new Error(`Parent group ${parentLabel} not found.`);
  const parentId = parent?._id || null;
  let row = await Group.findOne({name:groupName,parent:parentId});
  if (!row && !parentId) row = await Group.findOne({name:groupName});
  const sharedGroupFilter = {
    name:groupName,
    parent:null,
    isActive:{$ne:false},
    $or:[{companyId:null},{companyId:{$exists:false}}],
  };
  if (!row) row = await Group.collection.findOne(sharedGroupFilter);
  if (!row) {
    try {
      row = await Group.create({name:groupName,parent:parentId,nature:inferNature(groupName,nature),isSystem:false});
    } catch (error) {
      if (error?.code !== 11000) throw error;
      row = await Group.findOne({name:groupName,parent:parentId});
      if (!row && !parentId) row = await Group.findOne({name:groupName});
      if (!row && !parentId) row = await Group.collection.findOne(sharedGroupFilter);
      if (!row) throw error;
    }
  }
  return row;
}

async function ensureRealLedger(name, {under,nature,openingBalance,openingType,gstApplicable,gstin,pan,address,state,district,pin,mobile,email,creditLimit,creditDays,locationId,gstStateCode,bankDetailsProvided,bankAccountName,bankName,bankBranch,bankAccountNumber,bankIfsc,userId}={}) {
  const ledgerName = clean(name);
  if (!ledgerName) return null;
  const group = await ensureRealGroup(under || "Current Assets", nature || "Asset", userId);
  let row = await Ledger.findOne({name:ledgerName,group:group._id});
  const payload = {
    name:ledgerName,
    group:group._id,
    openingBalance:num(openingBalance),
    openingType:openingType === "Cr" ? "Cr" : "Dr",
    gstApplicable:!!gstApplicable,
    gstin:clean(gstin).toUpperCase(),
    pan:clean(pan).toUpperCase(),
    address:clean(address),
    state:clean(state),
    district:clean(district),
    pin:clean(pin),
    phone:clean(mobile),
    email:clean(email),
    creditLimit:num(creditLimit),
    creditDays:num(creditDays),
    locationId:objectIdOrNull(locationId),
    gstStateCode:clean(gstStateCode),
    bankDetailsProvided:!!bankDetailsProvided,
    bankAccountName:clean(bankAccountName),
    bankName:clean(bankName),
    bankBranch:clean(bankBranch),
    bankAccountNumber:clean(bankAccountNumber),
    bankIfsc:clean(bankIfsc).toUpperCase(),
    isActive:true,
  };
  if (!row) row = await Ledger.create({...payload,createdBy:userId});
  else await Ledger.findByIdAndUpdate(row._id,{$set:payload});
  return row;
}

export async function syncLedgerCounterparty(master, ledger, ctx={}) {
  const under = clean(master.under).toLowerCase();
  if (under !== "sundry debtors" && under !== "sundry creditors") return;
  const {user}=requireContext(ctx);
  const companyId=user.companyId || null;
  const counterparty = {
    gstin:clean(master.gstin).toUpperCase(),
    state:clean(master.state),
    district:clean(master.district),
    pin:clean(master.pin),
    phone:clean(master.mobile || master.phone),
    address:clean(master.address),
    ledgerId:ledger?._id || null,
    active:true,
    createdBy:user._id,
  };
  const Model = under === "sundry debtors" ? CustomerMaster : SupplierMaster;
  await Model.findOneAndUpdate(
    {companyId,name:clean(master.name)},
    {$set:counterparty,$setOnInsert:{companyId,name:clean(master.name)}},
    {upsert:true,new:true,setDefaultsOnInsert:true}
  );
}

async function syncTransactionMaster(master, ctx, previousName = "") {
  const {user}=requireContext(ctx);
  const companyId=user.companyId || null;
  const createdBy=user._id;

  if (master.masterType === "group") {
    await ensureRealGroup(master.name, master.nature || "Liability", createdBy, master.under);
    return;
  }

  if (master.masterType === "ledger") {
    const ledger = await ensureRealLedger(master.name, {
      under:master.under,
      nature:master.nature,
      openingBalance:master.openingBalance,
      openingType:master.openingType,
      gstApplicable:master.gstApplicable,
      gstin:master.gstin,
      pan:master.pan,
      address:master.address,
      state:master.state,
      district:master.district,
      pin:master.pin,
      mobile:master.mobile,
      email:master.email,
      creditLimit:master.creditLimit,
      creditDays:master.creditDays,
      locationId:master.locationId,
      gstStateCode:master.gstStateCode,
      bankDetailsProvided:master.bankDetailsProvided,
      bankAccountName:master.bankAccountName,
      bankName:master.bankName,
      bankBranch:master.bankBranch,
      bankAccountNumber:master.bankAccountNumber,
      bankIfsc:master.bankIfsc,
      userId:createdBy,
    });
    await syncLedgerCounterparty(master, ledger, ctx);
    return;
  }

  if (master.masterType === "supplier") {
    const ledger = await ensureRealLedger(master.name, {under:"Sundry Creditors",nature:"Liability",openingBalance:master.openingBalance,openingType:master.openingType,gstin:master.gstin,pan:master.pan,address:master.address,mobile:master.mobile,userId:createdBy});
    const filter = {companyId,name:master.name};
    await SupplierMaster.findOneAndUpdate(filter,{$set:{
      gstin:clean(master.gstin).toUpperCase(),state:clean(master.state),district:clean(master.district),pin:clean(master.pin),phone:clean(master.mobile),address:clean(master.address),ledgerId:ledger?._id||null,active:true,createdBy,
    },$setOnInsert:{companyId,name:master.name}},{upsert:true,new:true,setDefaultsOnInsert:true});
    return;
  }

  if (master.masterType === "party") {
    const ledger = await ensureRealLedger(master.name, {under:"Sundry Debtors",nature:"Asset",openingBalance:master.openingBalance,openingType:master.openingType,gstin:master.gstin,pan:master.pan,address:master.address,mobile:master.mobile,userId:createdBy});
    const filter = {companyId,name:master.name};
    await CustomerMaster.findOneAndUpdate(filter,{$set:{
      gstin:clean(master.gstin).toUpperCase(),state:clean(master.state),district:clean(master.district),pin:clean(master.pin),phone:clean(master.mobile),address:clean(master.address),ledgerId:ledger?._id||null,active:true,createdBy,
    },$setOnInsert:{companyId,name:master.name}},{upsert:true,new:true,setDefaultsOnInsert:true});
    return;
  }

  if (master.masterType === "product") {
    const itemType=["RAW_MATERIAL","GRADE","FINISHED_GOODS","PACKED_GOODS","RETURN_GOODS","REJECTED"].includes(master.itemType)?master.itemType:"RAW_MATERIAL";
    const oldName=clean(previousName);
    if(oldName && oldName!==master.name){
      const oldItems=await InventoryItemMaster.find({companyId,name:oldName}).select("_id").lean();
      const renamedItem=await InventoryItemMaster.findOne({companyId,name:master.name,itemType});
      const values={itemType,hsn:clean(master.hsn),unit:clean(master.unit)||"KG",defaultGstRate:num(master.gstRate),defaultBarcode:clean(master.code),active:true};
      if(oldItems.length){
        await InventoryItemMaster.updateMany({companyId,name:oldName},{$set:{active:false}});
      }
      if(renamedItem){
        await InventoryItemMaster.findByIdAndUpdate(renamedItem._id,{$set:values});
        await ensureProductOpeningStock(master,ctx,{requireLocation:true});
        return;
      }
      if(oldItems.length){
        await InventoryItemMaster.findOneAndUpdate({companyId,name:master.name},{$set:values,$setOnInsert:{companyId,name:master.name,createdBy}},{upsert:true,new:true,setDefaultsOnInsert:true});
        await ensureProductOpeningStock(master,ctx,{requireLocation:true});
        return;
      }
    }
    await InventoryItemMaster.findOneAndUpdate({companyId,name:master.name},{$set:{itemType,hsn:clean(master.hsn),unit:clean(master.unit)||"KG",defaultGstRate:num(master.gstRate),defaultBarcode:clean(master.code),active:true},$setOnInsert:{companyId,name:master.name,createdBy}},{upsert:true,new:true,setDefaultsOnInsert:true});
    await ensureProductOpeningStock(master,ctx,{requireLocation:true});
    return;
  }

  if (master.masterType === "location") {
    const code = clean(master.code).toUpperCase() || clean(master.name).toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30) || "LOCATION";
    await LocationMaster.findOneAndUpdate({companyId,name:master.name},{$set:{code,pin:clean(master.pin)||null,state:clean(master.state),district:clean(master.district),address:clean(master.address),active:true,createdBy},$setOnInsert:{companyId,name:master.name}},{upsert:true,new:true,setDefaultsOnInsert:true});
    return;
  }

  if (master.masterType === "unit") {
    await UnitMaster.findOneAndUpdate(
      {companyId,name:master.name},
      {$set:{code:clean(master.code).toUpperCase(),decimalPlaces:master.decimalPlaces,active:true,createdBy},$setOnInsert:{companyId,name:master.name}},
      {upsert:true,new:true,setDefaultsOnInsert:true}
    );
  }
}

export async function listMasters(masterType) {
  const filter = masterType ? { masterType, active: true } : { active: true };
  const rows = await AccountsMaster.find(filter).sort({ name: 1 }).lean();
  if (masterType !== "ledger") return rows;

  const ledgerNames = new Set(rows.map(row => clean(row.name).toLowerCase()));
  const suppliers = await AccountsMaster.find({masterType:"supplier",active:true}).sort({name:1}).lean();
  return [...rows,...suppliers.filter(row => !ledgerNames.has(clean(row.name).toLowerCase()))]
    .sort((left,right) => clean(left.name).localeCompare(clean(right.name)));
}

export async function getMaster(id) {
  return AccountsMaster.findById(id).lean();
}

export async function createMaster(payload = {}, ctx = {}) {
  requireContext(ctx);
  const masterType = clean(payload.masterType).toLowerCase();
  if (!["group", "ledger", "party", "supplier", "product", "location", "unit"].includes(masterType)) throw new Error("Invalid master type.");
  const name = clean(payload.name);
  if (!name) throw new Error("Name is required.");

  const data = {
    ...payload,
    masterType,
    ledgerId: objectIdOrNull(payload.ledgerId),
    locationId: objectIdOrNull(payload.locationId),
    stockLedgerId: objectIdOrNull(payload.stockLedgerId),
    name,
    alias: clean(payload.alias), code: clean(payload.code), under: clean(payload.under),
    state: clean(payload.state), district: clean(payload.district), pin: clean(payload.pin), address: clean(payload.address),
    mobile: clean(payload.mobile), email: clean(payload.email), gstin: clean(payload.gstin).toUpperCase(), pan: clean(payload.pan).toUpperCase(),
    openingBalance: num(payload.openingBalance), decimalPlaces: Math.max(0, Math.min(6, Number.isFinite(Number(payload.decimalPlaces)) ? Number(payload.decimalPlaces) : 2)), creditLimit: num(payload.creditLimit), creditDays: num(payload.creditDays),
    gstRate: num(payload.gstRate), purchaseRate: num(payload.purchaseRate), salesRate: num(payload.salesRate), openingQty: num(payload.openingQty), openingRate: num(payload.openingRate), openingValue: payload.openingRate!==undefined&&payload.openingRate!==""?num(payload.openingQty)*num(payload.openingRate):num(payload.openingValue),
    active:true,
  };
  if(masterType==="product"&&num(data.openingQty)>0&&!data.locationId){
    throw new Error("Select a Location for the product opening stock.");
  }
  if(masterType==="product"&&num(data.openingQty)>0&&!await resolveProductStockLocation(data,ctx.user?.companyId||null)){
    throw new Error("The selected Location was not found in inventory masters.");
  }
  if (masterType === "party") { data.under=data.under||"Sundry Debtors"; data.partyType=data.partyType||"CUSTOMER"; data.nature=data.nature||"Current Assets"; }
  if (masterType === "supplier") { data.under=data.under||"Sundry Creditors"; data.partyType=data.partyType||"SUPPLIER"; data.nature=data.nature||"Current Liabilities"; }
  if (masterType === "product") { data.under=data.under||"Stock-in-Hand"; data.itemType=data.itemType||"RAW_MATERIAL"; data.unit=data.unit||"KG"; }
  if (masterType === "unit") {
    data.code=clean(payload.code).toUpperCase().replace(/\s+/g,"_");
    if (!data.code) throw Object.assign(new Error("Unit name and unit code are required."),{code:"UNIT_VALIDATION"});
    const companyId=ctx.user?.companyId||null;
    const [accountUnit,inventoryUnit]=await Promise.all([
      AccountsMaster.findOne({masterType:"unit",name}),
      UnitMaster.findOne({companyId,$or:[{name},{code:data.code}]}),
    ]);
    if (accountUnit) throw Object.assign(new Error("A Unit with this name already exists."),{code:"UNIT_DUPLICATE"});
    if (inventoryUnit && (inventoryUnit.name!==name || inventoryUnit.code!==data.code)) {
      throw Object.assign(new Error("A Unit with this name or code already exists. Use its existing name and code."),{code:"UNIT_DUPLICATE"});
    }
  }
  if (masterType === "location") {
    data.code=data.code||name.toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30)||"LOCATION";
    if (data.pin && !/^\d{6}$/.test(data.pin)) throw new Error("PIN must be exactly 6 digits.");
  }
  if (masterType === "unit") { data.code=data.code||name.toUpperCase().replace(/\s+/g,"_"); data.decimalPlaces=Math.max(0, Math.min(6, Number(data.decimalPlaces ?? 2))); }

  const created = await AccountsMaster.create(data);
  try {
    await syncTransactionMaster(created.toObject(), ctx);
  } catch (error) {
    if (masterType === "unit") {
      await AccountsMaster.deleteOne({_id:created._id});
      if (error?.code === 11000) {
        throw Object.assign(new Error("A Unit with this name or code already exists. Use its existing name and code."),{code:"UNIT_DUPLICATE"});
      }
    }
    throw error;
  }
  return created.toObject();
}

export async function updateMaster(id, payload = {}, ctx = {}) {
  requireContext(ctx);
  const existing = await AccountsMaster.findById(id);
  if (!existing) throw new Error("Master not found.");
  const previousName=existing.name;
  const allowed=["name","alias","code","under","nature","openingBalance","openingType","gstApplicable","gstin","pan","address","state","district","pin","mobile","email","creditLimit","creditDays","bankDetailsProvided","bankAccountName","bankName","bankBranch","bankAccountNumber","bankIfsc","partyType","locationId","locationName","itemType","hsn","unit","gstRate","purchaseRate","salesRate","openingQty","openingRate","openingValue","decimalPlaces","gstStateCode","active"];
  for (const key of allowed) if (payload[key] !== undefined) existing[key]=payload[key];
  if(existing.masterType==="product"&&num(existing.openingQty)>0&&!existing.locationId){
    throw new Error("Select a Location for the product opening stock.");
  }
  if(existing.masterType==="product"&&num(existing.openingQty)>0&&!await resolveProductStockLocation(existing,ctx.user?.companyId||null)){
    throw new Error("The selected Location was not found in inventory masters.");
  }
  if(existing.masterType==="product"&&payload.openingRate!==undefined){
    existing.openingRate=num(payload.openingRate);
  }
  if(existing.masterType==="product"&&(payload.openingQty!==undefined||payload.openingRate!==undefined||payload.openingValue!==undefined)){
    if(payload.openingValue!==undefined&&payload.openingRate===undefined&&num(existing.openingQty)>0)existing.openingRate=num(payload.openingValue)/num(existing.openingQty);
    existing.openingValue=num(existing.openingQty)*num(existing.openingRate);
  }
  existing.name=clean(existing.name); existing.gstin=clean(existing.gstin).toUpperCase(); existing.pan=clean(existing.pan).toUpperCase();
  if (existing.masterType==="location") {
    existing.code=clean(existing.code).toUpperCase()||existing.name.toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30)||"LOCATION";
    if (clean(existing.pin) && !/^\d{6}$/.test(clean(existing.pin))) throw new Error("PIN must be exactly 6 digits.");
  }
  if(existing.masterType==="product")await ensureProductOpeningStock(existing.toObject(),ctx,{requireLocation:true});
  await existing.save();
  await syncTransactionMaster(existing.toObject(), ctx, previousName);
  return existing.toObject();
}

export async function deleteMaster(id, ctx = {}) {
  requireContext(ctx);
  const existing = await AccountsMaster.findById(id);
  if (!existing) throw new Error("Master not found.");
  existing.active=false; await existing.save();
  const companyId=ctx.user?.companyId||null;
  if (existing.masterType==="unit") { /* Unit is stored in AccountsMaster; no secondary model is required. */ }
  if (existing.masterType==="product") await InventoryItemMaster.findOneAndUpdate({companyId,name:existing.name},{$set:{active:false}});
  if (existing.masterType==="supplier") await SupplierMaster.findOneAndUpdate({companyId,name:existing.name},{$set:{active:false}});
  if (existing.masterType==="party") await CustomerMaster.findOneAndUpdate({companyId,name:existing.name},{$set:{active:false}});
  if (existing.masterType==="unit") await UnitMaster.findOneAndUpdate({companyId,name:existing.name},{$set:{active:false}});
  if (existing.masterType==="location") await LocationMaster.findOneAndUpdate({companyId,name:existing.name},{$set:{active:false}});
  if (existing.masterType==="ledger") await Ledger.updateMany({name:existing.name},{$set:{isActive:false}});
  if (existing.masterType==="group") await Group.updateMany({name:existing.name},{$set:{isActive:false}});
  return existing.toObject();
}
