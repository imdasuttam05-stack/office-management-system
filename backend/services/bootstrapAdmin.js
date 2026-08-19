import bcrypt from "bcrypt";
import User from "../models/User.js";
import { writeAuditLog } from "./auditService.js";

const BCRYPT_ROUNDS = Math.max(
  10,
  Number(process.env.BCRYPT_ROUNDS || 12)
);

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

function isStrongPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

export async function ensureBootstrapAdmin() {
  const name = String(process.env.BOOTSTRAP_ADMIN_NAME || "Main Administrator").trim();
  const email = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const mobile = normalizeMobile(process.env.BOOTSTRAP_ADMIN_MOBILE);
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || "");

  if (!email || !mobile || !password) {
    console.warn(
      "Bootstrap admin skipped: BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_MOBILE and BOOTSTRAP_ADMIN_PASSWORD must be configured."
    );
    return null;
  }

  if (!isValidEmail(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is invalid.");
  }

  if (!isValidMobile(mobile)) {
    throw new Error("BOOTSTRAP_ADMIN_MOBILE is invalid.");
  }

  if (!isStrongPassword(password)) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be between 8 and 128 characters.");
  }

  let admin = await User.findOne({
    $or: [{ email }, { mobile }],
  }).select("+passwordHash");

  if (admin) {
    // IMPORTANT: do not overwrite an existing user's password on every server restart.
    // Only repair identity fields when they match the bootstrap account.
    let changed = false;

    if (!admin.email) {
      admin.email = email;
      changed = true;
    }

    if (!admin.mobile) {
      admin.mobile = mobile;
      changed = true;
    }

    if (admin.role !== "Admin") {
      admin.role = "Admin";
      changed = true;
    }

    if (!admin.isMainAdmin) {
      admin.isMainAdmin = true;
      changed = true;
    }

    if (!admin.isActive) {
      admin.isActive = true;
      changed = true;
    }

    if (!admin.isVerified) {
      admin.isVerified = true;
      changed = true;
    }

    if (!admin.passwordHash) {
      admin.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      admin.passwordChangedAt = new Date();
      admin.tokenVersion = Number(admin.tokenVersion || 0) + 1;
      changed = true;
      console.log(`Password initialized for bootstrap admin: ${email}`);
    }

    if (changed) {
      await admin.save();
    }

    console.log(`Bootstrap Main Admin ready: ${admin.email}`);
    return admin;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  admin = await User.create({
    name: name || "Main Administrator",
    email,
    mobile,
    passwordHash,
    role: "Admin",
    isMainAdmin: true,
    permissions: ["*"],
    isVerified: true,
    isActive: true,
    passwordChangedAt: new Date(),
  });

  await writeAuditLog({
    actorUser: admin,
    action: "BOOTSTRAP_MAIN_ADMIN_CREATED",
    entity: "User",
    entityId: admin._id,
    metadata: {
      source: "bootstrap",
    },
  });

  console.log(`Bootstrap Main Admin created: ${admin.email}`);
  return admin;
}
