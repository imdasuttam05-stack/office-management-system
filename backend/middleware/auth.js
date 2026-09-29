import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token || !process.env.JWT_SECRET) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const user = await User.findById(decoded.userId).select(
      "_id name email mobile role isMainAdmin permissions companyId branchId warehouseIds department employeeId isVerified isActive lastLogin passwordChangedAt tokenVersion"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return res.status(423).json({
        success: false,
        message: "Your account is temporarily locked.",
      });
    }

    if (
      Number(decoded.tokenVersion ?? 0) !== Number(user.tokenVersion ?? 0)
    ) {
      return res.status(401).json({
        success: false,
        message: "Session is no longer valid. Please login again.",
      });
    }

    if (
      user.passwordChangedAt &&
      decoded.iat &&
      decoded.iat * 1000 < user.passwordChangedAt.getTime()
    ) {
      return res.status(401).json({
        success: false,
        message: "Password was changed. Please login again.",
      });
    }

    req.user = user;
    req.auth = {
      tokenId: decoded.jti || null,
      sessionId: decoded.sessionId || null,
      issuedAt: decoded.iat || null,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token expired.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }
}
