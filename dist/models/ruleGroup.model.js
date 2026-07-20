"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleGroup = void 0;
const mongoose_1 = require("mongoose");
const uuid_1 = require("uuid");
const domain_1 = require("../types/domain");
const policyRefSchema = new mongoose_1.Schema({
    policyId: { type: String, required: true },
    policyType: { type: String, enum: domain_1.POLICY_TYPES, required: true },
    versionPin: { type: mongoose_1.Schema.Types.Mixed, required: true, default: "latest" },
}, { _id: false });
const ruleGroupSchema = new mongoose_1.Schema({
    ruleGroupId: { type: String, required: true, default: () => (0, uuid_1.v4)() },
    clientId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Client", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    version: { type: Number, required: true, default: 1 },
    status: { type: String, enum: domain_1.RULE_GROUP_STATUSES, required: true, default: "draft" },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    policyRefs: { type: [policyRefSchema], required: true, default: [] },
    metadata: {
        createdBy: { type: String, required: true },
        createdAt: { type: Date, required: true, default: () => new Date() },
        updatedBy: { type: String, required: true },
        updatedAt: { type: Date, required: true, default: () => new Date() },
    },
}, { collection: "ruleGroups" });
ruleGroupSchema.index({ ruleGroupId: 1, version: -1 }, { unique: true });
ruleGroupSchema.index({ clientId: 1, status: 1 });
exports.RuleGroup = (0, mongoose_1.model)("RuleGroup", ruleGroupSchema);
//# sourceMappingURL=ruleGroup.model.js.map