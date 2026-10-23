import express from "express";
import {
  listMasters,
  getMaster,
  createMaster,
  updateMaster,
  deleteMaster,
} from "../services/accountsMasterService.js";
import auth from "../middleware/auth.js";
import requireCompanyContext from "../middleware/companyContext.js";
import businessAudit from "../middleware/businessAudit.js";

const router = express.Router();
router.use(auth, requireCompanyContext, businessAudit);

router.get("/", async (req, res, next) => {
  try {
    const type = String(req.query.type || "").trim().toLowerCase();
    const rows = await listMasters(type || null);
    res.json({ success: true, data: rows, masters: rows });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const row = await getMaster(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Master not found." });
    res.json({ success: true, data: row, master: row });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const row = await createMaster(req.body, req);
    res.status(201).json({ success: true, message: "Master saved successfully.", data: row, master: row });
  } catch (err) {
    if (["UNIT_DUPLICATE", "UNIT_VALIDATION"].includes(err?.code)) {
      return res.status(err.code === "UNIT_DUPLICATE" ? 409 : 400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const row = await updateMaster(req.params.id, req.body, req);
    res.json({ success: true, message: "Master updated successfully.", data: row, master: row });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const row = await deleteMaster(req.params.id, req);
    res.json({ success: true, message: "Master deleted successfully.", data: row });
  } catch (err) { next(err); }
});

export default router;
