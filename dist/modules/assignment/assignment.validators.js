"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAssignmentQuerySchema = exports.assignmentIdParamSchema = exports.listAssignmentsQuerySchema = exports.updateAssignmentSchema = exports.createAssignmentSchema = void 0;
const zod_1 = require("zod");
const domain_1 = require("../../types/domain");
exports.createAssignmentSchema = zod_1.z.object({
    clientId: zod_1.z.string(),
    ruleGroupId: zod_1.z.string().uuid(),
    targetType: zod_1.z.enum(domain_1.ASSIGNMENT_TARGET_TYPES),
    targetIds: zod_1.z.array(zod_1.z.string().min(1)).min(1),
    priority: zod_1.z.number().int().default(0),
    effectiveFrom: zod_1.z.coerce.date(),
    effectiveTo: zod_1.z.coerce.date().nullable().optional(),
});
exports.updateAssignmentSchema = zod_1.z.object({
    targetIds: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    priority: zod_1.z.number().int().optional(),
    effectiveFrom: zod_1.z.coerce.date().optional(),
    effectiveTo: zod_1.z.coerce.date().nullable().optional(),
    status: zod_1.z.enum(["active", "scheduled", "expired"]).optional(),
});
exports.listAssignmentsQuerySchema = zod_1.z.object({
    clientId: zod_1.z.string().optional(),
    ruleGroupId: zod_1.z.string().uuid().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
exports.assignmentIdParamSchema = zod_1.z.object({
    assignmentId: zod_1.z.string(),
});
exports.resolveAssignmentQuerySchema = zod_1.z.object({
    clientId: zod_1.z.string(),
    employeeId: zod_1.z.string(),
    date: zod_1.z.coerce.date(),
    paygroupId: zod_1.z.string().optional(),
    locationId: zod_1.z.string().optional(),
    departmentId: zod_1.z.string().optional(),
    state: zod_1.z.string().length(2).optional(),
});
//# sourceMappingURL=assignment.validators.js.map