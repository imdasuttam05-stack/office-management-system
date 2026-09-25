import Group from "../models/Group.js";
import Ledger from "../models/Ledger.js";
import Voucher from "../models/Voucher.js";

export async function listGroups(req, res) {
  const groups = await Group.find({ isActive: true }).populate("parent", "name").sort({ nature: 1, name: 1 });
  res.json({ success: true, groups });
}

export async function createGroup(req, res) {
  const { name, parent = null, nature } = req.body;
  if (!name || !nature) return res.status(400).json({ success: false, message: "Group name and nature are required." });
  const group = await Group.create({ name, parent: parent || null, nature, createdBy: req.user._id });
  res.status(201).json({ success: true, group });
}

export async function listLedgers(req, res) {
  const filter = { isActive: true };
  if (req.query.group) filter.group = req.query.group;
  const ledgers = await Ledger.find(filter).populate("group", "name nature").sort({ name: 1 });
  res.json({ success: true, ledgers });
}

export async function createLedger(req, res) {
  const { name, group, openingBalance = 0, openingType = "Dr", gstin = "", pan = "", address = "", phone = "" } = req.body;
  if (!name || !group) return res.status(400).json({ success: false, message: "Ledger name and group are required." });
  const ledger = await Ledger.create({ name, group, openingBalance: Number(openingBalance) || 0, openingType, gstin, pan, address, phone, createdBy: req.user._id });
  res.status(201).json({ success: true, ledger });
}

export async function listVouchers(req, res) {
  const vouchers = await Voucher.find().populate("lines.ledger", "name").populate("partyLedger", "name").sort({ date: -1, createdAt: -1 }).limit(300);
  res.json({ success: true, vouchers });
}

export async function createVoucher(req, res) {
  const { date, type, partyLedger = null, referenceNo = "", narration = "", lines = [] } = req.body;
  if (!date || !type || !Array.isArray(lines) || lines.length < 2) return res.status(400).json({ success: false, message: "Date, voucher type and at least two ledger lines are required." });
  const normalized = lines.map(x => ({ ledger: x.ledger, debit: Number(x.debit) || 0, credit: Number(x.credit) || 0, narration: x.narration || "" }));
  const totalDebit = normalized.reduce((s, x) => s + x.debit, 0);
  const totalCredit = normalized.reduce((s, x) => s + x.credit, 0);
  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.005) return res.status(400).json({ success: false, message: "Debit and Credit totals must be equal and greater than zero." });
  const prefix = type.slice(0, 3).toUpperCase();
  const count = await Voucher.countDocuments({ type });
  const voucherNo = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
  const voucher = await Voucher.create({ voucherNo, date, type, partyLedger, referenceNo, narration, lines: normalized, totalDebit, totalCredit, createdBy: req.user._id });
  res.status(201).json({ success: true, voucher });
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
