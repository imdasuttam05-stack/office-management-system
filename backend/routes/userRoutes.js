import express from "express";
import auth from "../middleware/auth.js";
import requirePermission from "../middleware/permission.js";
import {
  listUsers,
  createUser,
  updateUser,
} from "../controllers/userController.js";

const router = express.Router();

router.use(auth);

router.get(
  "/",
  requirePermission("users.view"),
  listUsers
);

router.post(
  "/",
  requirePermission("users.create"),
  createUser
);

router.patch(
  "/:id",
  requirePermission("users.edit", "users.changeRole", "users.changePermission"),
  updateUser
);

export default router;
