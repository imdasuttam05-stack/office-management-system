import AccountsMaster from "../models/AccountsMaster.js";
import Group from "../models/Group.js";
import Ledger from "../models/Ledger.js";
import CustomerMaster from "../models/CustomerMaster.js";
import SupplierMaster from "../models/SupplierMaster.js";
import LocationMaster from "../models/LocationMaster.js";
import InventoryItemMaster from "../models/InventoryItemMaster.js";

const clean = (v) => String(v ?? "").trim();
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const objectIdOrNull = (v) => {
  const value = clean(v);
  return /^[a-fA-F0-9]{24}$/.test(value) ? value : null;
};
const activeFilter = {$or:[{active:true},{active:{$exists:false}}]};

function requireContext(ctx={}) {
  if (!ctx.user?._id) throw new Error("Authentication is required for master changes.");
  return ctx;
}

function inferNature(name, fallback="Asset") {
  const s = clean(name).toLowerCase();
  if (s.includes("income")) return "Income";
  if (s.includes("expense") || s.includes("purchase")) return "Expense";
  if (s.includes("creditor") || s.includes("liabil")) return "Liability";
  if (s.includes("capital")) return "Capital";
  return fallback;
}

async function ensureRealGroup(name, nature, userId) {
  const groupName = clean(name) || "Current Assets";
  let row = await Group.findOne({name:groupName,parent:null});
  if (!row) {
    row = await Group.create({name:groupName,parent:null,nature:inferNature(groupName,nature),isSystem:false});
  }
  return row;
}

async function ensureRealLedger(name, {under,nature,openingBalance,openingType,gstin,pan,address,mobile,userId}={}) {
  const ledgerName = clean(name);
  if (!ledgerName) return null;
  const group = await ensureRealGroup(under || "Current Assets", nature || "Asset", userId);
  let row = await Ledger.findOne({name:ledgerName,group:group._id});
  const payload = {
    name:ledgerName,
    group:group._id,
    openingBalance:num(openingBalance),
    openingType:openingType === "Cr" ? "Cr" : "Dr",
    gstin:clean(gstin).toUpperCase(),
    pan:clean(pan).toUpperCase(),
    address:clean(address),
    phone:clean(mobile),
    isActive:true,
  };
  if (!row) row = await Ledger.create({...payload,createdBy:userId});
  else await Ledger.findByIdAndUpdate(row._id,{$set:payload});
  return row;
}

async function syncTransactionMaster(master, ctx) {
  const {user}=requireContext(ctx);
  const companyId=user.companyId || null;
  const createdBy=user._id;

  if (master.masterType === "group") {
    await ensureRealGroup(master.name, master.nature || "Liability", createdBy);
    return;
  }

  if (master.masterType === "ledger") {
    await ensureRealLedger(master.name, {
      under:master.under,
      nature:master.nature,
      openingBalance:master.openingBalance,
      openingType:master.openingType,
      gstin:master.gstin,
      pan:master.pan,
      address:master.address,
      mobile:master.mobile,
      userId:createdBy,
    });
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
    await InventoryItemMaster.findOneAndUpdate({companyId,name:master.name},{$set:{itemType,hsn:clean(master.hsn),unit:clean(master.unit)||"KG",defaultGstRate:num(master.gstRate),defaultBarcode:clean(master.code),active:true},$setOnInsert:{companyId,name:master.name,createdBy}},{upsert:true,new:true,setDefaultsOnInsert:true});
    return;
  }

  if (master.masterType === "location") {
    await LocationMaster.findOneAndUpdate({companyId,name:master.name},{$set:{code:clean(master.code).toUpperCase(),pin:clean(master.pin),state:clean(master.state),district:clean(master.district),address:clean(master.address),active:true,createdBy},$setOnInsert:{companyId,name:master.name}},{upsert:true,new:true,setDefaultsOnInsert:true});
  }
}

export async function listMasters(masterType) {
  const filter = masterType ? { masterType, active: true } : { active: true };
  return AccountsMaster.find(filter).sort({ name: 1 }).lean();
}

export async function getMaster(id) {
  return AccountsMaster.findById(id).lean();
}

export async function createMaster(payload = {}, ctx = {}) {
  requireContext(ctx);
  const masterType = clean(payload.masterType).toLowerCase();
  if (!["group", "ledger", "party", "supplier", "product", "location"].includes(masterType)) throw new Error("Invalid master type.");
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
    openingBalance: num(payload.openingBalance), creditLimit: num(payload.creditLimit), creditDays: num(payload.creditDays),
    gstRate: num(payload.gstRate), purchaseRate: num(payload.purchaseRate), salesRate: num(payload.salesRate), openingQty: num(payload.openingQty), openingValue: num(payload.openingValue),
    active:true,
  };
  if (masterType === "party") { data.under=data.under||"Sundry Debtors"; data.partyType=data.partyType||"CUSTOMER"; data.nature=data.nature||"Current Assets"; }
  if (masterType === "supplier") { data.under=data.under||"Sundry Creditors"; data.partyType=data.partyType||"SUPPLIER"; data.nature=data.nature||"Current Liabilities"; }
  if (masterType === "product") { data.under=data.under||"Stock-in-Hand"; data.itemType=data.itemType||"RAW_MATERIAL"; data.unit=data.unit||"KG"; }

  const created = await AccountsMaster.create(data);
  await syncTransactionMaster(created.toObject(), ctx);
  return created.toObject();
}

export async function updateMaster(id, payload = {}, ctx = {}) {
  requireContext(ctx);
  const existing = await AccountsMaster.findById(id);
  if (!existing) throw new Error("Master not found.");
  const allowed=["name","alias","code","under","nature","openingBalance","openingType","gstApplicable","gstin","pan","address","state","district","pin","mobile","email","creditLimit","creditDays","partyType","locationId","locationName","itemType","hsn","unit","gstRate","purchaseRate","salesRate","openingQty","openingValue","gstStateCode","active"];
  for (const key of allowed) if (payload[key] !== undefined) existing[key]=payload[key];
  existing.name=clean(existing.name); existing.gstin=clean(existing.gstin).toUpperCase(); existing.pan=clean(existing.pan).toUpperCase();
  await existing.save();
  await syncTransactionMaster(existing.toObject(), ctx);
  return existing.toObject();
}

export async function deleteMaster(id, ctx = {}) {
  requireContext(ctx);
  const existing = await AccountsMaster.findById(id);
  if (!existing) throw new Error("Master not found.");
  existing.active=false; await existing.save();
  const companyId=ctx.user?.companyId||null;
  if (existing.masterType==="product") await InventoryItemMaster.findOneAndUpdate({companyId,name:existing.name},{$set:{active:false}});
  if (existing.masterType==="supplier") await SupplierMaster.findOneAndUpdate({companyId,name:existing.name},{$set:{active:false}});
  if (existing.masterType==="party") await CustomerMaster.findOneAndUpdate({companyId,name:existing.name},{$set:{active:false}});
  if (existing.masterType==="location") await LocationMaster.findOneAndUpdate({companyId,name:existing.name},{$set:{active:false}});
  if (existing.masterType==="ledger") await Ledger.updateMany({name:existing.name},{$set:{isActive:false}});
  if (existing.masterType==="group") await Group.updateMany({name:existing.name},{$set:{isActive:false}});
  return existing.toObject();
}
