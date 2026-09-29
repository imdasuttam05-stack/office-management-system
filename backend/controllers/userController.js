import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "../models/User.js";
import { getDefaultPermissionsForUser } from "../config/permissions.js";
import { writeAuditLog } from "../services/auditService.js";

const BCRYPT_ROUNDS = Math.max(
  10,
  Number(process.env.BCRYPT_ROUNDS || 12)
);

const VALID_ROLES = [
  "Admin",
  "Manager",
  "HR",
  "BM",
  "HO",
  "Accountant",
  "Sales",
  "Purchase",
  "Store",
  "Employee",
];

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMobile(value) {
  return String(value || "").replace(/[^0-9+]/g, "").trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMobile(mobile) {
  const digits = String(mobile || "").replace(/^\+/, "");
  return /^\d{10,15}$/.test(digits);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

function validObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function userResponse(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    effectiveRole: user.isMainAdmin ? "MAIN_ADMIN" : user.role,
    isMainAdmin: Boolean(user.isMainAdmin),
    permissions: getDefaultPermissionsForUser(user),
    companyId: user.companyId ? String(user.companyId) : null,
    branchId: user.branchId ? String(user.branchId) : null,
    warehouseIds: Array.isArray(user.warehouseIds)
      ? user.warehouseIds.map(String)
      : [],
    department: user.department || "",
    employeeId: user.employeeId ? String(user.employeeId) : null,
    isActive: Boolean(user.isActive),
    isVerified: Boolean(user.isVerified),
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt || null,
  };
}

function isMainAdmin(user) {
  return Boolean(user?.isMainAdmin);
}

function canManageTarget(actor, target) {
  if (!target) return false;
  if (String(actor._id) === String(target._id)) return true;

  if (isMainAdmin(actor)) return true;

  // A normal Admin cannot manage another Admin or Main Admin.
  if (target.role === "Admin" || target.isMainAdmin) return false;

  return true;
}

function normalizePermissions(input) {
  if (!Array.isArray(input)) return [];

  return [
    ...new Set(
      input
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .filter((value) => value === "*" || /^[a-zA-Z0-9_.-]{2,150}$/.test(value))
    ),
  ];
}

function normalizeScope(reqBody) {
  const warehouseIds = Array.isArray(reqBody?.warehouseIds)
    ? reqBody.warehouseIds.filter(validObjectId).map(String)
    : [];

  return {
    companyId: validObjectId(reqBody?.companyId)
      ? reqBody.companyId
      : null,
    branchId: validObjectId(reqBody?.branchId)
      ? reqBody.branchId
      : null,
    warehouseIds,
    department: String(reqBody?.department || "").trim().slice(0, 100),
    employeeId: validObjectId(reqBody?.employeeId)
      ? reqBody.employeeId
      : null,
  };
}

// GET /api/users
export const listUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select(
        "name email mobile role isMainAdmin permissions companyId branchId warehouseIds department employeeId isActive isVerified lastLogin createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      users: users.map(userResponse),
    });
  } catch (error) {
    console.error("LIST USERS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load users.",
    });
  }
};

