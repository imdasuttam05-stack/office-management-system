import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    mobile: { type: String, trim: true, default: "" },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ["", "Male", "Female", "Other"], default: "" },
    address: { type: String, trim: true, default: "" },
    department: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    employeeType: { type: String, trim: true, default: "Permanent" },
    joiningDate: { type: Date, required: true },

    // Payroll / salary structure
    basicSalary: { type: Number, default: 0, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    da: { type: Number, default: 0, min: 0 },
    conveyance: { type: Number, default: 0, min: 0 },
    otherAllowance: { type: Number, default: 0, min: 0 },
    professionalTax: { type: Number, default: 0, min: 0 },
    otherDeduction: { type: Number, default: 0, min: 0 },
    pfApplicable: { type: Boolean, default: false },
    pfNumber: { type: String, trim: true, default: "" },
    esiApplicable: { type: Boolean, default: false },
    esiNumber: { type: String, trim: true, default: "" },
    allowances: { type: Map, of: Number, default: {} },

    // Statutory / identity details
    aadhaarNo: { type: String, trim: true, default: "" },
    panNo: { type: String, trim: true, uppercase: true, default: "" },
    uanNo: { type: String, trim: true, default: "" },

    // Bank details
    bankName: { type: String, trim: true, default: "" },
    accountHolderName: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    ifscCode: { type: String, trim: true, uppercase: true, default: "" },
    branchName: { type: String, trim: true, default: "" },
    accountType: { type: String, enum: ["", "Savings", "Current", "Salary"], default: "" },

    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

export default mongoose.model("Employee", employeeSchema);
