import mongoose from "mongoose";
import OpeningBalanceSnapshot from "../models/OpeningBalanceSnapshot.js";

const FY_RE = /^(\d{4})-(\d{2})$/;
function previousFYEnd(fy) {
  const m = FY_RE.exec(String(fy || ""));
  if (!m || Number(m[2]) !== (Number(m[1]) + 1) % 100) throw new Error("Financial year must be in YYYY-YY format, e.g. 2025-26.");
  return new Date(Number(m[1]) + 1, 2, 31, 23, 59, 59, 999);
}

// Reads historical collections directly so the active-FY query plugin cannot hide prior-year vouchers.
export async function carryForwardOpeningBalances(req, res) {
  try {
    const companyId = new mongoose.Types.ObjectId(String(req.company?._id || req.user?.companyId || ""));
    const targetFY = String(req.financialYear || "");
    const sourceFY = String(req.body?.sourceFinancialYear || "");
    if (!companyId || !FY_RE.test(targetFY) || !FY_RE.test(sourceFY) || targetFY === sourceFY) {
      return res.status(400).json({ success: false, message: "Valid sourceFinancialYear and selected target financial year are required." });
    }
    if (Number(targetFY.slice(0, 4)) !== Number(sourceFY.slice(0, 4)) + 1) {
      return res.status(400).json({ success: false, message: "Source financial year must be immediately before the selected target financial year." });
    }
    const endDate = previousFYEnd(sourceFY);
    const db = mongoose.connection.db;
    const company = companyId;

    const existing = await OpeningBalanceSnapshot.findOne({ companyId: company, financialYear: targetFY }).lean();
    if (existing && req.body?.replaceExisting !== true) {
      return res.status(409).json({ success: false, code: "OPENING_EXISTS", message: `Opening snapshot already exists for ${targetFY}. Set replaceExisting=true only if you intend to rebuild it.` });
    }

    const voucherCollection = db.collection("vouchers");
    const ledgerRows = await voucherCollection.aggregate([
      { $match: { companyId: company, date: { $lte: endDate }, financialYear: { $lte: sourceFY } } },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.ledger", debit: { $sum: { $ifNull: ["$lines.debit", 0] } }, credit: { $sum: { $ifNull: ["$lines.credit", 0] } } } },
      { $match: { _id: { $ne: null } } },
    ]).toArray();

    const stockCollection = db.collection("inventorymovements");
    const stockRows = await stockCollection.aggregate([
      { $match: { companyId: company, date: { $lte: endDate }, financialYear: { $lte: sourceFY } } },
      { $group: {
        _id: { location: "$location", itemName: "$itemName", itemType: "$itemType", unit: "$unit", batchNo: "$batchNo", barcode: "$barcode" },
        qtyIn: { $sum: { $ifNull: ["$qtyIn", 0] } }, qtyOut: { $sum: { $ifNull: ["$qtyOut", 0] } },
        valueIn: { $sum: { $ifNull: ["$valueIn", 0] } }, valueOut: { $sum: { $ifNull: ["$valueOut", 0] } },
      } },
      { $project: { _id: 0, location: "$_id.location", itemName: "$_id.itemName", itemType: "$_id.itemType", unit: "$_id.unit", batchNo: "$_id.batchNo", barcode: "$_id.barcode", openingQty: { $subtract: ["$qtyIn", "$qtyOut"] }, openingValue: { $subtract: ["$valueIn", "$valueOut"] } } },
      { $match: { openingQty: { $ne: 0 } } },
    ]).toArray();

    const ledgers = ledgerRows.map(r => ({ ledgerId: String(r._id), debit: r.debit, credit: r.credit, openingBalance: Math.abs(r.debit - r.credit), openingType: r.debit >= r.credit ? "Dr" : "Cr" }));
    const stock = stockRows.map(r => ({ ...r, openingQty: Number(r.openingQty || 0), openingValue: Number(r.openingValue || 0) }));
    const snapshot = {
      companyId: company,
      financialYear: targetFY,
      sourceFinancialYear: sourceFY,
      carriedAt: new Date(),
      ledgers,
      stock,
      summary: { ledgerCount: ledgers.length, stockItemCount: stock.length, cutoffDate: endDate.toISOString(), note: "Snapshot only; prior vouchers remain in their original financial year." },
    };
    await OpeningBalanceSnapshot.findOneAndUpdate(
      { companyId: company, financialYear: targetFY },
      { $set: snapshot },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true, message: `Opening snapshot created for ${targetFY}.`, summary: snapshot.summary, ledgers, stock });
  } catch (error) {
    console.error("Opening balance carry-forward failed:", error);
    return res.status(400).json({ success: false, message: error.message || "Could not carry forward opening balances." });
  }
}

export async function getOpeningBalanceSnapshot(req, res) {
  try {
    const snapshot = await OpeningBalanceSnapshot.findOne({ financialYear: req.financialYear }).lean();
    return res.json({ success: true, snapshot: snapshot || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
