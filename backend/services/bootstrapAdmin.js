import bcrypt from "bcrypt";
import User from "../models/User.js";

const BCRYPT_ROUNDS = Math.max(
  10,
  Number(process.env.BCRYPT_ROUNDS || 12)
);

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeMobile(value) {
  return String(value || "")
    .replace(/[^0-9+]/g, "")
    .trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMobile(mobile) {
  const digits = mobile.replace(/^\+/, "");
  return /^\d{10,15}$/.test(digits);
}

export async function ensureBootstrapAdmin() {
  const name = String(
    process.env.BOOTSTRAP_ADMIN_NAME ||
      "Administrator"
  ).trim();

  const email = normalizeEmail(
    process.env.BOOTSTRAP_ADMIN_EMAIL
  );

  const mobile = normalizeMobile(
    process.env.BOOTSTRAP_ADMIN_MOBILE
  );

  const password = String(
    process.env.BOOTSTRAP_ADMIN_PASSWORD || ""
  );

  // Admin env না থাকলেও backend বন্ধ হবে না
  if (!email || !mobile || !password) {
    console.warn(
      "Bootstrap admin skipped: admin environment variables are not fully configured."
    );
    return null;
  }

  if (!isValidEmail(email)) {
    throw new Error(
      "BOOTSTRAP_ADMIN_EMAIL is invalid."
    );
  }

  if (!isValidMobile(mobile)) {
    throw new Error(
      "BOOTSTRAP_ADMIN_MOBILE is invalid."
    );
  }

  if (
    password.length < 8 ||
    password.length > 128
  ) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD must be between 8 and 128 characters."
    );
  }

  let admin = await User.findOne({
    $or: [
      { email },
      { mobile },
    ],
  }).select("+passwordHash");

  // Existing user
  if (admin) {
    let changed = false;

    if (admin.name !== name && name) {
      admin.name = name;
      changed = true;
    }

    if (admin.email !== email) {
      admin.email = email;
      changed = true;
    }

    if (
      !admin.mobile ||
      admin.mobile !== mobile
    ) {
      admin.mobile = mobile;
      changed = true;
    }

    if (admin.role !== "Admin") {
      admin.role = "Admin";
      changed = true;
    }

    if (!admin.isActive) {
      admin.isActive = true;
      changed = true;
    }

    /*
     * পুরোনো OTP user-এর passwordHash না থাকলে
     * এখন bootstrap password দিয়ে password তৈরি করবে।
     */
    if (!admin.passwordHash) {
      admin.passwordHash =
        await bcrypt.hash(
          password,
          BCRYPT_ROUNDS
        );

      admin.passwordChangedAt =
        new Date();

      changed = true;

      console.log(
        `Password initialized for existing admin: ${email}`
      );
    }

    if (changed) {
      await admin.save();
    }

    console.log(
      `Bootstrap admin ready: ${admin.email}`
    );

    return admin;
  }

  // New admin
  const passwordHash =
    await bcrypt.hash(
      password,
      BCRYPT_ROUNDS
    );

  admin = await User.create({
    name:
      name || "Administrator",

    email,

    mobile,

    passwordHash,

    role: "Admin",

    isVerified: true,

    isActive: true,

    passwordChangedAt: new Date(),
  });

  console.log(
    `Bootstrap admin created: ${admin.email}`
  );

  return admin;
}
