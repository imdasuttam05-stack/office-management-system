import express from "express";
import {
  cleanMasterType,
  getMasterLookups,
  listMasters,
  createMaster,
  updateMaster,
  deactivateMaster,
} from "../services/accountsMasterService.js";

const router = express.Router();

router.get("/lookups", async (req, res) => {
  try { res.json(await getMasterLookups()); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

router.get("/", async (req, res) => {
  try {
    const type = cleanMasterType(req.query.type);
    if (!type) return res.status(400).json({ message: "Invalid master type." });
    res.json(await listMasters(type));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const row = await createMaster(req.body);
    res.status(201).json({ message: "Master created successfully.", row });
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const row = await updateMaster(req.params.id, req.body);
    res.json({ message: "Master updated successfully.", row });
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const row = await deactivateMaster(req.params.id);
    res.json({ message: "Master deleted successfully.", row });
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
});

export default router;
