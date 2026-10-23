import express from "express";
import auth from "../middleware/auth.js";
import requireCompanyContext from "../middleware/companyContext.js";
import businessAudit from "../middleware/businessAudit.js";
import { listGroups, createGroup, listLedgers, createLedger, listVouchers, createVoucher, ledgerStatement } from "../controllers/accountingController.js";

const router = express.Router();
router.use(auth, requireCompanyContext, businessAudit);
router.get('/groups', listGroups);
router.post('/groups', createGroup);
router.get('/ledgers', listLedgers);
router.post('/ledgers', createLedger);
router.get('/vouchers', listVouchers);
router.post('/vouchers', createVoucher);
router.get('/ledgers/:id/statement', ledgerStatement);
export default router;
