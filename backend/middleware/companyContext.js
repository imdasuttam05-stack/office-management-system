import mongoose from "mongoose";
import { AsyncLocalStorage } from "node:async_hooks";
import Company from "../models/Company.js";

export const companyScopeStorage = new AsyncLocalStorage();
export function getCompanyScope() { return companyScopeStorage.getStore() || null; }

// Apply this middleware after auth on business-data routers. Company selection endpoints
// remain outside it so a user can create/select a company before starting work.
export default async function requireCompanyContext(req, res, next) {
  try {
    const companyId = String(req.get("X-Company-Id") || "").trim();
    const financialYear = String(req.get("X-Financial-Year") || "").trim();
    if (!mongoose.isValidObjectId(companyId)) return res.status(428).json({ success:false, code:"COMPANY_REQUIRED", message:"Select a company before entering business data." });
    if (!/^\d{4}-\d{2}$/.test(financialYear)) return res.status(428).json({ success:false, code:"FINANCIAL_YEAR_REQUIRED", message:"Select a valid financial year before entering business data." });
    const company = await Company.findOne({ _id: companyId, status: "Active" }).select("_id name status").lean();
    if (!company) return res.status(403).json({ success:false, code:"INVALID_COMPANY", message:"Selected company is not active or does not exist." });
    // Keep legacy controllers that already filter req.user.companyId compatible.
    if (req.user) req.user = { ...req.user, companyId: company._id, companyName: company.name, financialYear };
    req.company = company; req.financialYear = financialYear;
    return companyScopeStorage.run({ companyId: String(company._id), financialYear }, () => next());
  } catch (error) { return next(error); }
}
