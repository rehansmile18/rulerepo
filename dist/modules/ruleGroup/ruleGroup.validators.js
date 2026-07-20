"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ruleGroupIdParamSchema = exports.listRuleGroupsQuerySchema = exports.updateRuleGroupSchema = exports.createRuleGroupSchema = void 0;
const zod_1 = require("zod");
const domain_1 = require("../../types/domain");
const policyRefSchema = zod_1.z.object({
    policyId: zod_1.z.string().uuid(),
    policyType: zod_1.z.enum(domain_1.POLICY_TYPES),
    versionPin: zod_1.z.union([zod_1.z.literal("latest"), zod_1.z.number().int().min(1)]).default("latest"),
});
exports.createRuleGroupSchema = zod_1.z.object({
    clientId: zod_1.z.string(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    effectiveFrom: zod_1.z.coerce.date(),
    policyRefs: zod_1.z.array(policyRefSchema).min(1),
});
exports.updateRuleGroupSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    effectiveFrom: zod_1.z.coerce.date(),
    policyRefs: zod_1.z.array(policyRefSchema).min(1).optional(),
});
exports.listRuleGroupsQuerySchema = zod_1.z.object({
    clientId: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
exports.ruleGroupIdParamSchema = zod_1.z.object({
    ruleGroupId: zod_1.z.string().uuid(),
});
//# sourceMappingURL=ruleGroup.validators.js.map