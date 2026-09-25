import express from "express";
import auth from "../middleware/auth.js";
import { listGroups, createGroup, listLedgers, createLedger, listVouchers, createVoucher, ledgerStatement } from "../controllers/accountingController.js";

const router = express.Router();
router.use(auth);
router.get('/groups', listGroups);
router.post('/groups', createGroup);
router.get('/ledgers', listLedgers);
router.post('/ledgers', createLedger);
router.get('/vouchers', listVouchers);
router.post('/vouchers', createVoucher);
router.get('/ledgers/:id/statement', ledgerStatement);
export default router;
