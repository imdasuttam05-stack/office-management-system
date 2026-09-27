import AccountsMaster from '../models/AccountsMaster.js';

export function calculateLine({ qty, rate, gstRate, sameState }) {
  const q = Number(qty) || 0;
  const r = Number(rate) || 0;
  const g = Number(gstRate) || 0;
  const taxable = +(q * r).toFixed(2);
  const tax = +(taxable * g / 100).toFixed(2);
  const cgst = sameState ? +(tax / 2).toFixed(2) : 0;
  const sgst = sameState ? +(tax - cgst).toFixed(2) : 0;
  const igst = sameState ? 0 : tax;
  return { taxable, cgst, sgst, igst, total: +(taxable + tax).toFixed(2) };
}

export async function loadMasters() {
  const rows = await AccountsMaster.find({ active: { $ne: false } }).sort({ masterType: 1, name: 1 }).lean();
  return rows;
}

export async function getStateCode(id) {
  if (!id) return '';
  const row = await AccountsMaster.findById(id).lean();
  return row?.gstStateCode || row?.stateCode || '';
}
