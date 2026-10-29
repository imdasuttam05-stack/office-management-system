import express from "express";
import auth from "../middleware/auth.js";
import requireCompanyContext from "../middleware/companyContext.js";
import businessAudit from "../middleware/businessAudit.js";
import { listGroups, createGroup, listLedgers, createLedger, listVouchers, createVoucher, ledgerStatement, listOpenBills, reverseVoucher, partyLedgerReport } from "../controllers/accountingController.js";

const router = express.Router();
router.use(auth, requireCompanyContext, businessAudit);
router.get('/groups', listGroups);
router.post('/groups', createGroup);
router.get('/ledgers', listLedgers);
router.post('/ledgers', createLedger);
router.get('/vouchers', listVouchers);
router.get('/open-bills', listOpenBills);
router.get('/party-ledger', partyLedgerReport);
router.post('/vouchers', createVoucher);
router.post('/vouchers/:id/reverse', reverseVoucher);
router.get('/ledgers/:id/statement', ledgerStatement);
export default router;
