"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectPolicySchema = exports.clonePolicySchema = exports.policyIdParamSchema = exports.listPoliciesQuerySchema = exports.updatePolicySchema = exports.createPolicySchema = void 0;
const zod_1 = require("zod");
const domain_1 = require("../../types/domain");
const jurisdictionSchema = zod_1.z.object({
    country: zod_1.z.string().default("US"),
    state: zod_1.z.string().length(2).nullable().optional(),
    county: zod_1.z.string().nullable().optional(),
    city: zod_1.z.string().nullable().optional(),
});
exports.createPolicySchema = zod_1.z.object({
    scope: zod_1.z.enum(domain_1.POLICY_SCOPES),
    clientId: zod_1.z.string().optional(),
    policyType: zod_1.z.enum(domain_1.POLICY_TYPES),
    jurisdiction: jurisdictionSchema.optional(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    effectiveFrom: zod_1.z.coerce.date(),
    // Shape validated per-policyType by the Mongoose discriminator schema on save.
    rules: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
});
exports.updatePolicySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    effectiveFrom: zod_1.z.coerce.date(),
    jurisdiction: jurisdictionSchema.optional(),
    rules: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.listPoliciesQuerySchema = zod_1.z.object({
    policyType: zod_1.z.enum(domain_1.POLICY_TYPES).optional(),
    clientId: zod_1.z.string().optional(),
    scope: zod_1.z.enum(domain_1.POLICY_SCOPES).optional(),
    state: zod_1.z.string().length(2).optional(),
    status: zod_1.z.string().optional(),
    effectiveOn: zod_1.z.coerce.date().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
exports.policyIdParamSchema = zod_1.z.object({
    policyId: zod_1.z.string().uuid(),
});
exports.clonePolicySchema = zod_1.z.object({
    clientId: zod_1.z.string(),
    effectiveFrom: zod_1.z.coerce.date().optional(),
});
exports.rejectPolicySchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).optional(),
});
//# sourceMappingURL=policy.validators.js.map