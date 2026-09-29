import Role from "../models/Role.js";
import { getDefaultPermissionsForUser } from "../config/permissions.js";

function hasPermission(granted, required) {
  if (!required) return false;
  if (granted.includes("*")) return true;
  return granted.includes(required);
}

export default function requirePermission(...requiredPermissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      if (!requiredPermissions.length) {
        return next();
      }

      // Main Admin always has full access.
      if (req.user.isMainAdmin) {
        return next();
      }

      // Explicit user permissions override the role defaults.
      let grantedPermissions =
        Array.isArray(req.user.permissions) && req.user.permissions.length
          ? req.user.permissions.filter(Boolean)
          : [];

      // If the user has no explicit permissions, load the current role
      // from MongoDB. This makes role changes effective without redeploying.
      if (!grantedPermissions.length) {
        const role = await Role.findOne({
          name: req.user.role,
        })
          .select("permissions")
          .lean();

        grantedPermissions = Array.isArray(role?.permissions)
          ? role.permissions.filter(Boolean)
          : [];
      }

      // Backward-compatible fallback for existing installations if the
      // system role catalog has not been seeded yet.
      if (!grantedPermissions.length) {
        grantedPermissions = getDefaultPermissionsForUser(req.user);
      }

      const allowed = requiredPermissions.some((permission) =>
        hasPermission(grantedPermissions, permission)
      );

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission for this action.",
          requiredPermission: requiredPermissions[0],
        });
      }

      // Make the resolved permission set available to downstream handlers.
      req.permissions = grantedPermissions;

      return next();
    } catch (error) {
      console.error("PERMISSION CHECK ERROR:", error?.message || error);

      return res.status(500).json({
        success: false,
        message: "Unable to verify permissions.",
      });
    }
  };
}
