"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPolicies = listPolicies;
exports.getPolicy = getPolicy;
exports.getPolicyVersions = getPolicyVersions;
exports.createPolicy = createPolicy;
exports.updatePolicy = updatePolicy;
exports.publishPolicy = publishPolicy;
exports.submitPolicyForApproval = submitPolicyForApproval;
exports.approvePolicy = approvePolicy;
exports.rejectPolicy = rejectPolicy;
exports.archivePolicy = archivePolicy;
exports.clonePolicy = clonePolicy;
const mongoose_1 = require("mongoose");
const uuid_1 = require("uuid");
const policy_model_1 = require("../../models/policy.model");
const registry_1 = require("../../models/policies/registry");
const auditLog_model_1 = require("../../models/auditLog.model");
const errors_1 = require("../../utils/errors");
const env_1 = require("../../config/env");
async function listPolicies(filter, page, pageSize) {
    const query = { ...filter.tenantFilter };
    if (filter.policyType)
        query.policyType = filter.policyType;
    if (filter.clientId)
        query.clientId = new mongoose_1.Types.ObjectId(filter.clientId);
    if (filter.scope)
        query.scope = filter.scope;
    if (filter.status)
        query.status = filter.status;
    if (filter.state)
        query["jurisdiction.state"] = filter.state;
    if (filter.effectiveOn) {
        query.effectiveFrom = { $lte: filter.effectiveOn };
        query.$or = [{ effectiveTo: null }, { effectiveTo: { $gt: filter.effectiveOn } }];
    }
    const [items, total] = await Promise.all([
        policy_model_1.Policy.find(query)
            .sort({ "metadata.updatedAt": -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean(),
        policy_model_1.Policy.countDocuments(query),
    ]);
    return { items, total, page, pageSize };
}
async function findLatestByPolicyId(policyId, tenantFilter) {
    const doc = await policy_model_1.Policy.findOne({ policyId, ...tenantFilter }).sort({ version: -1 }).lean();
    if (!doc)
        throw new errors_1.NotFoundError(`Policy ${policyId} not found`);
    return doc;
}
async function getPolicy(policyId, tenantFilter, version) {
    if (version !== undefined) {
        const doc = await policy_model_1.Policy.findOne({ policyId, version, ...tenantFilter }).lean();
        if (!doc)
            throw new errors_1.NotFoundError(`Policy ${policyId} version ${version} not found`);
        return doc;
    }
    return findLatestByPolicyId(policyId, tenantFilter);
}
async function getPolicyVersions(policyId, tenantFilter) {
    const docs = await policy_model_1.Policy.find({ policyId, ...tenantFilter }).sort({ version: 1 }).lean();
    if (docs.length === 0)
        throw new errors_1.NotFoundError(`Policy ${policyId} not found`);
    return docs;
}
async function createPolicy(input, actorId) {
    const Model = (0, registry_1.getDiscriminatorModel)(input.policyType);
    const now = new Date();
    const doc = await Model.create({
        policyId: (0, uuid_1.v4)(),
        version: 1,
        status: "draft",
        scope: input.scope,
        clientId: input.scope === "client" ? new mongoose_1.Types.ObjectId(input.clientId) : null,
        clonedFromPolicyId: null,
        policyType: input.policyType,
        jurisdiction: { country: "US", state: null, county: null, city: null, ...input.jurisdiction },
        name: input.name,
        description: input.description ?? null,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        rules: input.rules,
        metadata: { createdBy: actorId, createdAt: now, updatedBy: actorId, updatedAt: now },
    });
    await (0, auditLog_model_1.recordAudit)({ entityType: "policy", entityId: doc.policyId, action: "create", actorId, before: null, after: doc.toObject() });
    return doc;
}
/** Creates a new draft version of an existing policy. The change only takes effect once published. */
async function updatePolicy(policyId, input, tenantFilter, actorId) {
    const current = await findLatestByPolicyId(policyId, tenantFilter);
    if (current.status === "draft") {
        throw new errors_1.BadRequestError("Policy already has an unpublished draft version — publish or discard it first");
    }
    const Model = (0, registry_1.getDiscriminatorModel)(current.policyType);
    const now = new Date();
    const nextVersion = await Model.create({
        policyId: current.policyId,
        version: current.version + 1,
        status: "draft",
        scope: current.scope,
        clientId: current.clientId,
        clonedFromPolicyId: current.clonedFromPolicyId,
        policyType: current.policyType,
        jurisdiction: input.jurisdiction ? { ...current.jurisdiction, ...input.jurisdiction } : current.jurisdiction,
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        rules: input.rules ?? current.rules,
        metadata: { createdBy: current.metadata.createdBy, createdAt: current.metadata.createdAt, updatedBy: actorId, updatedAt: now },
    });
    await (0, auditLog_model_1.recordAudit)({ entityType: "policy", entityId: policyId, action: "update", actorId, before: current, after: nextVersion.toObject() });
    return nextVersion;
}
/** Supersedes whichever version is currently active (if any) and activates `next`. */
async function supersedeAndActivate(policyId, tenantFilter, next) {
    const previousActive = await policy_model_1.Policy.findOne({ policyId, status: "active", ...tenantFilter });
    if (previousActive) {
        previousActive.status = "superseded";
        previousActive.effectiveTo = next.effectiveFrom;
        await previousActive.save();
    }
    next.status = "active";
    await next.save();
    return previousActive;
}
/**
 * Client-scoped policies publish directly from draft — clients own their own customizations.
 * Global (statutory) policies must go through submitPolicyForApproval + approvePolicy instead,
 * so a statutory change always has a second set of eyes before it goes live.
 */
async function publishPolicy(policyId, tenantFilter, actorId) {
    const draft = await policy_model_1.Policy.findOne({ policyId, status: "draft", ...tenantFilter });
    if (!draft)
        throw new errors_1.NotFoundError(`No draft version found for policy ${policyId}`);
    if (draft.scope === "global") {
        throw new errors_1.BadRequestError("Global policies require the submit-for-approval / approve workflow and cannot be published directly.");
    }
    const previousActive = await supersedeAndActivate(policyId, tenantFilter, draft);
    await (0, auditLog_model_1.recordAudit)({ entityType: "policy", entityId: policyId, action: "publish", actorId, before: previousActive?.toObject() ?? null, after: draft.toObject() });
    return draft;
}
/** Moves a global-policy draft into pending_approval. Only global policies use this workflow. */
async function submitPolicyForApproval(policyId, tenantFilter, actorId) {
    const draft = await policy_model_1.Policy.findOne({ policyId, status: "draft", ...tenantFilter });
    if (!draft)
        throw new errors_1.NotFoundError(`No draft version found for policy ${policyId}`);
    if (draft.scope !== "global") {
        throw new errors_1.BadRequestError("Only global policies use the submit-for-approval workflow — client policies publish directly.");
    }
    const before = draft.toObject();
    draft.status = "pending_approval";
    draft.metadata.updatedBy = actorId;
    draft.metadata.updatedAt = new Date();
    await draft.save();
    await (0, auditLog_model_1.recordAudit)({ entityType: "policy", entityId: policyId, action: "submit_for_approval", actorId, before, after: draft.toObject() });
    return draft;
}
/**
 * Activates a global policy that's pending approval. When `env.requireApprovalSeparation` is
 * on (the default), the approver must be a different user than whoever submitted it — real
 * maker-checker separation of duties. Set REQUIRE_APPROVAL_SEPARATION=false to relax this for
 * solo dev/demo use.
 */
async function approvePolicy(policyId, tenantFilter, actorId) {
    const pending = await policy_model_1.Policy.findOne({ policyId, status: "pending_approval", ...tenantFilter });
    if (!pending)
        throw new errors_1.NotFoundError(`No policy pending approval for ${policyId}`);
    if (env_1.env.requireApprovalSeparation && pending.metadata.updatedBy === actorId) {
        throw new errors_1.ForbiddenError("The user who submitted this policy for approval cannot also approve it");
    }
    const before = pending.toObject();
    const previousActive = await supersedeAndActivate(policyId, tenantFilter, pending);
    pending.metadata.updatedBy = actorId;
    pending.metadata.updatedAt = new Date();
    await pending.save();
    await (0, auditLog_model_1.recordAudit)({
        entityType: "policy",
        entityId: policyId,
        action: "approve",
        actorId,
        before: previousActive?.toObject() ?? before,
        after: pending.toObject(),
    });
    return pending;
}
/** Sends a pending-approval global policy back to draft with a reason, so the submitter can revise it. */
async function rejectPolicy(policyId, tenantFilter, actorId, reason) {
    const pending = await policy_model_1.Policy.findOne({ policyId, status: "pending_approval", ...tenantFilter });
    if (!pending)
        throw new errors_1.NotFoundError(`No policy pending approval for ${policyId}`);
    if (env_1.env.requireApprovalSeparation && pending.metadata.updatedBy === actorId) {
        throw new errors_1.ForbiddenError("The user who submitted this policy for approval cannot also reject it");
    }
    const before = pending.toObject();
    pending.status = "draft";
    pending.metadata.rejectionReason = reason ?? null;
    pending.metadata.updatedBy = actorId;
    pending.metadata.updatedAt = new Date();
    await pending.save();
    await (0, auditLog_model_1.recordAudit)({ entityType: "policy", entityId: policyId, action: "reject", actorId, before, after: pending.toObject() });
    return pending;
}
async function archivePolicy(policyId, tenantFilter, actorId) {
    const doc = await findLatestByPolicyId(policyId, tenantFilter);
    const full = await policy_model_1.Policy.findById(doc._id);
    if (!full)
        throw new errors_1.NotFoundError(`Policy ${policyId} not found`);
    const before = full.toObject();
    full.status = "archived";
    await full.save();
    await (0, auditLog_model_1.recordAudit)({ entityType: "policy", entityId: policyId, action: "archive", actorId, before, after: full.toObject() });
    return full;
}
async function clonePolicy(policyId, targetClientId, actorId, effectiveFrom) {
    const source = await policy_model_1.Policy.findOne({ policyId, scope: "global" }).lean();
    if (!source)
        throw new errors_1.NotFoundError(`Global policy ${policyId} not found`);
    const Model = (0, registry_1.getDiscriminatorModel)(source.policyType);
    const now = new Date();
    const clone = await Model.create({
        policyId: (0, uuid_1.v4)(),
        version: 1,
        status: "draft",
        scope: "client",
        clientId: new mongoose_1.Types.ObjectId(targetClientId),
        clonedFromPolicyId: source.policyId,
        policyType: source.policyType,
        jurisdiction: source.jurisdiction,
        name: `${source.name} (custom)`,
        description: source.description,
        effectiveFrom: effectiveFrom ?? source.effectiveFrom,
        effectiveTo: null,
        rules: source.rules,
        metadata: { createdBy: actorId, createdAt: now, updatedBy: actorId, updatedAt: now },
    });
    await (0, auditLog_model_1.recordAudit)({ entityType: "policy", entityId: clone.policyId, action: "clone", actorId, before: source, after: clone.toObject() });
    return clone;
}
//# sourceMappingURL=policy.service.js.map