// POST /api/users
export const createUser = async (req, res) => {
  try {
    const actor = req.user;
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const mobile = normalizeMobile(req.body?.mobile);
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "Employee");
    const requestedMainAdmin = Boolean(req.body?.isMainAdmin);

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role.",
      });
    }

    if (requestedMainAdmin && !isMainAdmin(actor)) {
      return res.status(403).json({
        success: false,
        message: "Only Main Admin can create another Main Admin.",
      });
    }

    // Main Admin identity must never be created through ordinary Admin role creation.
    // There should normally be exactly one bootstrap Main Admin.
    if (requestedMainAdmin && role !== "Admin") {
      return res.status(400).json({
        success: false,
        message: "Main Admin must use the Admin role.",
      });
    }

    if (requestedMainAdmin) {
      const existingMainAdmin = await User.findOne({
        isMainAdmin: true,
      }).select("_id");

      if (existingMainAdmin) {
        return res.status(409).json({
          success: false,
          message: "A Main Admin already exists. Only one Main Admin is allowed.",
        });
      }
    }

    if (
      name.length < 2 ||
      !isValidEmail(email) ||
      !isValidMobile(mobile) ||
      !validPassword(password)
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, valid email, valid mobile and password of at least 8 characters are required.",
      });
    }

    const existing = await User.findOne({
      $or: [{ email }, { mobile }],
    }).select("_id");

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A user with this email or mobile already exists.",
      });
    }

    if (!isMainAdmin(actor) && role === "Admin") {
      return res.status(403).json({
        success: false,
        message: "Only Main Admin can create an Admin account.",
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const scope = normalizeScope(req.body);

    const requestedPermissions = normalizePermissions(req.body?.permissions);

    // Only Main Admin may grant custom permissions at creation time.
    const permissions = isMainAdmin(actor)
      ? requestedPermissions
      : [];

    const user = await User.create({
      name,
      email,
      mobile,
      passwordHash,
      role,
      isMainAdmin: requestedMainAdmin,
      permissions,
      ...scope,
      createdBy: actor._id,
      isVerified: true,
      isActive: true,
      passwordChangedAt: new Date(),
    });

    await writeAuditLog({
      req,
      actorUser: actor,
      action: "USER_CREATED",
      entity: "User",
      entityId: user._id,
      metadata: {
        role: user.role,
        isMainAdmin: user.isMainAdmin,
        permissions: user.isMainAdmin ? ["*"] : permissions,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: userResponse(user),
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or mobile already belongs to another user.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create user.",
    });
  }
};

// PATCH /api/users/:id
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id.",
      });
    }

    const user = await User.findById(id).select("+passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!canManageTarget(req.user, user)) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage this user.",
      });
    }

    const actorIsMainAdmin = isMainAdmin(req.user);
    const isSelf = String(req.user._id) === String(user._id);

    const name = String(req.body?.name ?? user.name).trim();
    const email = normalizeEmail(req.body?.email ?? user.email);
    const mobile = normalizeMobile(req.body?.mobile ?? user.mobile);

    if (
      name.length < 2 ||
      !isValidEmail(email) ||
      !isValidMobile(mobile)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid name, email or mobile number.",
      });
    }

    const duplicate = await User.findOne({
      _id: { $ne: id },
      $or: [{ email }, { mobile }],
    }).select("_id");

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Email or mobile already belongs to another user.",
      });
    }

    const password = req.body?.password == null ? "" : String(req.body.password);

    if (password && !validPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    // Self-edit restrictions.
    if (isSelf && !actorIsMainAdmin) {
      if (req.body?.role !== undefined) {
        return res.status(403).json({
          success: false,
          message: "You cannot change your own role.",
        });
      }

      if (req.body?.isMainAdmin !== undefined) {
        return res.status(403).json({
          success: false,
          message: "You cannot change your own Main Admin status.",
        });
      }
    }

    if (req.body?.isMainAdmin !== undefined && !actorIsMainAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only Main Admin can change Main Admin status.",
      });
    }

    if (req.body?.role !== undefined) {
      const nextRole = String(req.body.role);

      if (!VALID_ROLES.includes(nextRole)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role.",
        });
      }

      if (!actorIsMainAdmin && nextRole === "Admin") {
        return res.status(403).json({
          success: false,
          message: "Only Main Admin can assign the Admin role.",
        });
      }

      if (!actorIsMainAdmin && (user.role === "Admin" || user.isMainAdmin)) {
        return res.status(403).json({
          success: false,
          message: "Only Main Admin can modify an Admin account.",
        });
      }

      user.role = nextRole;
    }

    if (req.body?.isMainAdmin !== undefined) {
      const nextMain = Boolean(req.body.isMainAdmin);

      if (nextMain && !user.isMainAdmin) {
        const existingMainAdmin = await User.findOne({
          isMainAdmin: true,
          _id: { $ne: user._id },
        }).select("_id");

        if (existingMainAdmin) {
          return res.status(409).json({
            success: false,
            message: "A Main Admin already exists. Only one Main Admin is allowed.",
          });
        }
      }

      // A Main Admin cannot be demoted through the normal user edit flow.
      // This prevents accidental loss of the last recovery-capable administrator.
      if (user.isMainAdmin && !nextMain) {
        return res.status(403).json({
          success: false,
          message: "Main Admin cannot be demoted from this screen.",
        });
      }

      user.isMainAdmin = nextMain;

      if (nextMain) {
        user.role = "Admin";
        user.permissions = ["*"];
      }
    }

    if (req.body?.permissions !== undefined) {
      if (!actorIsMainAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only Main Admin can change explicit permissions.",
        });
      }

      user.permissions = normalizePermissions(req.body.permissions);
      if (user.isMainAdmin) {
        user.permissions = ["*"];
      }
    }

    user.name = name;
    user.email = email;
    user.mobile = mobile;

    if (typeof req.body?.isActive === "boolean") {
      if (isSelf && req.body.isActive === false) {
        return res.status(400).json({
          success: false,
          message: "You cannot deactivate your own account.",
        });
      }

      if (!actorIsMainAdmin && user.isMainAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only Main Admin can deactivate an Admin account.",
        });
      }

      user.isActive = req.body.isActive;
    }

    if (req.body?.companyId !== undefined) {
      user.companyId = validObjectId(req.body.companyId) ? req.body.companyId : null;
    }

    if (req.body?.branchId !== undefined) {
      user.branchId = validObjectId(req.body.branchId) ? req.body.branchId : null;
    }

    if (req.body?.warehouseIds !== undefined) {
      if (!Array.isArray(req.body.warehouseIds)) {
        return res.status(400).json({
          success: false,
          message: "warehouseIds must be an array.",
        });
      }

      user.warehouseIds = req.body.warehouseIds
        .filter(validObjectId)
        .map(String);
    }

    if (req.body?.department !== undefined) {
      user.department = String(req.body.department || "").trim().slice(0, 100);
    }

    if (req.body?.employeeId !== undefined) {
      user.employeeId = validObjectId(req.body.employeeId)
        ? req.body.employeeId
        : null;
    }

    if (password) {
      user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      user.passwordChangedAt = new Date();
      user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    }

    await user.save();

    await writeAuditLog({
      req,
      actorUser: req.user,
      action: "USER_UPDATED",
      entity: "User",
      entityId: user._id,
      metadata: {
        role: user.role,
        isMainAdmin: user.isMainAdmin,
        isActive: user.isActive,
        passwordChanged: Boolean(password),
      },
    });

    return res.json({
      success: true,
      message: "User updated successfully.",
      user: userResponse(user),
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or mobile already belongs to another user.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update user.",
    });
  }
};
