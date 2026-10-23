import { writeAuditLog } from "../services/auditService.js";
import mongoose from "mongoose";

const objectIdPattern = /^[a-f\d]{24}$/i;

function resolveEntity(req) {
  const path = `${req.baseUrl || ""}${req.path || ""}`.replace(/\/+/g, "/");
  const bodyType = String(req.body?.masterType || "").toLowerCase();
  if (path.startsWith("/api/accounts-masters")) {
    const entity = bodyType || String(req.query?.type || "master").toLowerCase();
    return { entity: `ACCOUNTS_${entity.toUpperCase()}`, model: "AccountsMaster" };
  }
  const mappings = [
    [/\/inventory\/(?:masters\/)?suppliers(?:\/|$)/, "SupplierMaster"],
    [/\/inventory\/(?:masters\/)?customers(?:\/|$)/, "CustomerMaster"],
    [/\/inventory\/(?:masters\/)?locations(?:\/|$)/, "LocationMaster"],
    [/\/inventory\/(?:masters\/)?units(?:\/|$)/, "UnitMaster"],
    [/\/inventory\/(?:masters\/)?items(?:\/|$)/, "InventoryItemMaster"],
    [/\/inventory\/raw-material-purchases(?:\/|$)/, "RawMaterialPurchase"],
    [/\/inventory\/job-orders\/[^/]+\/returns/, "InventoryWorkflow"],
    [/\/inventory\/job-orders(?:\/|$)/, "ManufacturingJobOrder"],
    [/\/inventory\/production(?:\/|$)/, "ProductionEntry"],
    [/\/inventory\/sales(?:\/|$)/, "SalesInvoice"],
    [/\/inventory\/workflow\/packing-conversion-rates(?:\/|$)/, "PackingConversionRate"],
    [/\/inventory\/workflow\/packing-conversion(?:\/|$)/, "InventoryWorkflow"],
    [/\/inventory\/workflow\/bom-cost-items(?:\/|$)/, "BOMCostItemMaster"],
    [/\/inventory\/workflow\/boms(?:\/|$)/, "BOM"],
    [/\/inventory\/workflow\/(?:pi|returns|repack|damage)(?:\/|$)/, "InventoryWorkflow"],
    [/\/accounting\/groups(?:\/|$)/, "Group"],
    [/\/accounting\/ledgers(?:\/|$)/, "Ledger"],
    [/\/accounting\/vouchers(?:\/|$)/, "Voucher"],
    [/\/expenses(?:\/|$)/, "Expense"],
    [/\/(?:payroll\/)?employees(?:\/|$)/, "Employee"],
    [/\/(?:payroll\/)?employee-tasks(?:\/|$)/, "EmployeeTask"],
    [/\/(?:payroll\/)?employee-letters(?:\/|$)/, "EmployeeLetter"],
    [/\/(?:payroll\/)?attendance\/settings(?:\/|$)/, "AttendanceSetting"],
    [/\/(?:payroll\/)?attendance(?:\/|$)/, "Attendance"],
    [/\/(?:payroll\/)?shifts(?:\/|$)/, "Shift"],
    [/\/(?:payroll\/)?leaves(?:\/|$)/, "Leave"],
    [/\/(?:payroll\/)?holidays(?:\/|$)/, "Holiday"],
    [/\/(?:payroll\/)?companies?(?:\/|$)/, "Company"],
    [/\/(?:payroll\/)?options(?:\/|$)/, "PayrollSetting"],
    [/\/(?:payroll\/)?salaries(?:\/|$)/, "Salary"],
    [/\/payroll(?:\/|$)/, "Payroll"],
    [/\/financial-year\/(?:carry-forward|opening-balances)(?:\/|$)/, "OpeningBalanceSnapshot"],
    [/\/api\/users(?:\/|$)/, "User"],
  ];
  const match = mappings.find(([pattern]) => pattern.test(path));
  return match ? { entity: match[1].replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase(), model: match[1] } : { entity: path.split("/").filter(Boolean).slice(-1)[0]?.toUpperCase() || "BUSINESS_RECORD", model: "" };
}

function recordFromResponse(payload) {
  if (!payload || typeof payload !== "object") return null;
  for (const key of ["data", "item", "master", "production", "job", "expense", "payroll", "voucher", "group", "ledger", "company", "employee", "attendance", "shift", "leave", "holiday", "user"]) {
    const value = payload[key];
    if (value && typeof value === "object" && !Array.isArray(value) && (value._id || value.id)) return value._id ? value : {...value,_id:value.id};
  }
  return payload._id || payload.id ? (payload._id ? payload : {...payload,_id:payload.id}) : null;
}

export default function businessAudit(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const { entity, model } = resolveEntity(req);
  if (/\/(?:preview|calculate|lookup)(?:\/|$)/i.test(req.path)) return next();
  const id = req.params?.id || String(req.path || "").split("/").reverse().find(segment => objectIdPattern.test(segment));
  const beforePromise = req.method === "POST" ? Promise.resolve(null) : (async () => {
    const collectionModel = mongoose.models[model];
    if (!collectionModel || !id) return null;
    try {
      return await collectionModel.findById(id).lean();
    } catch (error) {
      console.error(`BUSINESS AUDIT SNAPSHOT ERROR (${entity}):`, error?.message || error);
      return null;
    }
  })();
  const sendJson = res.json.bind(res);
  let recorded = false;
  res.json = payload => {
    if (!recorded && res.statusCode >= 200 && res.statusCode < 300) {
      recorded = true;
      void (async()=>{
        const before = await beforePromise;
        const responseRecord = recordFromResponse(payload);
        const after = req.method === "DELETE" ? null : responseRecord || req.body || null;
        const recordId = responseRecord?._id || before?._id || (id && objectIdPattern.test(id) ? id : null);
        const operation = req.method === "POST" ? "CREATED" : req.method === "DELETE" ? "DELETED" : "UPDATED";
        const recordType = String(before?.masterType || responseRecord?.masterType || req.body?.masterType || "").toUpperCase();
        const finalEntity = entity === "ACCOUNTS_MASTER" && recordType ? `ACCOUNTS_${recordType}` : entity;
        await writeAuditLog({
          req,
          actorUser: req.user,
          action: `${finalEntity}_${operation}`,
          entity:finalEntity,
          entityId: recordId,
          metadata: {
            method: req.method,
            path: req.originalUrl,
            before,
            after,
            message: payload?.message || "",
          },
        });
        sendJson(payload);
      })().catch(error=>{
        console.error(`BUSINESS AUDIT WRITE ERROR (${entity}):`,error?.message||error);
        sendJson(payload);
      });
      return res;
    }
    return sendJson(payload);
  };
  return next();
}
