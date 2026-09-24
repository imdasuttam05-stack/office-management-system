import RawMaterialPurchase from "../models/RawMaterialPurchase.js";
import InventoryStock from "../models/InventoryStock.js";
import InventoryCounter from "../models/InventoryCounter.js";

function clean(v) { return String(v ?? "").trim(); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round2(v) { return Math.round((num(v) + Number.EPSILON) * 100) / 100; }
function dateOrNull(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }

async function nextPurchaseNo() {
  const year = new Date().getFullYear();
  const counter = await InventoryCounter.findOneAndUpdate(
    { key: `RAW_PURCHASE_${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `RMP-${year}-${String(counter.seq).padStart(5, "0")}`;
}

function buildLine(raw) {
  const qty = num(raw.qty);
  const rate = num(raw.purchaseRate);
  const gross = qty * rate;
  const discount = Math.min(Math.max(num(raw.discount), 0), gross);
  const taxable = round2(gross - discount);
  const gstRate = Math.max(0, Math.min(num(raw.gstRate), 100));
  const gstType = ["NONE", "CGST_SGST", "IGST"].includes(raw.gstType) ? raw.gstType : "NONE";
  const gst = gstType === "NONE" ? 0 : round2(taxable * gstRate / 100);
  const cgst = gstType === "CGST_SGST" ? round2(gst / 2) : 0;
  const sgst = gstType === "CGST_SGST" ? round2(gst - cgst) : 0;
  const igst = gstType === "IGST" ? gst : 0;
  const lineTotal = round2(taxable + cgst + sgst + igst);
  return {
    itemName: clean(raw.itemName), hsn: clean(raw.hsn), unit: clean(raw.unit) || "PCS",
    batchNo: clean(raw.batchNo), barcode: clean(raw.barcode), mfgDate: dateOrNull(raw.mfgDate), expiryDate: dateOrNull(raw.expiryDate),
    qty, purchaseRate: rate, discount: round2(discount), taxableAmount: taxable, gstRate, gstType,
    cgst, sgst, igst, lineTotal, landedCost: 0,
  };
}

export async function createRawMaterialPurchase(req, res) {
  try {
    const body = req.body || {};
    const location = clean(body.location);
    const supplierName = clean(body.supplierName);
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (!location) return res.status(400).json({ success: false, message: "Location is required." });
    if (!supplierName) return res.status(400).json({ success: false, message: "Supplier name is required." });
    if (!rawLines.length) return res.status(400).json({ success: false, message: "At least one raw material line is required." });

    const lines = rawLines.map(buildLine);
    const invalid = lines.find((x) => !x.itemName || !x.unit || x.qty <= 0 || x.purchaseRate < 0);
    if (invalid) return res.status(400).json({ success: false, message: "Each item needs item name, unit and valid quantity/rate." });

    const subtotal = round2(lines.reduce((s, x) => s + x.taxableAmount, 0));
    const totalCGST = round2(lines.reduce((s, x) => s + x.cgst, 0));
    const totalSGST = round2(lines.reduce((s, x) => s + x.sgst, 0));
    const totalIGST = round2(lines.reduce((s, x) => s + x.igst, 0));
    const transportCost = Math.max(0, num(body.transportCost));
    const otherCost = Math.max(0, num(body.otherCost));
    const grandTotal = round2(subtotal + totalCGST + totalSGST + totalIGST + transportCost + otherCost);
    const extraCost = transportCost + otherCost;
    const totalQty = lines.reduce((s, x) => s + x.qty, 0) || 1;

    for (const line of lines) {
      line.landedCost = round2(line.taxableAmount + extraCost * (line.qty / totalQty));
    }

    const purchaseNo = await nextPurchaseNo();
    const purchase = await RawMaterialPurchase.create({
      purchaseNo,
      date: dateOrNull(body.date) || new Date(),
      companyId: req.user?.companyId || null,
      location,
      supplierName,
      supplierGSTIN: clean(body.supplierGSTIN).toUpperCase(),
      supplierInvoiceNo: clean(body.supplierInvoiceNo),
      supplierInvoiceDate: dateOrNull(body.supplierInvoiceDate),
      transportCost, otherCost, subtotal, totalCGST, totalSGST, totalIGST, grandTotal,
      remarks: clean(body.remarks), lines,
      createdBy: req.user._id,
    });

    // Update only the affected stock keys. No full stock-table read is performed.
    for (const line of lines) {
      const filter = {
        companyId: req.user?.companyId || null,
        location,
        itemType: "RAW_MATERIAL",
        itemName: line.itemName,
        batchNo: line.batchNo || "",
        barcode: line.barcode || "",
      };
      const old = await InventoryStock.findOne(filter).select("qty stockValue averageRate").lean();
      const oldQty = num(old?.qty);
      const oldValue = num(old?.stockValue);
      const addValue = num(line.landedCost);
      const newQty = round2(oldQty + line.qty);
      const newValue = round2(oldValue + addValue);
      await InventoryStock.findOneAndUpdate(
        filter,
        {
          $set: {
            hsn: line.hsn,
            unit: line.unit,
            mfgDate: line.mfgDate,
            expiryDate: line.expiryDate,
            lastPurchaseRate: line.purchaseRate,
            lastPurchaseDate: purchase.date,
            averageRate: newQty ? round2(newValue / newQty) : 0,
          },
          $inc: { qty: line.qty, stockValue: addValue },
          $setOnInsert: { companyId: req.user?.companyId || null, location, itemType: "RAW_MATERIAL", itemName: line.itemName, batchNo: line.batchNo || "", barcode: line.barcode || "" },
        },
        { upsert: true, new: true }
      );
    }

    return res.status(201).json({ success: true, message: `Raw material purchase ${purchase.purchaseNo} posted.`, purchase });
  } catch (error) {
    console.error("createRawMaterialPurchase", error);
    return res.status(500).json({ success: false, message: error?.message || "Unable to create raw material purchase." });
  }
}

export async function getRawMaterialPurchases(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = { status: "POSTED" };
    if (req.user?.companyId) filter.companyId = req.user.companyId;
    if (clean(req.query.location)) filter.location = clean(req.query.location);
    if (clean(req.query.supplier)) filter.supplierName = { $regex: clean(req.query.supplier), $options: "i" };
    if (clean(req.query.search)) {
      const q = clean(req.query.search);
      filter.$or = [
        { purchaseNo: { $regex: q, $options: "i" } },
        { supplierName: { $regex: q, $options: "i" } },
        { "lines.itemName": { $regex: q, $options: "i" } },
      ];
    }
    const [items, total] = await Promise.all([
      RawMaterialPurchase.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      RawMaterialPurchase.countDocuments(filter),
    ]);
    return res.json({ success: true, items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("getRawMaterialPurchases", error);
    return res.status(500).json({ success: false, message: "Unable to load raw material purchases." });
  }
}

export async function getRawMaterialStock(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
    const skip = (page - 1) * limit;
    const filter = { itemType: "RAW_MATERIAL", qty: { $gt: 0 } };
    if (req.user?.companyId) filter.companyId = req.user.companyId;
    if (clean(req.query.location)) filter.location = clean(req.query.location);
    if (clean(req.query.search)) filter.itemName = { $regex: clean(req.query.search), $options: "i" };
    const [items, total] = await Promise.all([
      InventoryStock.find(filter).sort({ itemName: 1 }).skip(skip).limit(limit).lean(),
      InventoryStock.countDocuments(filter),
    ]);
    return res.json({ success: true, items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("getRawMaterialStock", error);
    return res.status(500).json({ success: false, message: "Unable to load raw material stock." });
  }
}
