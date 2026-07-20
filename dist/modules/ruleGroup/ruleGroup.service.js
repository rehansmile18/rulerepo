"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRuleGroups = listRuleGroups;
exports.getRuleGroup = getRuleGroup;
exports.createRuleGroup = createRuleGroup;
exports.updateRuleGroup = updateRuleGroup;
exports.publishRuleGroup = publishRuleGroup;
exports.archiveRuleGroup = archiveRuleGroup;
exports.expandRuleGroupPolicies = expandRuleGroupPolicies;
const mongoose_1 = require("mongoose");
const uuid_1 = require("uuid");
const ruleGroup_model_1 = require("../../models/ruleGroup.model");
const policy_model_1 = require("../../models/policy.model");
const auditLog_model_1 = require("../../models/auditLog.model");
const errors_1 = require("../../utils/errors");
async function assertPolicyRefsResolvable(clientId, refs) {
    for (const ref of refs) {
        const query = ref.versionPin === "latest"
            ? { policyId: ref.policyId, status: "active" }
            : { policyId: ref.policyId, version: ref.versionPin };
        const match = await policy_model_1.Policy.findOne({ ...query, $or: [{ scope: "global" }, { clientId: new mongoose_1.Types.ObjectId(clientId) }] }).lean();
        if (!match) {
            throw new errors_1.BadRequestError(`policyRefs entry ${ref.policyId} (${ref.policyType}) does not resolve to an accessible policy`);
        }
    }
}
async function listRuleGroups(tenantFilter, status, page, pageSize) {
    const query = { ...tenantFilter };
    if (status)
        query.status = status;
    const [items, total] = await Promise.all([
        ruleGroup_model_1.RuleGroup.find(query).sort({ "metadata.updatedAt": -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        ruleGroup_model_1.RuleGroup.countDocuments(query),
    ]);
    return { items, total, page, pageSize };
}
async function findLatestByRuleGroupId(ruleGroupId, tenantFilter) {
    const doc = await ruleGroup_model_1.RuleGroup.findOne({ ruleGroupId, ...tenantFilter }).sort({ version: -1 }).lean();
    if (!doc)
        throw new errors_1.NotFoundError(`Rule group ${ruleGroupId} not found`);
    return doc;
}
async function getRuleGroup(ruleGroupId, tenantFilter) {
    return findLatestByRuleGroupId(ruleGroupId, tenantFilter);
}
async function createRuleGroup(input, actorId) {
    await assertPolicyRefsResolvable(input.clientId, input.policyRefs);
    const now = new Date();
    const doc = await ruleGroup_model_1.RuleGroup.create({
        ruleGroupId: (0, uuid_1.v4)(),
        clientId: new mongoose_1.Types.ObjectId(input.clientId),
        name: input.name,
        description: input.description ?? null,
        version: 1,
        status: "draft",
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        policyRefs: input.policyRefs,
        metadata: { createdBy: actorId, createdAt: now, updatedBy: actorId, updatedAt: now },
    });
    await (0, auditLog_model_1.recordAudit)({ entityType: "ruleGroup", entityId: doc.ruleGroupId, action: "create", actorId, before: null, after: doc.toObject() });
    return doc;
}
async function updateRuleGroup(ruleGroupId, input, tenantFilter, actorId) {
    const current = await findLatestByRuleGroupId(ruleGroupId, tenantFilter);
    if (current.status === "draft") {
        throw new errors_1.BadRequestError("Rule group already has an unpublished draft version — publish or discard it first");
    }
    const nextRefs = input.policyRefs ?? current.policyRefs;
    await assertPolicyRefsResolvable(String(current.clientId), nextRefs);
    const now = new Date();
    const nextVersion = await ruleGroup_model_1.RuleGroup.create({
        ruleGroupId: current.ruleGroupId,
        clientId: current.clientId,
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        version: current.version + 1,
        status: "draft",
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        policyRefs: nextRefs,
        metadata: { createdBy: current.metadata.createdBy, createdAt: current.metadata.createdAt, updatedBy: actorId, updatedAt: now },
    });
    await (0, auditLog_model_1.recordAudit)({ entityType: "ruleGroup", entityId: ruleGroupId, action: "update", actorId, before: current, after: nextVersion.toObject() });
    return nextVersion;
}
async function publishRuleGroup(ruleGroupId, tenantFilter, actorId) {
    const draft = await ruleGroup_model_1.RuleGroup.findOne({ ruleGroupId, status: "draft", ...tenantFilter });
    if (!draft)
        throw new errors_1.NotFoundError(`No draft version found for rule group ${ruleGroupId}`);
    const previousActive = await ruleGroup_model_1.RuleGroup.findOne({ ruleGroupId, status: "active", ...tenantFilter });
    if (previousActive) {
        previousActive.status = "superseded";
        previousActive.effectiveTo = draft.effectiveFrom;
        await previousActive.save();
    }
    draft.status = "active";
    await draft.save();
    await (0, auditLog_model_1.recordAudit)({ entityType: "ruleGroup", entityId: ruleGroupId, action: "publish", actorId, before: previousActive?.toObject() ?? null, after: draft.toObject() });
    return draft;
}
async function archiveRuleGroup(ruleGroupId, tenantFilter, actorId) {
    const latest = await findLatestByRuleGroupId(ruleGroupId, tenantFilter);
    const full = await ruleGroup_model_1.RuleGroup.findById(latest._id);
    if (!full)
        throw new errors_1.NotFoundError(`Rule group ${ruleGroupId} not found`);
    const before = full.toObject();
    full.status = "archived";
    await full.save();
    await (0, auditLog_model_1.recordAudit)({ entityType: "ruleGroup", entityId: ruleGroupId, action: "archive", actorId, before, after: full.toObject() });
    return full;
}
/**
 * Expands a rule group's policyRefs into the fully resolved Policy documents.
 * When `asOfDate` is given, a "latest" pin resolves to whichever version was
 * effective on that date (not necessarily the current `status: active` one) —
 * this is what makes historical/audit lookups correct under effective-dating.
 */
async function expandRuleGroupPolicies(ruleGroup, asOfDate) {
    const resolved = [];
    for (const ref of ruleGroup.policyRefs) {
        let query;
        if (ref.versionPin !== "latest") {
            query = { policyId: ref.policyId, version: ref.versionPin };
        }
        else if (asOfDate) {
            query = {
                policyId: ref.policyId,
                effectiveFrom: { $lte: asOfDate },
                $or: [{ effectiveTo: null }, { effectiveTo: { $gt: asOfDate } }],
            };
        }
        else {
            query = { policyId: ref.policyId, status: "active" };
        }
        const policy = await policy_model_1.Policy.findOne({
            $and: [query, { $or: [{ scope: "global" }, { clientId: ruleGroup.clientId }] }],
        }).lean();
        if (policy)
            resolved.push(policy);
    }
    return resolved;
}
//# sourceMappingURL=ruleGroup.service.js.map