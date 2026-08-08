import express from "express";
import { sendOtp } from "../controllers/authController.js";

const router = express.Router();

router.post("/send-otp", sendOtp);

export default router;
