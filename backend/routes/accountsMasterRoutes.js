import express from "express";
import AccountsMaster from "../models/AccountsMaster.js";

const router = express.Router();

const allowed = new Set(["LEDGER","GROUP","PARTY","SUPPLIER","PRODUCT","LOCATION"]);

function cleanType(value) {
  const t = String(value || "").trim().toUpperCase();
  return allowed.has(t) ? t : null;
}

function normalizeBody(body = {}) {
  const out = {...body};
  out.masterType = cleanType(body.masterType);
  out.name = String(body.name || "").trim();
  if (out.gstin) out.gstin = String(out.gstin).trim().toUpperCase();
  if (out.pan) out.pan = String(out.pan).trim().toUpperCase();
  if (out.pin) out.pin = String(out.pin).replace(/\D/g, "").slice(0, 6);
  if (out.openingBalance !== undefined) out.openingBalance = Number(out.openingBalance || 0);
  if (out.creditLimit !== undefined) out.creditLimit = Number(out.creditLimit || 0);
  if (out.creditDays !== undefined) out.creditDays = Number(out.creditDays || 0);
  if (out.gstRate !== undefined) out.gstRate = Number(out.gstRate || 0);
  if (out.purchaseRate !== undefined) out.purchaseRate = Number(out.purchaseRate || 0);
  if (out.salesRate !== undefined) out.salesRate = Number(out.salesRate || 0);
  if (out.openingQty !== undefined) out.openingQty = Number(out.openingQty || 0);
  if (out.openingValue !== undefined) out.openingValue = Number(out.openingValue || 0);
  return out;
}

router.get("/lookups", async (req,res) => {
  try {
    const [groups, locations, ledgers] = await Promise.all([
      AccountsMaster.find({masterType:"GROUP", active:true}).sort({name:1}).lean(),
      AccountsMaster.find({masterType:"LOCATION", active:true}).sort({name:1}).lean(),
      AccountsMaster.find({masterType:"LEDGER", active:true}).sort({name:1}).lean(),
    ]);
    res.json({groups, locations, ledgers});
  } catch (e) {
    res.status(500).json({message:e.message});
  }
});

router.get("/", async (req,res) => {
  try {
    const type = cleanType(req.query.type);
    if (!type) return res.status(400).json({message:"Invalid master type."});
    const rows = await AccountsMaster.find({masterType:type, active:true}).sort({name:1}).lean();
    const [groups, locations, ledgers] = await Promise.all([
      AccountsMaster.find({masterType:"GROUP", active:true}).sort({name:1}).lean(),
      AccountsMaster.find({masterType:"LOCATION", active:true}).sort({name:1}).lean(),
      AccountsMaster.find({masterType:"LEDGER", active:true}).sort({name:1}).lean(),
    ]);
    const locationMap = new Map(locations.map(x=>[String(x._id),x.name]));
    rows.forEach(x=>{ if(x.locationId) x.locationName = locationMap.get(String(x.locationId)) || ""; });
    res.json({rows,groups,locations,ledgers});
  } catch (e) {
    res.status(500).json({message:e.message});
  }
});

router.post("/", async (req,res) => {
  try {
    const body = normalizeBody(req.body);
    if (!body.masterType || !body.name) return res.status(400).json({message:"Master type and name are required."});

    if (body.masterType === "LOCATION" && !String(body.state || "").trim()) {
      return res.status(400).json({message:"State is required for Location."});
    }

    // Tally-style automatic group assignment for party/supplier.
    if (body.masterType === "PARTY" && !body.under) body.under = "Sundry Debtors";
    if (body.masterType === "SUPPLIER" && !body.under) body.under = "Sundry Creditors";
    if (body.masterType === "PRODUCT" && !body.under) body.under = "Stock-in-Hand";

    // Product always has an accounting/stock ledger linkage target.
    if (body.masterType === "PRODUCT" && !body.stockLedgerId) {
      const ledger = await AccountsMaster.create({
        masterType:"LEDGER",
        name:`${body.name} - Stock`,
        under:"Stock-in-Hand",
        openingBalance:Number(body.openingValue || 0),
        openingType:"Dr"
      });
      body.stockLedgerId = ledger._id;
    }

    // Customer/Supplier gets an automatic ledger if none is linked.
    if ((body.masterType === "PARTY" || body.masterType === "SUPPLIER") && !body.ledgerId) {
      const under = body.masterType === "PARTY" ? "Sundry Debtors" : "Sundry Creditors";
      const ledger = await AccountsMaster.create({
        masterType:"LEDGER",
        name:body.name,
        under,
        gstApplicable:Boolean(body.gstin),
        gstin:body.gstin || "",
        pan:body.pan || "",
        address:body.address || "",
        state:body.state || "",
        pin:body.pin || "",
        mobile:body.mobile || "",
        email:body.email || "",
        creditLimit:Number(body.creditLimit || 0),
        creditDays:Number(body.creditDays || 0),
        locationId:body.locationId || null
      });
      body.ledgerId = ledger._id;
    }

    const row = await AccountsMaster.create(body);
    res.status(201).json({message:"Master created successfully.", row});
  } catch (e) {
    res.status(500).json({message:e.message});
  }
});

router.put("/:id", async (req,res) => {
  try {
    const body = normalizeBody(req.body);
    delete body.masterType;
    const row = await AccountsMaster.findByIdAndUpdate(req.params.id, body, {new:true, runValidators:true});
    if (!row) return res.status(404).json({message:"Master not found."});
    res.json({message:"Master updated successfully.", row});
  } catch (e) {
    res.status(500).json({message:e.message});
  }
});

router.delete("/:id", async (req,res) => {
  try {
    const row = await AccountsMaster.findByIdAndUpdate(req.params.id, {active:false}, {new:true});
    if (!row) return res.status(404).json({message:"Master not found."});
    res.json({message:"Master deleted successfully."});
  } catch (e) {
    res.status(500).json({message:e.message});
  }
});

export default router;
