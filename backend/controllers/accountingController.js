import Group from "../models/Group.js";
import Ledger from "../models/Ledger.js";
import Voucher from "../models/Voucher.js";
import SalesInvoice from "../models/SalesInvoice.js";
import RawMaterialPurchase from "../models/RawMaterialPurchase.js";
import mongoose from "mongoose";
import { syncLedgerCounterparty } from "../services/accountsMasterService.js";

export async function listGroups(req, res) {
  const groups = await Group.find({ isActive: true }).populate("parent", "name").sort({ nature: 1, name: 1 }).lean();
  res.json({ success: true, groups });
}

export async function createGroup(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const parent = req.body.parent || null;
    const nature = String(req.body.nature || "").trim();

    if (!name || !nature) {
      return res.status(400).json({
        success: false,
        message: "Group name and nature are required."
      });
    }

    if (parent) {
      const parentGroup = await Group.findOne({ _id: parent, isActive: true });
      if (!parentGroup) {
        return res.status(400).json({
          success: false,
          message: "Selected parent group was not found."
        });
      }
    }

    const duplicate = await Group.findOne({
      name,
      parent,
      isActive: true
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "This group already exists under the selected parent."
      });
    }

    const group = await Group.create({
      name,
      parent,
      nature
    });

    const populated = await Group.findById(group._id)
      .populate("parent", "name nature");

    return res.status(201).json({
      success: true,
      message: "Group created successfully.",
      group: populated
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This group already exists under the selected parent."
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to create group."
    });
  }
}

export async function listLedgers(req, res) {
  const filter = { isActive: true };
  if (req.query.group) filter.group = req.query.group;
  const ledgers = await Ledger.find(filter).populate("group", "name nature").sort({ name: 1 }).lean();
  res.json({ success: true, ledgers });
}

export async function createLedger(req, res) {
  const { name, group, openingBalance = 0, openingType = "Dr", gstin = "", pan = "", address = "", phone = "" } = req.body;
  if (!name || !group) return res.status(400).json({ success: false, message: "Ledger name and group are required." });
  const ledgerGroup = await Group.findById(group);
  if (!ledgerGroup) return res.status(400).json({ success: false, message: "Selected group was not found." });
  const ledger = await Ledger.create({ name, group, openingBalance: Number(openingBalance) || 0, openingType, gstin, pan, address, phone, createdBy: req.user._id });
  await syncLedgerCounterparty({name,under:ledgerGroup.name,gstin,pan,address,phone},ledger,req);
  res.status(201).json({ success: true, ledger });
}

export async function listVouchers(req, res) {
  const vouchers = await Voucher.find().populate("lines.ledger", "name").populate("partyLedger", "name").sort({ date: -1, createdAt: -1 }).limit(300).lean();
  res.json({ success: true, vouchers });
}

const money2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function expectedBillType(voucherType) {
  if (voucherType === "Receipt" || voucherType === "Credit Note") return "SALE";
  if (voucherType === "Payment" || voucherType === "Debit Note") return "PURCHASE";
  return null;
}

async function findBill(invoiceType, invoiceId) {
  if (!mongoose.isValidObjectId(invoiceId)) return null;
  if (invoiceType === "SALE") {
    const row = await SalesInvoice.findOne({ _id: invoiceId, status: { $ne: "CANCELLED" } }).lean();
    if (!row) return null;
    return { ...row, _billType: "SALE", _billNo: row.invoiceNo || row.customerInvoiceNo || String(row._id), _partyLedger: row.customerLedgerId, _partyName: row.customerName, _amount: Number(row.grandTotal || 0) };
  }
  if (invoiceType === "PURCHASE") {
    const row = await RawMaterialPurchase.findOne({ _id: invoiceId, status: { $ne: "CANCELLED" } }).lean();
    if (!row) return null;
    return { ...row, _billType: "PURCHASE", _billNo: row.purchaseNo || row.supplierInvoiceNo || String(row._id), _partyLedger: row.supplierLedgerId, _partyName: row.supplierName, _amount: Number(row.grandTotal || 0) };
  }
  return null;
}

