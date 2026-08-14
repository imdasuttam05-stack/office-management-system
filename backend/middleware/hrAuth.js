import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function hrAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: "Authentication required." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: "Invalid session." });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session." });
  }
}

export function hrAdmin(req, res, next) {
  if (req.user?.role !== "Admin") {
    return res.status(403).json({ success: false, message: "Admin access required." });
  }
  next();
}
