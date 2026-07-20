"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAssignments = listAssignments;
exports.getAssignment = getAssignment;
exports.createAssignment = createAssignment;
exports.updateAssignment = updateAssignment;
exports.resolveAssignment = resolveAssignment;
const mongoose_1 = require("mongoose");
const assignment_model_1 = require("../../models/assignment.model");
const ruleGroup_model_1 = require("../../models/ruleGroup.model");
const auditLog_model_1 = require("../../models/auditLog.model");
const ruleGroup_service_1 = require("../ruleGroup/ruleGroup.service");
const errors_1 = require("../../utils/errors");
const domain_1 = require("../../types/domain");
async function listAssignments(tenantFilter, ruleGroupId, page, pageSize) {
    const query = { ...tenantFilter };
    if (ruleGroupId)
        query.ruleGroupId = ruleGroupId;
    const [items, total] = await Promise.all([
        assignment_model_1.Assignment.find(query).skip((page - 1) * pageSize).limit(pageSize).lean(),
        assignment_model_1.Assignment.countDocuments(query),
    ]);
    return { items, total, page, pageSize };
}
async function getAssignment(assignmentId, tenantFilter) {
    const doc = await assignment_model_1.Assignment.findOne({ _id: assignmentId, ...tenantFilter }).lean();
    if (!doc)
        throw new errors_1.NotFoundError(`Assignment ${assignmentId} not found`);
    return doc;
}
async function createAssignment(input, actorId) {
    const doc = await assignment_model_1.Assignment.create({
        clientId: new mongoose_1.Types.ObjectId(input.clientId),
        ruleGroupId: input.ruleGroupId,
        targetType: input.targetType,
        targetIds: input.targetIds,
        priority: input.priority,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        status: "active",
    });
    await (0, auditLog_model_1.recordAudit)({ entityType: "assignment", entityId: String(doc._id), action: "create", actorId, before: null, after: doc.toObject() });
    return doc;
}
async function updateAssignment(assignmentId, input, tenantFilter, actorId) {
    const doc = await assignment_model_1.Assignment.findOne({ _id: assignmentId, ...tenantFilter });
    if (!doc)
        throw new errors_1.NotFoundError(`Assignment ${assignmentId} not found`);
    const before = doc.toObject();
    Object.assign(doc, input);
    await doc.save();
    await (0, auditLog_model_1.recordAudit)({ entityType: "assignment", entityId: assignmentId, action: "update", actorId, before, after: doc.toObject() });
    return doc;
}
const TARGET_ID_BY_TYPE = {
    EMPLOYEE: "employeeId",
    PAYGROUP: "paygroupId",
    LOCATION: "locationId",
    DEPARTMENT: "departmentId",
    STATE: "state",
};
/**
 * Resolves the single most-specific active assignment for a worker on a given date,
 * then expands it into the concrete policies effective on that date.
 * Specificity order: EMPLOYEE > PAYGROUP > LOCATION > DEPARTMENT > STATE, tie-broken by priority.
 */
async function resolveAssignment(params) {
    const candidates = await assignment_model_1.Assignment.find({
        clientId: new mongoose_1.Types.ObjectId(params.clientId),
        status: "active",
        effectiveFrom: { $lte: params.date },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: params.date } }],
    }).lean();
    const matches = candidates.filter((assignment) => {
        const paramKey = TARGET_ID_BY_TYPE[assignment.targetType];
        const paramValue = params[paramKey];
        return paramValue !== undefined && assignment.targetIds.includes(paramValue);
    });
    if (matches.length === 0) {
        throw new errors_1.NotFoundError(`No active assignment resolves for employee ${params.employeeId} on ${params.date.toISOString().slice(0, 10)}`);
    }
    matches.sort((a, b) => {
        const specificityDiff = domain_1.TARGET_TYPE_SPECIFICITY[b.targetType] - domain_1.TARGET_TYPE_SPECIFICITY[a.targetType];
        if (specificityDiff !== 0)
            return specificityDiff;
        return b.priority - a.priority;
    });
    const winningAssignment = matches[0];
    const ruleGroup = await ruleGroup_model_1.RuleGroup.findOne({
        ruleGroupId: winningAssignment.ruleGroupId,
        effectiveFrom: { $lte: params.date },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: params.date } }],
    }).lean();
    if (!ruleGroup) {
        throw new errors_1.NotFoundError(`Assignment resolved to rule group ${winningAssignment.ruleGroupId}, but no version was effective on that date`);
    }
    const policies = await (0, ruleGroup_service_1.expandRuleGroupPolicies)(ruleGroup, params.date);
    return {
        assignment: winningAssignment,
        ruleGroup,
        policies,
        consideredAssignments: matches.length,
    };
}
//# sourceMappingURL=assignment.service.js.map