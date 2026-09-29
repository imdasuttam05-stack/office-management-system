import express from 'express';
import AccountsMaster from '../models/AccountsMaster.js';

const router = express.Router();

// Master data used by ALL Accounts / Purchase / Sale transaction screens.
// The transaction screen should never maintain a second copy of Party/Product/Location.
router.get('/', async (req, res) => {
  try {
    const docs = await AccountsMaster.find({ active: { $ne: false } })
      .select('_id masterType name code under state gstStateCode gstin pan unit hsn gstRate purchaseRate salesRate openingQty openingValue itemType locationName')
      .sort({ name: 1 })
      .lean();

    const data = docs.map(x => ({
      ...x,
      _id: String(x._id),
      masterType: String(x.masterType || '').toLowerCase(),
      state: x.state || '',
      gstStateCode: x.gstStateCode || (x.gstin ? String(x.gstin).slice(0, 2) : ''),
      gstRate: Number(x.gstRate || 0),
      purchaseRate: Number(x.purchaseRate || 0),
      salesRate: Number(x.salesRate || 0),
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Transaction master options failed:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to load transaction masters' });
  }
});

export default router;
