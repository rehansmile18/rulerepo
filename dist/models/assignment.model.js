"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Assignment = void 0;
const mongoose_1 = require("mongoose");
const domain_1 = require("../types/domain");
const assignmentSchema = new mongoose_1.Schema({
    clientId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Client", required: true },
    ruleGroupId: { type: String, required: true },
    targetType: { type: String, enum: domain_1.ASSIGNMENT_TARGET_TYPES, required: true },
    targetIds: { type: [String], required: true, validate: (v) => v.length > 0 },
    priority: { type: Number, required: true, default: 0 },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    status: { type: String, enum: domain_1.ASSIGNMENT_STATUSES, required: true, default: "active" },
}, { collection: "assignments" });
assignmentSchema.index({ clientId: 1, targetType: 1, targetIds: 1 });
assignmentSchema.index({ clientId: 1, ruleGroupId: 1 });
exports.Assignment = (0, mongoose_1.model)("Assignment", assignmentSchema);
//# sourceMappingURL=assignment.model.js.map