import mongoose from "mongoose";
import { getCompanyScope } from "../middleware/companyContext.js";

/** Adds server-enforced company isolation to business models. Set schema.options.companyYearScoped=true
 * for dated transactions; master/current-balance models are company-only. */
export default function companyScopePlugin(schema, options = {}) {
  if (!schema.path("companyId")) schema.add({ companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true } });
  const yearScoped = options.financialYear !== false;
  if (yearScoped && !schema.path("financialYear")) schema.add({ financialYear: { type: String, default: null, index: true } });
  const applyScope = function() {
    const scope = getCompanyScope();
    if (!scope) return;
    const match = { companyId: new mongoose.Types.ObjectId(scope.companyId) };
    if (yearScoped) match.financialYear = scope.financialYear;
    this.setQuery({ $and: [this.getQuery(), match] });
    const update = this.getUpdate();
    if (update && typeof update === "object") {
      const scopedValues = { companyId: match.companyId, ...(yearScoped ? { financialYear: scope.financialYear } : {}) };
      const isOperatorUpdate = Object.keys(update).some((key) => key.startsWith("$"));
      if (isOperatorUpdate) {
        if (this.getOptions().upsert) {
          update.$set = { ...(update.$set || {}) };
          update.$setOnInsert = { ...(update.$setOnInsert || {}), ...scopedValues };
          for (const key of Object.keys(scopedValues)) {
            delete update.$set[key];
            if (update.$unset) delete update.$unset[key];
          }
        } else {
          update.$set = { ...(update.$set || {}), ...scopedValues };
          if (update.$unset) {
            for (const key of Object.keys(scopedValues)) delete update.$unset[key];
          }
        }
      } else {
        Object.assign(update, scopedValues);
      }
      this.setUpdate(update);
    }
  };
  ["find", "findOne", "countDocuments", "updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndUpdate", "findOneAndDelete", "replaceOne", "distinct"].forEach((op) => {
    schema.pre(op, applyScope);
  });
  schema.pre("aggregate", function() {
    const scope = getCompanyScope(); if (!scope) return;
    const match = { companyId: new mongoose.Types.ObjectId(scope.companyId) };
    if (yearScoped) match.financialYear = scope.financialYear;
    this.pipeline().unshift({ $match: match });
  });
  schema.pre("save", function(next) {
    const scope = getCompanyScope();
    if (scope) {
      // Never trust company/year values sent by the browser or stored in an update payload.
      this.companyId = scope.companyId;
      if (yearScoped) this.financialYear = scope.financialYear;
    }
    next();
  });
  schema.pre("insertMany", function(next, docs) {
    const scope = getCompanyScope();
    if (scope) for (const doc of docs || []) { doc.companyId = scope.companyId; if (yearScoped) doc.financialYear = scope.financialYear; }
    next();
  });
}
