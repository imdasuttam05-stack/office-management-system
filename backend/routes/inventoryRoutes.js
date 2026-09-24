import express from "express";
import auth from "../middleware/auth.js";
import requireRole from "../middleware/role.js";
import { createRawMaterialPurchase, getRawMaterialPurchases, getRawMaterialStock } from "../controllers/inventoryController.js";

const router = express.Router();

router.get("/raw-material-purchases", auth, getRawMaterialPurchases);
router.post("/raw-material-purchases", auth, requireRole("Admin", "Manager"), createRawMaterialPurchase);
router.get("/raw-material-stock", auth, getRawMaterialStock);

export default router;
