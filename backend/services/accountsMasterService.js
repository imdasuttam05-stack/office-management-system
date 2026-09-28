import AccountsMaster from "../models/AccountsMaster.js";

const clean = (v) => String(v ?? "").trim();
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const objectIdOrNull = (v) => {
  const value = clean(v);
  return /^[a-fA-F0-9]{24}$/.test(value) ? value : null;
};

export async function listMasters(masterType) {
  const filter = masterType ? { masterType, active: true } : { active: true };
  return AccountsMaster.find(filter).sort({ name: 1 }).lean();
}

export async function getMaster(id) {
  return AccountsMaster.findById(id).lean();
}

export async function createMaster(payload = {}) {
  const masterType = clean(payload.masterType).toLowerCase();
  if (!["group", "ledger", "party", "supplier", "product", "location"].includes(masterType)) {
    throw new Error("Invalid master type.");
  }
  const name = clean(payload.name);
  if (!name) throw new Error("Name is required.");

  const data = {
    ...payload,
    masterType,
    ledgerId: objectIdOrNull(payload.ledgerId),
    locationId: objectIdOrNull(payload.locationId),
    stockLedgerId: objectIdOrNull(payload.stockLedgerId),
    name,
    alias: clean(payload.alias),
    code: clean(payload.code),
    under: clean(payload.under),
    state: clean(payload.state),
    district: clean(payload.district),
    pin: clean(payload.pin),
    address: clean(payload.address),
    mobile: clean(payload.mobile),
    email: clean(payload.email),
    gstin: clean(payload.gstin).toUpperCase(),
    pan: clean(payload.pan).toUpperCase(),
    openingBalance: num(payload.openingBalance),
    creditLimit: num(payload.creditLimit),
    creditDays: num(payload.creditDays),
    gstRate: num(payload.gstRate),
    purchaseRate: num(payload.purchaseRate),
    salesRate: num(payload.salesRate),
    openingQty: num(payload.openingQty),
    openingValue: num(payload.openingValue),
  };

  if (masterType === "party") {
    data.under = data.under || "Sundry Debtors";
    data.partyType = data.partyType || "CUSTOMER";
    data.nature = data.nature || "Current Assets";
  }
  if (masterType === "supplier") {
    data.under = data.under || "Sundry Creditors";
    data.partyType = data.partyType || "SUPPLIER";
    data.nature = data.nature || "Current Liabilities";
  }
  if (masterType === "product") {
    data.under = data.under || "Stock-in-Hand";
    data.itemType = data.itemType || "RAW_MATERIAL";
    data.unit = data.unit || "KG";
  }

  const created = await AccountsMaster.create(data);

  // Party/Supplier gets an accounting ledger automatically.
  if (["party", "supplier"].includes(masterType)) {
    const ledger = await AccountsMaster.create({
      masterType: "ledger",
      name,
      alias: data.alias,
      under: data.under,
      nature: data.nature,
      openingBalance: data.openingBalance,
      openingType: data.openingType,
      gstApplicable: data.gstApplicable,
      gstin: data.gstin,
      pan: data.pan,
      address: data.address,
      state: data.state,
      district: data.district,
      pin: data.pin,
      mobile: data.mobile,
      email: data.email,
      creditLimit: data.creditLimit,
      creditDays: data.creditDays,
      partyType: data.partyType,
      active: true,
    });
    created.ledgerId = ledger._id;
    await created.save();
  }

  // Product gets a stock ledger automatically.
  if (masterType === "product") {
    const ledger = await AccountsMaster.create({
      masterType: "ledger",
      name,
      alias: data.alias,
      under: "Stock-in-Hand",
      nature: "Current Assets",
      openingBalance: data.openingValue,
      openingType: "Dr",
      itemType: data.itemType,
      hsn: data.hsn,
      unit: data.unit,
      gstRate: data.gstRate,
      purchaseRate: data.purchaseRate,
      salesRate: data.salesRate,
      openingQty: data.openingQty,
      locationId: data.locationId || null,
      active: true,
    });
    created.stockLedgerId = ledger._id;
    await created.save();
  }

  return created.toObject();
}

export async function updateMaster(id, payload = {}) {
  const existing = await AccountsMaster.findById(id);
  if (!existing) throw new Error("Master not found.");

  const allowed = [
    "name", "alias", "code", "under", "nature", "openingBalance", "openingType",
    "gstApplicable", "gstin", "pan", "address", "state", "district", "pin", "mobile",
    "email", "creditLimit", "creditDays", "partyType", "locationId", "locationName",
    "itemType", "hsn", "unit", "gstRate", "purchaseRate", "salesRate", "openingQty",
    "openingValue", "gstStateCode", "active"
  ];
  for (const key of allowed) if (payload[key] !== undefined) existing[key] = payload[key];
  existing.name = clean(existing.name);
  existing.gstin = clean(existing.gstin).toUpperCase();
  existing.pan = clean(existing.pan).toUpperCase();
  await existing.save();
  return existing.toObject();
}

export async function deleteMaster(id) {
  const existing = await AccountsMaster.findById(id);
  if (!existing) throw new Error("Master not found.");
  existing.active = false;
  await existing.save();
  return existing.toObject();
}
