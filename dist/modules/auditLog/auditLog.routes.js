"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const validateRequest_1 = require("../../middleware/validateRequest");
const errorHandler_1 = require("../../middleware/errorHandler");
const auditLog_model_1 = require("../../models/auditLog.model");
const listAuditLogsQuerySchema = zod_1.z.object({
    entityType: zod_1.z.enum(["policy", "ruleGroup", "assignment"]).optional(),
    entityId: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
exports.auditLogRouter = (0, express_1.Router)();
// Audit trail spans all clients — restricted to platform admins.
exports.auditLogRouter.use(auth_1.authenticate, (0, auth_1.requireRole)("PLATFORM_ADMIN"));
exports.auditLogRouter.get("/audit-logs", (0, validateRequest_1.validateRequest)({ query: listAuditLogsQuerySchema }), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { entityType, entityId, page, pageSize } = req.query;
    const query = {};
    if (entityType)
        query.entityType = entityType;
    if (entityId)
        query.entityId = entityId;
    const [items, total] = await Promise.all([
        auditLog_model_1.AuditLog.find(query).sort({ timestamp: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        auditLog_model_1.AuditLog.countDocuments(query),
    ]);
    res.json({ items, total, page, pageSize });
}));
//# sourceMappingURL=auditLog.routes.js.map