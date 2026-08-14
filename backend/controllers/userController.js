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

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128
  );
}

function userResponse(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt || null,
  };
}

// GET /api/users
export const listUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .sort({ createdAt: -1 });

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
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const mobile = normalizeMobile(req.body?.mobile);
    const password = String(req.body?.password || "");

    const role = [
      "Admin",
      "Manager",
      "Employee",
    ].includes(req.body?.role)
      ? req.body.role
      : "Employee";

    if (
      name.length < 2 ||
      !isValidEmail(email) ||
      !isValidMobile(mobile) ||
      !validPassword(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, valid email, valid mobile and password of at least 8 characters are required.",
      });
    }

    const existing = await User.findOne({
      $or: [
        { email },
        { mobile },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "A user with this email or mobile already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      BCRYPT_ROUNDS
    );

    const user = await User.create({
      name,
      email,
      mobile,
      passwordHash,
      role,
      isVerified: true,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: userResponse(user),
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

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

    const user = await User.findById(id)
      .select("+passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const name = String(
      req.body?.name ?? user.name
    ).trim();

    const email = normalizeEmail(
      req.body?.email ?? user.email
    );

    const mobile = normalizeMobile(
      req.body?.mobile ?? user.mobile
    );

    const role = [
      "Admin",
      "Manager",
      "Employee",
    ].includes(req.body?.role)
      ? req.body.role
      : user.role;

    const isActive =
      typeof req.body?.isActive === "boolean"
        ? req.body.isActive
        : user.isActive;

    const password =
      req.body?.password == null
        ? ""
        : String(req.body.password);

    if (
      name.length < 2 ||
      !isValidEmail(email) ||
      !isValidMobile(mobile)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid name, email or mobile number.",
      });
    }

    if (
      password &&
      !validPassword(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters.",
      });
    }

    const duplicate = await User.findOne({
      _id: { $ne: id },
      $or: [
        { email },
        { mobile },
      ],
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "Email or mobile already belongs to another user.",
      });
    }

    user.name = name;
    user.email = email;
    user.mobile = mobile;
    user.role = role;
    user.isActive = isActive;

    if (password) {
      user.passwordHash =
        await bcrypt.hash(
          password,
          BCRYPT_ROUNDS
        );

      user.passwordChangedAt =
        new Date();
    }

    await user.save();

    return res.json({
      success: true,
      message: "User updated successfully.",
      user: userResponse(user),
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update user.",
    });
  }
};
