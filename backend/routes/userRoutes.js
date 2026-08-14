import express from "express";
import auth from "../middleware/auth.js";
import requireRole from "../middleware/role.js";
import {
  listUsers,
  createUser,
  updateUser,
} from "../controllers/userController.js";

const router = express.Router();

// Admin only
router.use(auth, requireRole("Admin"));

router.get("/", listUsers);
router.post("/", createUser);
router.patch("/:id", updateUser);

export default router;
