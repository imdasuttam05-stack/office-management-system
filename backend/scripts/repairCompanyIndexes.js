import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import connectDB from "../config/db.js";

// Prevent automatic index creation before legacy global unique indexes are removed.
mongoose.set("autoIndex", false);

if (process.env.ALLOW_COMPANY_INDEX_REBUILD !== "YES") {
  console.error("Safety stop: set ALLOW_COMPANY_INDEX_REBUILD=YES after backing up MongoDB and deciding how to handle old records.");
  process.exit(1);
}

await connectDB();

const modelFiles = [
  ["AccountsTransaction", "../models/AccountsTransaction.js", ["voucherNo_1"]],
  ["Voucher", "../models/Voucher.js", ["voucherNo_1"]],
  ["RawMaterialPurchase", "../models/RawMaterialPurchase.js", ["purchaseNo_1"]],
  ["JobOrder", "../models/JobOrder.js", ["jobNo_1"]],
  ["InventoryWorkflow", "../models/InventoryWorkflow.js", ["docNo_1"]],
  ["ManufacturingJobOrder", "../models/ManufacturingJobOrder.js", ["jobNo_1"]],
  ["ProductionEntry", "../models/ProductionEntry.js", ["productionNo_1"]],
  ["SalesInvoice", "../models/SalesInvoice.js", ["invoiceNo_1"]],
  ["Employee", "../models/Employee.js", ["employeeCode_1"]],
  ["Shift", "../models/Shift.js", ["name_1"]],
  ["Holiday", "../models/Holiday.js", ["date_1"]],
  ["Attendance", "../models/Attendance.js", ["employeeId_1_date_1"]],
  ["AttendanceSetting", "../models/AttendanceSetting.js", ["key_1"]],
  ["PayrollSetting", "../models/PayrollSetting.js", ["key_1"]],
  ["InventoryCounter", "../models/InventoryCounter.js", ["key_1"]],
  ["Group", "../models/Group.js", ["name_1_parent_1"]],
  ["Ledger", "../models/Ledger.js", ["name_1_group_1"]],
  ["StockItem", "../models/StockItem.js", ["name_1"]],
  ["Payroll", "../models/Payroll.js", ["employeeId_1_month_1_year_1"]],
  ["Salary", "../models/Salary.js", ["employeeId_1_month_1_year_1"]],
];

let dropped = 0;
for (const [name, file, oldIndexes] of modelFiles) {
  const module = await import(new URL(file, import.meta.url));
  const model = module.default;
  for (const indexName of oldIndexes) {
    try {
      await model.collection.dropIndex(indexName);
      console.log(`${name}: dropped legacy index ${indexName}`);
      dropped += 1;
    } catch (error) {
      if (!["IndexNotFound", "NamespaceNotFound", 27, 26].includes(error.code) && !/index not found|ns not found|namespace .* not found/i.test(error.message || "")) {
        throw error;
      }
    }
  }
}

for (const [name, file] of modelFiles.map(([name, file]) => [name, file])) {
  const module = await import(new URL(file, import.meta.url));
  await module.default.createIndexes();
  console.log(`${name}: company-aware indexes ensured`);
}

console.log(`Company-aware index repair finished. Legacy global indexes removed: ${dropped}.`);
await mongoose.disconnect();
