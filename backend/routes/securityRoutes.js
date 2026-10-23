import express from "express";
import auth from "../middleware/auth.js";
import requirePermission from "../middleware/permission.js";
import RefreshToken from "../models/RefreshToken.js";
import AuditLog from "../models/AuditLog.js";
import { writeAuditLog } from "../services/auditService.js";
import mongoose from "mongoose";

const router = express.Router();

router.use(auth);

const auditCategories = {
  purchase: {paths:[/\/inventory\/raw-material-purchases(?:\/|$)/]},
  sale: {paths:[/\/inventory\/sales(?:\/|$)/]},
  jobOrder: {paths:[/\/inventory\/job-orders(?:\/|$)/],exclude:[/\/inventory\/job-orders\/[^/]+\/returns(?:\/|$)/]},
  jobOrderReport: {paths:[/\/inventory\/job-orders\/report(?:\/|$)/]},
  production: {paths:[/\/inventory\/production(?:\/|$)/],jobType:"NOT_GRADING"},
  grading: {paths:[/\/inventory\/production(?:\/|$)/],jobType:"GRADING"},
  pi: {paths:[/\/inventory\/workflow\/pi(?:\/|$)/]},
  return: {paths:[/\/inventory\/workflow\/returns(?:\/|$)/,/\/inventory\/job-orders\/[^/]+\/returns(?:\/|$)/]},
  damage: {paths:[/\/inventory\/workflow\/damage(?:\/|$)/]},
  repacking: {paths:[/\/inventory\/workflow\/repack(?:\/|$)/]},
  packingConversion: {paths:[/\/inventory\/workflow\/packing-conversion(?:\/|$)/]},
  bomCosting: {paths:[/\/inventory\/workflow\/(?:boms|bom-cost-items|costing)(?:\/|$)/]},
  stockLedger: {paths:[/\/inventory\/(?:stock|raw-material-stock)(?:\/|$)/,/\/inventory\/workflow\/stock-ledger(?:\/|$)/,/\/accounting\/(?:groups|ledgers|vouchers)(?:\/|$)/]},
  masters: {paths:[/\/api\/accounts-masters(?:\/|$)/,/\/inventory\/masters\/(?:suppliers|customers|locations|units|items)(?:\/|$)/]},
  documents: {paths:[/\/inventory\/workflow\/(?:pi|returns|repack|damage|packing-conversion)(?:\/|$)/,/\/inventory\/job-orders\/[^/]+\/returns(?:\/|$)/]},
};

function auditCategoryMatch(category) {
  const definition = auditCategories[category];
  if (!definition) return null;
  const pathConditions = [
    definition.paths.length === 1
      ? {"metadata.path":{$regex:definition.paths[0].source,$options:"i"}}
      : {$or:definition.paths.map(path => ({"metadata.path":{$regex:path.source,$options:"i"}}))},
  ];
  if (definition.exclude?.length) {
    pathConditions.push({
      $nor:definition.exclude.map(path => ({"metadata.path":{$regex:path.source,$options:"i"}})),
    });
  }
  if (definition.jobType === "GRADING") {
    pathConditions.push({$or:[{"metadata.before.jobType":"GRADING"},{"metadata.after.jobType":"GRADING"}]});
  } else if (definition.jobType === "NOT_GRADING") {
    pathConditions.push({
      $and:[
        {"metadata.before.jobType":{$ne:"GRADING"}},
        {"metadata.after.jobType":{$ne:"GRADING"}},
      ],
    });
  }
  return pathConditions.length === 1 ? pathConditions[0] : {$and:pathConditions};
}

function auditCompanyFilter(req) {
  const companyId = String(req.get("X-Company-Id") || req.user?.companyId || "").trim();
  if (!mongoose.isValidObjectId(companyId)) throw new Error("Select a valid company to view audit records.");
  return {companyId:new mongoose.Types.ObjectId(companyId)};
}

// GET /api/security/sessions
router.get(
  "/sessions",
  requirePermission("security.sessions"),
  async (req, res) => {
    try {
      const sessions = await RefreshToken.find({
        userId: req.user._id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
        .select(
          "sessionId userAgent ip createdAt lastUsedAt lastUsedIp expiresAt"
        )
        .sort({ lastUsedAt: -1 })
        .lean();

      const unique = new Map();
      for (const session of sessions) {
        if (!unique.has(session.sessionId)) {
          unique.set(session.sessionId, session);
        }
      }

      return res.json({
        success: true,
        sessions: [...unique.values()],
      });
    } catch (error) {
      console.error("LIST SESSIONS ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load active sessions.",
      });
    }
  }
);

// DELETE /api/security/sessions/:sessionId
router.delete(
  "/sessions/:sessionId",
  requirePermission("security.sessions"),
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId || sessionId.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Invalid session id.",
        });
      }

      const result = await RefreshToken.updateMany(
        {
          userId: req.user._id,
          sessionId,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
            revokedReason: "revoked_by_user",
          },
        }
      );

      await writeAuditLog({
        req,
        actorUser: req.user,
        action: "SESSION_REVOKED",
        entity: "RefreshToken",
        metadata: {
          sessionId,
          modified: result.modifiedCount,
        },
      });

      return res.json({
        success: true,
        message: "Session revoked successfully.",
      });
    } catch (error) {
      console.error("REVOKE SESSION ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to revoke session.",
      });
    }
  }
);

