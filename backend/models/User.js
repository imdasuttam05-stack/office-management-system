import mongoose from "mongoose";

const objectId = mongoose.Schema.Types.ObjectId;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: false,
      select: false,
    },

    // Kept compatible with the existing project.
    // Existing values: Admin / Manager / Employee.
    role: {
      type: String,
      enum: [
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
      ],
      default: "Employee",
      index: true,
    },

    // Main Admin is intentionally a separate flag.
    // This prevents every normal Admin from becoming Main Admin.
    isMainAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },

    permissions: {
      type: [String],
      default: [],
    },

    // Optional data-scope fields for the later ERP modules.
    companyId: {
      type: objectId,
      default: null,
      index: true,
    },

    branchId: {
      type: objectId,
      default: null,
      index: true,
    },

    warehouseIds: {
      type: [objectId],
      default: [],
      index: true,
    },

    department: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    employeeId: {
      type: objectId,
      default: null,
      index: true,
    },

    createdBy: {
      type: objectId,
      ref: "User",
      default: null,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockedUntil: {
      type: Date,
      default: null,
      index: true,
    },

    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    lastLoginIp: {
      type: String,
      default: "",
      maxlength: 100,
    },

    lastLoginUserAgent: {
      type: String,
      default: "",
      maxlength: 500,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

userSchema.index({ role: 1, isActive: 1 });

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

export default User;
