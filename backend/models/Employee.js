import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    pinCode: { type: String, trim: true, default: "" },
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
    grossSalary: { type: Number, default: 0, min: 0 },
    basicSalary: { type: Number, default: 0, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    da: { type: Number, default: 0, min: 0 },
    conveyance: { type: Number, default: 0, min: 0 },
    otherAllowance: { type: Number, default: 0, min: 0 },
    gratuityPercent: { type: Number, default: 4.81, min: 0 },
    gratuityAmount: { type: Number, default: 0, min: 0 },
    employerPfRate: { type: Number, default: 12, min: 0 },
    employerPfAmount: { type: Number, default: 0, min: 0 },
    employerEsiRate: { type: Number, default: 3.25, min: 0 },
    employerEsiAmount: { type: Number, default: 0, min: 0 },
    ctc: { type: Number, default: 0, min: 0 },
    professionalTax: { type: Number, default: 0, min: 0 },
    otherDeduction: { type: Number, default: 0, min: 0 },
    pfApplicable: { type: Boolean, default: false },
    pfRate: { type: Number, default: 12, min: 0 },
    pfAmount: { type: Number, default: 0, min: 0 },
    pfNumber: { type: String, trim: true, default: "" },
    esiApplicable: { type: Boolean, default: false },
    esiRate: { type: Number, default: 0.75, min: 0 },
    esiAmount: { type: Number, default: 0, min: 0 },
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
