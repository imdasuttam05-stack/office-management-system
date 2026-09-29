import React, { useEffect, useMemo, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'https://office-management-system-ikx8.onrender.com').replace(/\/+$/, '');
const token = () => localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
const headers = () => ({ 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) });

// One Accounts transaction hub. Purchase/Sale are voucher types, not duplicate master screens.
const TYPES = [
  ['PURCHASE', 'Purchase'],
  ['RAW_PURCHASE', 'Raw Purchase'],
  ['SALE', 'Sale'],
  ['PURCHASE_RETURN', 'Purchase Return'],
  ['SALE_RETURN', 'Sale Return'],
  ['PI', 'Proforma Invoice'],
  ['EXPENSE', 'Expense'],
  ['EXPENSE_RETURN', 'Expense Return'],
];

const lineBlank = () => ({ productId: '', qty: '', unit: '', rate: '', gstRate: 0, packing: '' });
const blank = type => ({ voucherType: type, voucherNo: '', date: new Date().toISOString().slice(0, 10), partyId: '', locationId: '', billNo: '', dueDate: '', narration: '', lines: [lineBlank()] });

function money(n) { return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function stateCode(x) { return String(x?.gstStateCode || (x?.gstin ? String(x.gstin).slice(0, 2) : '') || '').trim(); }

export default function AccountsTrading() {
  const [type, setType] = useState('PURCHASE');
  const [masters, setMasters] = useState([]);
  const [form, setForm] = useState(blank('PURCHASE'));
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(true);

  const groups = useMemo(() => ({
    party: masters.filter(x => x.masterType === 'party'),
    supplier: masters.filter(x => x.masterType === 'supplier'),
    product: masters.filter(x => x.masterType === 'product'),
    location: masters.filter(x => x.masterType === 'location'),
    ledger: masters.filter(x => x.masterType === 'ledger'),
  }), [masters]);

  const isPurchase = ['PURCHASE', 'RAW_PURCHASE', 'PURCHASE_RETURN'].includes(type);
  const isExpense = ['EXPENSE', 'EXPENSE_RETURN'].includes(type);
  const partyLabel = isExpense ? 'Expense Ledger' : (isPurchase ? 'Supplier' : 'Party');
  const partyRows = isExpense ? groups.ledger : (isPurchase ? groups.supplier : groups.party);
  const selectedParty = partyRows.find(x => String(x._id) === String(form.partyId));
  const selectedLocation = groups.location.find(x => String(x._id) === String(form.locationId));

  // GST is determined from the selected transaction party + selected company/location state.
  // Same state => CGST + SGST; different state => IGST.
  const sameState = !!stateCode(selectedParty) && !!stateCode(selectedLocation)
    ? stateCode(selectedParty) === stateCode(selectedLocation)
    : true;

  async function loadMasters() {
    setLoadingMasters(true);
    try {
      const r = await fetch(`${API_URL}/api/accounts-master-options`, { headers: headers() });
      const d = await r.json();
      if (!r.ok || !d.success) throw Error(d.message || 'Master data load failed');
      setMasters(Array.isArray(d.data) ? d.data : []);
      setErr('');
    } catch (e) {
      setErr(`Master dropdown load failed: ${e.message}`);
    } finally { setLoadingMasters(false); }
  }

  useEffect(() => { loadMasters(); }, []);

  useEffect(() => {
    setForm(blank(type));
    setMsg('');
    setErr('');
    fetch(`${API_URL}/api/accounts-transactions/next-number/${type}`, { headers: headers() })
      .then(r => r.json())
      .then(d => { if (d.success) setForm(f => ({ ...f, voucherNo: d.voucherNo, voucherType: type })); })
      .catch(() => {});
  }, [type]);

  function setLine(i, key, value) {
    setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, [key]: value } : l) }));
  }

  function chooseProduct(i, id) {
    const p = groups.product.find(x => String(x._id) === String(id));
    setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? {
      ...l,
      productId: id,
      unit: p?.unit || '',
      rate: type === 'SALE' || type === 'SALE_RETURN' ? (p?.salesRate ?? '') : (p?.purchaseRate ?? ''),
      gstRate: p?.gstRate ?? 0,
    } : l) }));
  }

  const totals = form.lines.reduce((a, l) => {
    const taxable = (Number(l.qty) || 0) * (Number(l.rate) || 0);
    const tax = taxable * (Number(l.gstRate) || 0) / 100;
    return { taxable: a.taxable + taxable, cgst: a.cgst + (sameState ? tax / 2 : 0), sgst: a.sgst + (sameState ? tax / 2 : 0), igst: a.igst + (sameState ? 0 : tax), total: a.total + taxable + tax };
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  async function save(e) {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    try {
      if (!form.partyId && !isExpense) throw Error(`Please select ${partyLabel}`);
      if (!form.locationId && !isExpense) throw Error('Please select Location');
      if (!isExpense && form.lines.some(l => !l.productId || Number(l.qty) <= 0)) throw Error('Please select Product and enter valid Quantity');
      const payload = { ...form, voucherType: type, taxSummary: totals, sameState };
      const r = await fetch(`${API_URL}/api/accounts-transactions/vouchers`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw Error(d.message || 'Save failed');
      setMsg(`${d.message || 'Voucher saved'} — ${d.data?.voucherNo || form.voucherNo}`);
      setForm({ ...blank(type), voucherNo: '' });
      loadMasters();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return <div style={{ padding: 24, fontFamily: 'Arial', background: '#f5f7fb', minHeight: '100vh' }}>
    <div style={{ background: '#173b68', color: '#fff', padding: '18px 22px', borderRadius: 14 }}>
      <b>ACCOUNTS · TRANSACTION ENTRY</b>
      <div style={{ opacity: .8, fontSize: 12, marginTop: 5 }}>One entry screen · Party · Product · Quantity · Location · Rate · Automatic GST</div>
    </div>

    <div style={{ margin: '14px 0', padding: 12, background: '#fff', borderRadius: 10, border: '1px solid #e4e7ec' }}>
      <b>ENTRY RULE:</b> Masters are created under <b>Accounts</b>. Purchase/Sale/Return are only voucher types here. Product, Party/Supplier and Location are always selected from dropdowns.
      {loadingMasters && <span style={{ marginLeft: 12 }}>Loading master data…</span>}
      {!loadingMasters && <span style={{ marginLeft: 12 }}>✓ {groups.party.length} Party · {groups.supplier.length} Supplier · {groups.product.length} Product · {groups.location.length} Location</span>}
    </div>

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
      {TYPES.map(([id, label]) => <button type="button" key={id} onClick={() => setType(id)} style={{ padding: '10px 13px', borderRadius: 8, border: '1px solid #d0d5dd', background: type === id ? '#173b68' : '#fff', color: type === id ? '#fff' : '#172b4d', fontWeight: 700 }}>{label}</button>)}
    </div>

    {msg && <div style={{ padding: 12, background: '#e9f8ef', marginBottom: 12 }}>✓ {msg}</div>}
    {err && <div style={{ padding: 12, background: '#fdecec', marginBottom: 12 }}>⚠ {err}</div>}

    <form onSubmit={save} style={{ background: '#fff', padding: 20, borderRadius: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(160px,1fr))', gap: 12 }}>
        <label>Voucher No<input value={form.voucherNo} readOnly /></label>
        <label>Date<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
        <label>{partyLabel}<select value={form.partyId} onChange={e => setForm({ ...form, partyId: e.target.value })}><option value="">Select {partyLabel}</option>{partyRows.map(x => <option key={x._id} value={x._id}>{x.name}{x.state ? ` · ${x.state}` : ''}</option>)}</select></label>
        <label>Location<select value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })}><option value="">Select Location</option>{groups.location.map(x => <option key={x._id} value={x._id}>{x.name}{x.state ? ` · ${x.state}` : ''}</option>)}</select></label>
      </div>

      <div style={{ marginTop: 18, overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Product','Qty','Unit','Rate','GST %','Packing','Taxable','Total',''].map(x => <th key={x} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>{x}</th>)}</tr></thead><tbody>
        {form.lines.map((l, i) => <tr key={i}>
          <td><select value={l.productId} onChange={e => chooseProduct(i, e.target.value)}><option value="">Select Product</option>{groups.product.map(x => <option key={x._id} value={x._id}>{x.name}{x.code ? ` · ${x.code}` : ''}</option>)}</select></td>
          <td><input type="number" min="0" step="any" value={l.qty} onChange={e => setLine(i, 'qty', e.target.value)} /></td>
          <td><input value={l.unit} readOnly /></td>
          <td><input type="number" min="0" step="any" value={l.rate} onChange={e => setLine(i, 'rate', e.target.value)} /></td>
          <td><input type="number" min="0" step="any" value={l.gstRate} onChange={e => setLine(i, 'gstRate', e.target.value)} /></td>
          <td><input value={l.packing} onChange={e => setLine(i, 'packing', e.target.value)} placeholder="25 KG bag" /></td>
          <td>{money((Number(l.qty) || 0) * (Number(l.rate) || 0))}</td>
          <td>{money((Number(l.qty) || 0) * (Number(l.rate) || 0) * (1 + (Number(l.gstRate) || 0) / 100))}</td>
          <td><button type="button" onClick={() => setForm(f => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((_, idx) => idx !== i) : f.lines }))}>×</button></td>
        </tr>)}
      </tbody></table></div>

      <button type="button" onClick={() => setForm(f => ({ ...f, lines: [...f.lines, lineBlank()] }))} style={{ marginTop: 12 }}>+ Add Product</button>

      <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
        <b>GST MODE: {sameState ? 'INTRA-STATE → CGST + SGST' : 'INTER-STATE → IGST'}</b>
        <span style={{ marginLeft: 14, fontSize: 12 }}>Party state: {selectedParty?.state || '-'} · Location state: {selectedLocation?.state || '-'} </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}><div style={{ minWidth: 300, lineHeight: 1.8 }}>
        <div>Taxable: <b>₹{money(totals.taxable)}</b></div><div>CGST: ₹{money(totals.cgst)}</div><div>SGST: ₹{money(totals.sgst)}</div><div>IGST: ₹{money(totals.igst)}</div><div style={{ fontSize: 18 }}>Grand Total: <b>₹{money(totals.total)}</b></div>
        <button disabled={saving || loadingMasters} style={{ marginTop: 10, padding: '12px 28px', background: '#173b68', color: '#fff', border: 0, borderRadius: 8 }}>{saving ? 'Saving...' : 'Save Voucher'}</button>
      </div></div>
    </form>
    <style>{`label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#344054}input,select{min-height:38px;border:1px solid #d0d5dd;border-radius:7px;padding:0 9px;background:#fff}td{padding:6px;border-bottom:1px solid #eee}`}</style>
  </div>;
}
