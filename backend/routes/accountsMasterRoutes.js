import express from "express";
import {
  listMasters,
  getMaster,
  createMaster,
  updateMaster,
  deleteMaster,
} from "../services/accountsMasterService.js";

const router = express.Router();

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
    const row = await createMaster(req.body);
    res.status(201).json({ success: true, message: "Master saved successfully.", data: row, master: row });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const row = await updateMaster(req.params.id, req.body);
    res.json({ success: true, message: "Master updated successfully.", data: row, master: row });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const row = await deleteMaster(req.params.id);
    res.json({ success: true, message: "Master deleted successfully.", data: row });
  } catch (err) { next(err); }
});

export default router;
