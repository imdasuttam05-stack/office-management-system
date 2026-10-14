import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Company from "../models/Company.js";

const companyId = process.env.MIGRATION_COMPANY_ID;
if (!companyId || !mongoose.isValidObjectId(companyId)) {
  console.error("Set MIGRATION_COMPANY_ID to the Company _id that should receive legacy records.");
  process.exit(1);
}
function fyFor(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return currentFY();
  const startYear = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
function currentFY() { return fyFor(new Date()); }
const yearScoped = new Set(["accountstransactions", "expenses", "vouchers", "rawmaterialpurchases", "inventorymovements", "joborders", "manufacturingjoborders", "productionentries", "inventoryworkflows", "salesinvoices", "gstledgers", "attendances", "leaves", "salaries", "employeetasks", "employeeletters", "payrolls"]);
const collections = ["accountsmasters", "accountstransactions", "expenses", "groups", "ledgers", "vouchers", "customermasters", "suppliermasters", "locationmasters", "inventoryitemmasters", "unitmasters", "rawmaterialpurchases", "inventorystocks", "inventorymovements", "joborders", "manufacturingjoborders", "productionentries", "boms", "inventoryworkflows", "salesinvoices", "stockitems", "gstledgers", "inventorycounters", "employees", "attendances", "attendancesettings", "leaves", "holidays", "salaries", "shifts", "payrollsettings", "employeetasks", "employeeletters", "payrolls"];
await connectDB();
const company = await Company.findById(companyId).lean();
if (!company) { console.error("Company not found:", companyId); process.exit(1); }
let total = 0;
for (const name of collections) {
  const collection = mongoose.connection.collection(name);
  const rows = await collection.find({ $or: [{ companyId: { $exists: false } }, { companyId: null }] }).project({ _id:1, date:1, createdAt:1, year:1, month:1 }).toArray();
  for (const row of rows) {
    const update = { companyId: new mongoose.Types.ObjectId(companyId) };
    if (yearScoped.has(name)) {
      if (name === "payrolls" && Number.isFinite(Number(row.year)) && Number.isFinite(Number(row.month))) {
        const startYear = Number(row.month) >= 4 ? Number(row.year) : Number(row.year) - 1;
        update.financialYear = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
      } else {
        update.financialYear = fyFor(row.date || row.createdAt);
      }
    }
    await collection.updateOne({ _id: row._id }, { $set: update });
  }
  if (rows.length) console.log(`${name}: assigned ${rows.length} legacy records to ${company.name}${yearScoped.has(name) ? " with date-based financial year" : ""}`);
  total += rows.length;
}
console.log(`Migration finished. Updated ${total} legacy records. Existing non-null companyId values were not changed.`);
await mongoose.disconnect();
