import Group from "../models/Group.js";

const groups = [
  ["Capital Account", "Capital"],
  ["Current Liabilities", "Liability"], ["Sundry Creditors", "Liability"], ["Duties & Taxes", "Liability"], ["Other Current Liabilities", "Liability"],
  ["Current Assets", "Asset"], ["Sundry Debtors", "Asset"], ["Cash-in-Hand", "Asset"], ["Bank Accounts", "Asset"],
  ["Fixed Assets", "Asset"],
  ["Direct Expenses", "Expense"], ["Indirect Expenses", "Expense"], ["Professional Fees", "Expense"], ["Finance Cost", "Expense"],
  ["Direct Income", "Income"], ["Indirect Income", "Income"], ["Sales", "Income"], ["Purchase", "Expense"],
];
export async function ensureAccountingCatalog() {
  for (const [name, nature] of groups) await Group.updateOne({ name, parent: null }, { $setOnInsert: { name, nature, isSystem: true } }, { upsert: true });
}
