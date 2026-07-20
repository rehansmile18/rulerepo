import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { asyncHandler } from "../../middleware/errorHandler";
import { AuditLog } from "../../models/auditLog.model";

const listAuditLogsQuerySchema = z.object({
  entityType: z.enum(["policy", "ruleGroup", "assignment"]).optional(),
  entityId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const auditLogRouter = Router();
// Audit trail spans all clients — restricted to platform admins.
auditLogRouter.use(authenticate, requireRole("PLATFORM_ADMIN"));

auditLogRouter.get(
  "/audit-logs",
  validateRequest({ query: listAuditLogsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { entityType, entityId, page, pageSize } = req.query as unknown as {
      entityType?: string;
      entityId?: string;
      page: number;
      pageSize: number;
    };
    const query: Record<string, unknown> = {};
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    const [items, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      AuditLog.countDocuments(query),
    ]);
    res.json({ items, total, page, pageSize });
  })
);
