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
  for (const key of ["data", "item", "master", "production", "job", "expense", "payroll", "voucher", "group", "ledger", "company", "employee", "attendance", "shift", "leave", "holiday", "user", "purchase", "sale", "document", "result"]) {
    const value = payload[key];
    if (value && typeof value === "object" && !Array.isArray(value) && (value._id || value.id)) return value._id ? value : {...value,_id:value.id};
  }
  return payload._id || payload.id ? (payload._id ? payload : {...payload,_id:payload.id}) : null;
}

async function readAuditSnapshot(modelName, id, entity) {
  const model = mongoose.models[modelName];
  if (!model || !id) return null;
  try {
    const snapshot = await model.findById(id).lean();
    if (!snapshot) return null;
    if (modelName === "Voucher") {
      const ledgerIds = [...new Set([
        snapshot.partyLedger,
        ...(snapshot.lines || []).map(line => line.ledger),
      ].filter(Boolean).map(String))];
      const Ledger = mongoose.models.Ledger;
      const ledgers = Ledger && ledgerIds.length
        ? await Ledger.find({ _id: { $in: ledgerIds } }).select("name").lean()
        : [];
      const names = new Map(ledgers.map(ledger => [String(ledger._id), ledger.name]));
      snapshot.partyLedgerName = names.get(String(snapshot.partyLedger)) || "";
      snapshot.lines = (snapshot.lines || []).map(line => ({
        ...line,
        ledgerName: names.get(String(line.ledger)) || "",
      }));
    } else if (modelName === "Ledger" && snapshot.group) {
      const Group = mongoose.models.Group;
      const group = Group ? await Group.findById(snapshot.group).select("name").lean() : null;
      snapshot.groupName = group?.name || "";
    }
    return snapshot;
  } catch (error) {
    console.error(`BUSINESS AUDIT SNAPSHOT ERROR (${entity}):`, error?.message || error);
    return null;
  }
}

function labelForRecord(record, entity) {
  if (!record) return "";
  const identity = record.voucherNo || record.productionNo || record.jobNo || record.docNo ||
    record.purchaseNo || record.invoiceNo || record.employeeCode || record.name ||
    record.itemName || record.referenceNo || record._id || "";
  return identity ? `${entity.replaceAll("_", " ")} · ${identity}` : "";
}

export default function businessAudit(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const { entity, model } = resolveEntity(req);
  if (/\/(?:preview|calculate|lookup)(?:\/|$)/i.test(req.path)) return next();
  const id = req.params?.id || String(req.path || "").split("/").reverse().find(segment => objectIdPattern.test(segment));
  const beforePromise = req.method === "POST" ? Promise.resolve(null) : readAuditSnapshot(model, id, entity);
  const sendJson = res.json.bind(res);
  let recorded = false;
  res.json = payload => {
    if (!recorded && res.statusCode >= 200 && res.statusCode < 300) {
      recorded = true;
      void (async()=>{
        const before = await beforePromise;
        const responseRecord = recordFromResponse(payload);
        const recordId = responseRecord?._id || before?._id || (id && objectIdPattern.test(id) ? id : null);
        const operation = req.method === "POST" ? "CREATED" : req.method === "DELETE" ? "DELETED" : "UPDATED";
        const recordType = String(before?.masterType || responseRecord?.masterType || req.body?.masterType || "").toUpperCase();
        const finalEntity = entity === "ACCOUNTS_MASTER" && recordType ? `ACCOUNTS_${recordType}` : entity;
        const persistedAfter = await readAuditSnapshot(model, recordId, finalEntity);
        const after = req.method === "DELETE"
          ? persistedAfter
          : persistedAfter || responseRecord || req.body || null;
        await writeAuditLog({
          req,
          actorUser: req.user,
          action: `${finalEntity}_${operation}`,
          entity:finalEntity,
          entityId: recordId,
          metadata: {
            method: req.method,
            path: req.originalUrl,
            recordLabel: labelForRecord(after || before || responseRecord, finalEntity),
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
