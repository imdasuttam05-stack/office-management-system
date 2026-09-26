import AccountsMaster from "../models/AccountsMaster.js";

export const ALLOWED_MASTER_TYPES = new Set([
  "LEDGER", "GROUP", "PARTY", "SUPPLIER", "PRODUCT", "LOCATION"
]);

export function cleanMasterType(value) {
  const t = String(value || "").trim().toUpperCase();
  return ALLOWED_MASTER_TYPES.has(t) ? t : null;
}

export function normalizeMasterBody(body = {}) {
  const out = { ...body };
  out.masterType = cleanMasterType(body.masterType);
  out.name = String(body.name || "").trim();
  if (out.gstin) out.gstin = String(out.gstin).trim().toUpperCase();
  if (out.pan) out.pan = String(out.pan).trim().toUpperCase();
  if (out.pin) out.pin = String(out.pin).replace(/\D/g, "").slice(0, 6);

  for (const key of [
    "openingBalance", "creditLimit", "creditDays", "gstRate",
    "purchaseRate", "salesRate", "openingQty", "openingValue"
  ]) {
    if (out[key] !== undefined) out[key] = Number(out[key] || 0);
  }
  return out;
}

export async function getMasterLookups() {
  const [groups, locations, ledgers] = await Promise.all([
    AccountsMaster.find({ masterType: "GROUP", active: true }).sort({ name: 1 }).lean(),
    AccountsMaster.find({ masterType: "LOCATION", active: true }).sort({ name: 1 }).lean(),
    AccountsMaster.find({ masterType: "LEDGER", active: true }).sort({ name: 1 }).lean(),
  ]);
  return { groups, locations, ledgers };
}

export async function listMasters(masterType) {
  const rows = await AccountsMaster.find({ masterType, active: true })
    .sort({ name: 1 }).lean();
  const { groups, locations, ledgers } = await getMasterLookups();
  const locationMap = new Map(locations.map(x => [String(x._id), x.name]));
  rows.forEach(x => {
    if (x.locationId) x.locationName = locationMap.get(String(x.locationId)) || "";
  });
  return { rows, groups, locations, ledgers };
}

export async function createMaster(input) {
  const body = normalizeMasterBody(input);
  if (!body.masterType || !body.name) {
    const error = new Error("Master type and name are required.");
    error.status = 400;
    throw error;
  }

  if (body.masterType === "LOCATION" && !String(body.state || "").trim()) {
    const error = new Error("State is required for Location.");
    error.status = 400;
    throw error;
  }

  if (body.masterType === "PARTY" && !body.under) body.under = "Sundry Debtors";
  if (body.masterType === "SUPPLIER" && !body.under) body.under = "Sundry Creditors";
  if (body.masterType === "PRODUCT" && !body.under) body.under = "Stock-in-Hand";

  if (body.masterType === "PRODUCT" && !body.stockLedgerId) {
    const ledger = await AccountsMaster.create({
      masterType: "LEDGER",
      name: `${body.name} - Stock`,
      under: "Stock-in-Hand",
      openingBalance: Number(body.openingValue || 0),
      openingType: "Dr"
    });
    body.stockLedgerId = ledger._id;
  }

  if ((body.masterType === "PARTY" || body.masterType === "SUPPLIER") && !body.ledgerId) {
    const under = body.masterType === "PARTY" ? "Sundry Debtors" : "Sundry Creditors";
    const ledger = await AccountsMaster.create({
      masterType: "LEDGER",
      name: body.name,
      under,
      gstApplicable: Boolean(body.gstin),
      gstin: body.gstin || "",
      pan: body.pan || "",
      address: body.address || "",
      state: body.state || "",
      pin: body.pin || "",
      mobile: body.mobile || "",
      email: body.email || "",
      creditLimit: Number(body.creditLimit || 0),
      creditDays: Number(body.creditDays || 0),
      locationId: body.locationId || null
    });
    body.ledgerId = ledger._id;
  }

  return AccountsMaster.create(body);
}

export async function updateMaster(id, input) {
  const body = normalizeMasterBody(input);
  delete body.masterType;
  const row = await AccountsMaster.findByIdAndUpdate(
    id, body, { new: true, runValidators: true }
  );
  if (!row) {
    const error = new Error("Master not found.");
    error.status = 404;
    throw error;
  }
  return row;
}

export async function deactivateMaster(id) {
  const row = await AccountsMaster.findByIdAndUpdate(
    id, { active: false }, { new: true }
  );
  if (!row) {
    const error = new Error("Master not found.");
    error.status = 404;
    throw error;
  }
  return row;
}
