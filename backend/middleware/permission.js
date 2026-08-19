import { getDefaultPermissionsForUser } from "../config/permissions.js";

export default function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!requiredPermissions.length) {
      return next();
    }

    const permissions = getDefaultPermissionsForUser(req.user);

    if (permissions.includes("*")) {
      return next();
    }

    const allowed = requiredPermissions.some((permission) =>
      permissions.includes(permission)
    );

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission for this action.",
        requiredPermission: requiredPermissions[0],
      });
    }

    next();
  };
}