// GET /api/security/audit-logs?limit=50&page=1
router.get(
  "/audit-log-summary",
  requirePermission("security.audit"),
  async (req, res) => {
    try {
      const year = Number(req.query.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(400).json({success:false,message:"Enter a valid audit report year."});
      }
      const companyFilter = auditCompanyFilter(req);
      const start = new Date(`${year}-04-01T00:00:00+05:30`);
      const end = new Date(`${year+1}-04-01T00:00:00+05:30`);
      const summary = {};
      await Promise.all(Object.keys(auditCategories).map(async category => {
        const categoryMatch = auditCategoryMatch(category);
        const rows = await AuditLog.aggregate([
          {$match:{$and:[companyFilter,categoryMatch,{createdAt:{$gte:start,$lt:end}}]}},
          {$project:{
            month:{$dateToString:{format:"%Y-%m",date:"$createdAt",timezone:"Asia/Kolkata"}},
            activityType:{$switch:{
              branches:[
                {case:{$or:[
                  {$eq:["$metadata.after.status","CANCELLED"]},
                  {$eq:["$metadata.after.status","CANCELED"]},
                  {$regexMatch:{input:{$ifNull:["$metadata.message",""]},regex:"cancel",options:"i"}},
                ]},then:"cancelled"},
                {case:{$regexMatch:{input:{$ifNull:["$action",""]},regex:"DELETED",options:"i"}},then:"deleted"},
                {case:{$regexMatch:{input:{$ifNull:["$action",""]},regex:"UPDATED",options:"i"}},then:"edited"},
              ],
              default:"created",
            }},
          }},
          {$group:{_id:{month:"$month",activityType:"$activityType"},count:{$sum:1}}},
        ]);
        summary[category] = rows.map(row => ({month:row._id.month,activityType:row._id.activityType,count:row.count}));
      }));
      return res.json({success:true,year,summary});
    } catch (error) {
      console.error("AUDIT SUMMARY ERROR:", error);
      return res.status(500).json({success:false,message:error.message||"Unable to load monthly audit counts."});
    }
  }
);

router.get(
  "/audit-logs",
  requirePermission("security.audit"),
  async (req, res) => {
    try {
      const rawLimit = Number(req.query.limit || 50);
      const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50));
      const rawPage = Number(req.query.page || 1);
      const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
      const skip = (page - 1) * limit;
      const filter = auditCompanyFilter(req);
      const category = String(req.query.category || "").trim();
      if (category) {
        const categoryMatch = auditCategoryMatch(category);
        if (!categoryMatch) return res.status(400).json({success:false,message:"Select a valid audit category."});
        filter.$and = [...(filter.$and||[]),categoryMatch];
      }
      for (const field of ["action", "entity"]) {
        const value = String(req.query[field] || "").trim();
        if (value) filter[field] = {$regex:value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),$options:"i"};
      }
      if (req.query.actorUser) filter.actorUser = req.query.actorUser;
      const from = String(req.query.from || "").trim(), to = String(req.query.to || "").trim();
      const month = String(req.query.month || "").trim();
      if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({success:false,message:"Select a valid audit report month."});
      }
      if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
        return res.status(400).json({success:false,message:"Enter valid audit report dates."});
      }
      const fromDate=from?new Date(`${from}T00:00:00.000Z`):null,toDate=to?new Date(`${to}T00:00:00.000Z`):null;
      if ((fromDate&&(!Number.isFinite(fromDate.getTime())||fromDate.toISOString().slice(0,10)!==from)) || (toDate&&(!Number.isFinite(toDate.getTime())||toDate.toISOString().slice(0,10)!==to))) {
        return res.status(400).json({success:false,message:"Enter valid audit report dates."});
      }
      if(fromDate&&toDate&&toDate<fromDate)return res.status(400).json({success:false,message:"End date must be on or after start date."});
      if (month) {
        const monthStart = new Date(`${month}-01T00:00:00+05:30`);
        const [monthYear, monthNumber] = month.split("-").map(Number);
        const nextMonth = new Date(Date.UTC(monthYear,monthNumber,1));
        const monthEnd = new Date(`${nextMonth.toISOString().slice(0,7)}-01T00:00:00+05:30`);
        filter.createdAt = {$gte:monthStart,$lt:monthEnd};
      }
      if (fromDate || toDate) filter.createdAt = {...(fromDate?{$gte:fromDate}:{}),...(toDate?{$lt:new Date(toDate.getTime()+86400000)}:{})};
      const search = String(req.query.search || "").trim();
      if (search) {
        const expression = {$regex:search.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),$options:"i"};
        filter.$and = [...(filter.$and||[]),{$or:[
          {action:expression},{entity:expression},{actorName:expression},{actorEmail:expression},
          {"metadata.path":expression},{"metadata.message":expression},{"metadata.recordLabel":expression},
          ...["voucherNo","productionNo","jobNo","docNo","invoiceNo","purchaseNo","name","partyName","itemName"].flatMap(field=>[
            {[`metadata.before.${field}`]:expression},{[`metadata.after.${field}`]:expression},
          ]),
          {"metadata.before.lines.ledgerName":expression},{"metadata.after.lines.ledgerName":expression},
          {"metadata.before.outputItems.itemName":expression},{"metadata.after.outputItems.itemName":expression},
        ]}];
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .populate("actorUser", "name email role isMainAdmin")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("LIST AUDIT LOGS ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load audit logs.",
      });
    }
  }
);

export default router;
