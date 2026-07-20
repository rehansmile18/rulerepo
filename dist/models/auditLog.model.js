"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
exports.recordAudit = recordAudit;
const mongoose_1 = require("mongoose");
const auditLogSchema = new mongoose_1.Schema({
    entityType: { type: String, enum: ["policy", "ruleGroup", "assignment", "user"], required: true },
    entityId: { type: String, required: true },
    action: {
        type: String,
        enum: ["create", "update", "publish", "archive", "clone", "submit_for_approval", "approve", "reject", "login"],
        required: true,
    },
    actorId: { type: String, required: true },
    before: { type: mongoose_1.Schema.Types.Mixed, default: null },
    after: { type: mongoose_1.Schema.Types.Mixed, default: null },
    timestamp: { type: Date, required: true, default: () => new Date() },
}, { collection: "auditLogs" });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
exports.AuditLog = (0, mongoose_1.model)("AuditLog", auditLogSchema);
async function recordAudit(entry) {
    await exports.AuditLog.create({ ...entry, timestamp: new Date() });
}
//# sourceMappingURL=auditLog.model.js.map