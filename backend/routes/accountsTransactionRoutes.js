import express from 'express';
import mongoose from 'mongoose';
import AccountsMaster from '../models/AccountsMaster.js';
import AccountsTransaction from '../models/AccountsTransaction.js';
import { calculateLine, loadMasters } from '../services/accountsTransactionService.js';

const router = express.Router();

function stateOf(row) { return String(row?.gstStateCode || row?.stateCode || '').trim(); }
function num(v) { return Number(v) || 0; }

router.get('/masters', async (req, res, next) => {
  try {
    const rows = await loadMasters();
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get('/next-number/:type', async (req, res, next) => {
  try {
    const type = String(req.params.type || 'VOUCHER').toUpperCase();
    const prefix = { PURCHASE:'PUR', RAW_PURCHASE:'RPU', SALE:'SAL', PURCHASE_RETURN:'PR', SALE_RETURN:'SR', PI:'PI', EXPENSE:'EXP' }[type] || 'VCH';
    const count = await AccountsTransaction.countDocuments({ voucherType: type });
    res.json({ success: true, voucherNo: `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5,'0')}` });
  } catch (e) { next(e); }
});

router.post('/calculate', async (req, res, next) => {
  try {
    const { companyStateCode, partyStateCode, lines = [] } = req.body || {};
    const sameState = String(companyStateCode || '') === String(partyStateCode || '');
    const calculated = lines.map(l => ({ ...l, ...calculateLine({ qty:l.qty, rate:l.rate, gstRate:l.gstRate, sameState }) }));
    const totals = calculated.reduce((a,l) => ({ taxable:a.taxable+l.taxable, cgst:a.cgst+l.cgst, sgst:a.sgst+l.sgst, igst:a.igst+l.igst, total:a.total+l.total }), { taxable:0,cgst:0,sgst:0,igst:0,total:0 });
    res.json({ success:true, sameState, lines:calculated, totals });
  } catch(e) { next(e); }
});

router.post('/vouchers', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!['PURCHASE','RAW_PURCHASE','SALE','PURCHASE_RETURN','SALE_RETURN','PI','EXPENSE'].includes(b.voucherType)) return res.status(400).json({success:false,message:'Invalid voucher type'});
    if (!Array.isArray(b.lines) || !b.lines.length) return res.status(400).json({success:false,message:'At least one product line is required'});
    const party = b.partyId && mongoose.isValidObjectId(b.partyId) ? await AccountsMaster.findById(b.partyId).lean() : null;
    const location = b.locationId && mongoose.isValidObjectId(b.locationId) ? await AccountsMaster.findById(b.locationId).lean() : null;
    if (['PURCHASE','RAW_PURCHASE','PURCHASE_RETURN','SALE','SALE_RETURN','PI'].includes(b.voucherType) && !party) return res.status(400).json({success:false,message:'Party/Supplier is required'});
    const sameState = stateOf(party) === stateOf(location);
    const lines = b.lines.map(l => ({ ...l, ...calculateLine({qty:l.qty,rate:l.rate,gstRate:l.gstRate,sameState}), productId:l.productId, locationId:l.locationId || b.locationId || null }));
    const totals = lines.reduce((a,l) => ({ taxable:a.taxable+l.taxable,cgst:a.cgst+l.cgst,sgst:a.sgst+l.sgst,igst:a.igst+l.igst,total:a.total+l.total }), {taxable:0,cgst:0,sgst:0,igst:0,total:0});
    const doc = await AccountsTransaction.create({ ...b, partyName:party?.name || b.partyName, supplierName: b.voucherType.includes('PURCHASE') ? party?.name : b.supplierName, locationName:location?.name || b.locationName, lines, taxableTotal:totals.taxable,cgstTotal:totals.cgst,sgstTotal:totals.sgst,igstTotal:totals.igst,grandTotal:totals.total,stockEffect:['PURCHASE','RAW_PURCHASE','SALE_RETURN'].includes(b.voucherType)?'IN':['SALE','PURCHASE_RETURN'].includes(b.voucherType)?'OUT':'NONE' });
    res.status(201).json({success:true,data:doc,message:'Voucher saved successfully'});
  } catch(e) { next(e); }
});

router.get('/vouchers', async (req,res,next)=>{
  try { const filter = req.query.type ? {voucherType:String(req.query.type).toUpperCase()} : {}; const rows=await AccountsTransaction.find(filter).sort({date:-1,createdAt:-1}).limit(200).lean(); res.json({success:true,data:rows}); } catch(e){next(e);}
});

export default router;