async function allocatedAmount(invoiceType, invoiceId, excludeVoucherId = null) {
  const filter = { "billAllocations.invoiceType": invoiceType, "billAllocations.invoiceId": new mongoose.Types.ObjectId(invoiceId) };
  if (excludeVoucherId) filter._id = { $ne: excludeVoucherId };
  const rows = await Voucher.find(filter).select("billAllocations").lean();
  let amount = 0;
  for (const row of rows) for (const allocation of row.billAllocations || []) {
    if (allocation.invoiceType !== invoiceType || String(allocation.invoiceId) !== String(invoiceId)) continue;
    amount += (allocation.isReversal ? -1 : 1) * Number(allocation.amount || 0);
  }
  return money2(amount);
}

export async function listOpenBills(req, res) {
  try {
    const invoiceType = String(req.query.type || "").toUpperCase();
    const partyLedgerId = String(req.query.partyLedgerId || "");
    if (!["SALE", "PURCHASE"].includes(invoiceType)) return res.status(400).json({ success: false, message: "Bill type must be SALE or PURCHASE." });
    if (!mongoose.isValidObjectId(partyLedgerId)) return res.status(400).json({ success: false, message: "Select a valid party ledger first." });
    const ledger = await Ledger.findById(partyLedgerId).lean();
    if (!ledger) return res.status(404).json({ success: false, message: "Party ledger not found." });
    let docs;
    if (invoiceType === "SALE") {
      docs = await SalesInvoice.find({ status: { $ne: "CANCELLED" }, $or: [{ customerLedgerId: partyLedgerId }, { customerName: new RegExp(`^${String(ledger.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }] }).sort({ date: 1 }).limit(500).lean();
    } else {
      docs = await RawMaterialPurchase.find({ status: { $ne: "CANCELLED" }, $or: [{ supplierLedgerId: partyLedgerId }, { supplierName: new RegExp(`^${String(ledger.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }] }).sort({ date: 1 }).limit(500).lean();
    }
    const bills = [];
    for (const doc of docs) {
      const id = String(doc._id);
      const total = money2(doc.grandTotal || 0);
      const allocated = await allocatedAmount(invoiceType, id);
      const outstanding = money2(total - allocated);
      if (outstanding > 0.009) bills.push({ _id: id, invoiceType, invoiceNo: invoiceType === "SALE" ? (doc.invoiceNo || doc.customerInvoiceNo || id) : (doc.purchaseNo || doc.supplierInvoiceNo || id), date: doc.date, partyName: invoiceType === "SALE" ? doc.customerName : doc.supplierName, total, allocated, outstanding });
    }
    return res.json({ success: true, bills });
  } catch (error) { return res.status(500).json({ success: false, message: error.message || "Unable to load open bills." }); }
}

export async function createVoucher(req, res) {
  try {
    const { date, type, partyLedger = null, referenceNo = "", narration = "", lines = [], billAllocations = [] } = req.body || {};
    if (!date || !type || !Array.isArray(lines) || lines.length < 2) return res.status(400).json({ success: false, message: "Date, voucher type and at least two ledger lines are required." });
    const allowedTypes = ["Payment", "Receipt", "Contra", "Journal", "Sales", "Purchase", "Debit Note", "Credit Note"];
    if (!allowedTypes.includes(type)) return res.status(400).json({ success: false, message: "Invalid voucher type." });
    const voucherDate = new Date(date);
    if (Number.isNaN(voucherDate.getTime())) return res.status(400).json({ success: false, message: "Enter a valid voucher date." });
    const normalized = lines.map(x => ({ ledger: x.ledger, debit: Number(x.debit) || 0, credit: Number(x.credit) || 0, narration: x.narration || "" }));
    if (normalized.some(x => !mongoose.isValidObjectId(x.ledger) || x.debit < 0 || x.credit < 0 || (x.debit > 0 && x.credit > 0))) return res.status(400).json({ success: false, message: "Each ledger line must have a valid ledger and either a non-negative debit or credit." });
    const totalDebit = money2(normalized.reduce((sum, x) => sum + x.debit, 0));
    const totalCredit = money2(normalized.reduce((sum, x) => sum + x.credit, 0));
    if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.005) return res.status(400).json({ success: false, message: "Debit and Credit totals must be equal and greater than zero." });

    const expectedType = expectedBillType(type);
    const normalizedAllocations = [];
    if (["Debit Note", "Credit Note"].includes(type) && (!Array.isArray(billAllocations) || billAllocations.length === 0)) {
      return res.status(400).json({ success: false, message: `${type} must be allocated against at least one open bill.` });
    }
    if (Array.isArray(billAllocations) && billAllocations.length) {
      if (!expectedType) return res.status(400).json({ success: false, message: "Bill-wise allocation is available for Receipt, Payment, Debit Note and Credit Note only." });
      if (!mongoose.isValidObjectId(partyLedger)) return res.status(400).json({ success: false, message: "Select the party ledger before allocating bills." });
      for (const allocation of billAllocations) {
        const invoiceType = String(allocation.invoiceType || expectedType).toUpperCase();
        const amount = money2(allocation.amount);
        if (invoiceType !== expectedType || !mongoose.isValidObjectId(allocation.invoiceId) || amount <= 0) return res.status(400).json({ success: false, message: `Invalid ${type} bill allocation.` });
        const bill = await findBill(invoiceType, allocation.invoiceId);
        if (!bill) return res.status(404).json({ success: false, message: "Selected bill was not found or is cancelled." });
        if (bill._partyLedger && String(bill._partyLedger) !== String(partyLedger)) return res.status(400).json({ success: false, message: "Selected bill belongs to a different party ledger." });
        if (!bill._partyLedger) {
          const selectedLedger = await Ledger.findById(partyLedger).select("name").lean();
          if (!selectedLedger || String(selectedLedger.name || "").trim().toLocaleLowerCase("en-IN") !== String(bill._partyName || "").trim().toLocaleLowerCase("en-IN")) {
            return res.status(400).json({ success: false, message: "This bill has no linked party ledger and its party name does not match the selected ledger. Link the correct ledger before allocating." });
          }
        }
        const alreadyAllocated = await allocatedAmount(invoiceType, bill._id);
        const outstanding = money2(bill._amount - alreadyAllocated);
        const sameVoucherAllocated = money2(normalizedAllocations.filter(item => item.invoiceType === invoiceType && String(item.invoiceId) === String(bill._id)).reduce((sum, item) => sum + item.amount, 0));
        if (money2(sameVoucherAllocated + amount) > outstanding + 0.005) return res.status(409).json({ success: false, message: `Allocation exceeds outstanding for bill ${bill._billNo}. Outstanding: ${money2(outstanding - sameVoucherAllocated).toFixed(2)}.` });
        normalizedAllocations.push({ invoiceType, invoiceId: bill._id, invoiceNo: bill._billNo, amount, isReversal: false });
      }
      const allocationTotal = money2(normalizedAllocations.reduce((sum, item) => sum + item.amount, 0));
      if (allocationTotal > Math.min(totalDebit, totalCredit) + 0.005) return res.status(400).json({ success: false, message: "Bill allocation total cannot exceed the voucher amount." });
      if (["Debit Note", "Credit Note"].includes(type) && Math.abs(allocationTotal - totalDebit) > 0.005) return res.status(400).json({ success: false, message: `${type} allocation total must equal the voucher total.` });
    }

    const prefix = String(type).replace(/\s+/g, "").slice(0, 3).toUpperCase();
    const year = voucherDate.getFullYear();
    const prefixPattern = `^${prefix}-${year}-`;
    const exactNumber = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    const base = { date: voucherDate, type, partyLedger, referenceNo, narration, lines: normalized, totalDebit, totalCredit, billAllocations: normalizedAllocations, createdBy: req.user._id };
    for (let attempt = 0; attempt < 10; attempt++) {
      const existingRows = await Voucher.collection.find({ voucherNo: { $regex: prefixPattern } }, { projection: { voucherNo: 1 } }).toArray();
      let lastSeq = 0;
      for (const row of existingRows) { const match = String(row.voucherNo || "").match(exactNumber); if (match) lastSeq = Math.max(lastSeq, Number(match[1]) || 0); }
      const voucherNo = `${prefix}-${year}-${String(lastSeq + 1).padStart(5, "0")}`;
      try {
        const voucher = await Voucher.create({ ...base, voucherNo });
        return res.status(201).json({ success: true, voucher });
      } catch (error) {
        const duplicateVoucherNo = error?.code === 11000 && (Boolean(error?.keyPattern?.voucherNo) || Boolean(error?.keyValue?.voucherNo) || /voucherNo_1|voucherNo/i.test(error?.message || ""));
        if (!duplicateVoucherNo) throw error;
      }
    }
    return res.status(409).json({ success: false, message: "Could not allocate a unique voucher number after several attempts. Please save again." });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Duplicate voucher/source posting detected. Refresh the register before retrying." });
    return res.status(500).json({ success: false, message: error.message || "Unable to save voucher." });
  }
}

export async function reverseVoucher(req, res) {
  try {
    const original = await Voucher.findById(req.params.id);
    if (!original) return res.status(404).json({ success: false, message: "Voucher not found." });
    if (original.reversesVoucherId) return res.status(400).json({ success: false, message: "A reversal voucher cannot itself be reversed." });
    const alreadyReversed = await Voucher.findOne({ reversesVoucherId: original._id });
    if (alreadyReversed) return res.status(409).json({ success: false, message: `Already reversed by ${alreadyReversed.voucherNo}.` });
    const year = new Date().getFullYear();
    const prefix = `REV-${year}-`;
    const existingRows = await Voucher.collection.find({ voucherNo: { $regex: `^${prefix}` } }, { projection: { voucherNo: 1 } }).toArray();
    const lastSeq = existingRows.reduce((max, row) => Math.max(max, Number(String(row.voucherNo).slice(prefix.length)) || 0), 0);
    const voucher = await Voucher.create({
      voucherNo: `${prefix}${String(lastSeq + 1).padStart(5, "0")}`,
      date: new Date(), type: original.type, partyLedger: original.partyLedger, referenceNo: original.voucherNo,
      narration: `Reversal of ${original.voucherNo}${original.narration ? ` — ${original.narration}` : ""}`,
      lines: original.lines.map(line => ({ ledger: line.ledger, debit: Number(line.credit || 0), credit: Number(line.debit || 0), narration: `Reversal: ${line.narration || ""}` })),
      totalDebit: original.totalCredit, totalCredit: original.totalDebit,
      billAllocations: (original.billAllocations || []).map(a => ({ invoiceType: a.invoiceType, invoiceId: a.invoiceId, invoiceNo: a.invoiceNo, amount: a.amount, isReversal: true, reversesVoucherId: original._id })),
      sourceType: "REVERSAL", sourceId: original._id, reversesVoucherId: original._id, createdBy: req.user._id,
    });
    return res.status(201).json({ success: true, voucher, message: "Reversal voucher created. Original voucher retained for audit." });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "This voucher has already been reversed or duplicate reversal was detected." });
    return res.status(500).json({ success: false, message: error.message || "Unable to reverse voucher." });
  }
}

export async function ledgerStatement(req, res) {
  const ledgerId = req.params.id;
  const ledger = await Ledger.findById(ledgerId).populate("group", "name nature");
  if (!ledger) return res.status(404).json({ success: false, message: "Ledger not found." });
  const vouchers = await Voucher.find({ "lines.ledger": ledgerId }).populate("lines.ledger", "name").sort({ date: 1, createdAt: 1 });
  let balance = ledger.openingType === "Dr" ? Number(ledger.openingBalance) : -Number(ledger.openingBalance);
  const entries = [];
  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      if (String(line.ledger?._id || line.ledger) !== String(ledgerId)) continue;
      balance += Number(line.debit || 0) - Number(line.credit || 0);
      entries.push({ date: voucher.date, voucherNo: voucher.voucherNo, type: voucher.type, narration: line.narration || voucher.narration, debit: line.debit, credit: line.credit, balance });
    }
  }
  res.json({ success: true, ledger, entries, closingBalance: balance, closingType: balance >= 0 ? "Dr" : "Cr" });
}
