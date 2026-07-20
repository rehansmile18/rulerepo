import { Types } from "mongoose";
import { v4 as uuid } from "uuid";
import { Policy, PolicyDoc } from "../../models/policy.model";
import { getDiscriminatorModel } from "../../models/policies/registry";
import { recordAudit } from "../../models/auditLog.model";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../utils/errors";
import { CreatePolicyInput, UpdatePolicyInput } from "./policy.validators";
import { PolicyType, PolicyScope } from "../../types/domain";
import { env } from "../../config/env";

export interface ListPoliciesFilter {
  policyType?: PolicyType;
  clientId?: string;
  scope?: PolicyScope;
  state?: string;
  status?: string;
  effectiveOn?: Date;
  tenantFilter: Record<string, unknown>;
}

export async function listPolicies(filter: ListPoliciesFilter, page: number, pageSize: number) {
  // The tenant filter and the effective-date filter can BOTH carry a top-level `$or`
  // (tenant = global-or-own; effective = still-in-force). Merging them into one object
  // would let the second `$or` silently overwrite the first — a cross-tenant data leak.
  // Compose every clause under a single `$and` so both survive.
  const clauses: Record<string, unknown>[] = [];
  if (filter.tenantFilter && Object.keys(filter.tenantFilter).length > 0) clauses.push(filter.tenantFilter);

  const scalar: Record<string, unknown> = {};
  if (filter.policyType) scalar.policyType = filter.policyType;
  if (filter.clientId) scalar.clientId = new Types.ObjectId(filter.clientId);
  if (filter.scope) scalar.scope = filter.scope;
  if (filter.status) scalar.status = filter.status;
  if (filter.state) scalar["jurisdiction.state"] = filter.state;
  if (filter.effectiveOn) scalar.effectiveFrom = { $lte: filter.effectiveOn };
  if (Object.keys(scalar).length > 0) clauses.push(scalar);

  if (filter.effectiveOn) {
    clauses.push({ $or: [{ effectiveTo: null }, { effectiveTo: { $gt: filter.effectiveOn } }] });
  }

  const query: Record<string, unknown> = clauses.length > 0 ? { $and: clauses } : {};

  const [items, total] = await Promise.all([
    Policy.find(query)
      .sort({ "metadata.updatedAt": -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Policy.countDocuments(query),
  ]);
  return { items, total, page, pageSize };
}

async function findLatestByPolicyId(policyId: string, tenantFilter: Record<string, unknown>) {
  const doc = await Policy.findOne({ policyId, ...tenantFilter }).sort({ version: -1 }).lean();
  if (!doc) throw new NotFoundError(`Policy ${policyId} not found`);
  return doc;
}

export async function getPolicy(policyId: string, tenantFilter: Record<string, unknown>, version?: number) {
  if (version !== undefined) {
    const doc = await Policy.findOne({ policyId, version, ...tenantFilter }).lean();
    if (!doc) throw new NotFoundError(`Policy ${policyId} version ${version} not found`);
    return doc;
  }
  return findLatestByPolicyId(policyId, tenantFilter);
}

export async function getPolicyVersions(policyId: string, tenantFilter: Record<string, unknown>) {
  const docs = await Policy.find({ policyId, ...tenantFilter }).sort({ version: 1 }).lean();
  if (docs.length === 0) throw new NotFoundError(`Policy ${policyId} not found`);
  return docs;
}

export async function createPolicy(input: CreatePolicyInput, actorId: string): Promise<PolicyDoc> {
  const Model = getDiscriminatorModel(input.policyType);
  const now = new Date();
  const doc = await Model.create({
    policyId: uuid(),
    version: 1,
    status: "draft",
    scope: input.scope,
    clientId: input.scope === "client" ? new Types.ObjectId(input.clientId) : null,
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
  await recordAudit({ entityType: "policy", entityId: doc.policyId, action: "create", actorId, before: null, after: doc.toObject() });
  return doc;
}

/** Creates a new draft version of an existing policy. The change only takes effect once published. */
export async function updatePolicy(
  policyId: string,
  input: UpdatePolicyInput,
  tenantFilter: Record<string, unknown>,
  actorId: string
): Promise<PolicyDoc> {
  const current = await findLatestByPolicyId(policyId, tenantFilter);
  if (current.status === "draft") {
    throw new BadRequestError("Policy already has an unpublished draft version — publish or discard it first");
  }
  const Model = getDiscriminatorModel(current.policyType as PolicyType);
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
  await recordAudit({ entityType: "policy", entityId: policyId, action: "update", actorId, before: current, after: nextVersion.toObject() });
  return nextVersion;
}

/** Supersedes whichever version is currently active (if any) and activates `next`. */
async function supersedeAndActivate(
  policyId: string,
  tenantFilter: Record<string, unknown>,
  next: InstanceType<typeof Policy>
) {
  const previousActive = await Policy.findOne({ policyId, status: "active", ...tenantFilter });
  if (previousActive) {
    // The new version must take effect at or after the one it supersedes; otherwise the
    // superseded version would get an inverted window (effectiveTo < effectiveFrom) that breaks
    // as-of resolution.
    if (next.effectiveFrom < previousActive.effectiveFrom) {
      throw new BadRequestError(
        "effectiveFrom must be on or after the currently active version's effectiveFrom — cannot backdate a supersession before the version it replaces"
      );
    }
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
export async function publishPolicy(policyId: string, tenantFilter: Record<string, unknown>, actorId: string): Promise<PolicyDoc> {
  const draft = await Policy.findOne({ policyId, status: "draft", ...tenantFilter });
  if (!draft) throw new NotFoundError(`No draft version found for policy ${policyId}`);
  if (draft.scope === "global") {
    throw new BadRequestError(
      "Global policies require the submit-for-approval / approve workflow and cannot be published directly."
    );
  }

  const previousActive = await supersedeAndActivate(policyId, tenantFilter, draft);
  await recordAudit({ entityType: "policy", entityId: policyId, action: "publish", actorId, before: previousActive?.toObject() ?? null, after: draft.toObject() });
  return draft;
}

/** Moves a global-policy draft into pending_approval. Only global policies use this workflow. */
export async function submitPolicyForApproval(
  policyId: string,
  tenantFilter: Record<string, unknown>,
  actorId: string
): Promise<PolicyDoc> {
  const draft = await Policy.findOne({ policyId, status: "draft", ...tenantFilter });
  if (!draft) throw new NotFoundError(`No draft version found for policy ${policyId}`);
  if (draft.scope !== "global") {
    throw new BadRequestError("Only global policies use the submit-for-approval workflow — client policies publish directly.");
  }
  const before = draft.toObject();
  draft.status = "pending_approval";
  draft.metadata.updatedBy = actorId;
  draft.metadata.updatedAt = new Date();
  await draft.save();
  await recordAudit({ entityType: "policy", entityId: policyId, action: "submit_for_approval", actorId, before, after: draft.toObject() });
  return draft;
}

/**
 * Activates a global policy that's pending approval. When `env.requireApprovalSeparation` is
 * on (the default), the approver must be a different user than whoever submitted it — real
 * maker-checker separation of duties. Set REQUIRE_APPROVAL_SEPARATION=false to relax this for
 * solo dev/demo use.
 */
export async function approvePolicy(policyId: string, tenantFilter: Record<string, unknown>, actorId: string): Promise<PolicyDoc> {
  const pending = await Policy.findOne({ policyId, status: "pending_approval", ...tenantFilter });
  if (!pending) throw new NotFoundError(`No policy pending approval for ${policyId}`);
  if (env.requireApprovalSeparation && pending.metadata.updatedBy === actorId) {
    throw new ForbiddenError("The user who submitted this policy for approval cannot also approve it");
  }

  const before = pending.toObject();
  const previousActive = await supersedeAndActivate(policyId, tenantFilter, pending);
  pending.metadata.updatedBy = actorId;
  pending.metadata.updatedAt = new Date();
  await pending.save();
  await recordAudit({
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
export async function rejectPolicy(
  policyId: string,
  tenantFilter: Record<string, unknown>,
  actorId: string,
  reason: string | undefined
): Promise<PolicyDoc> {
  const pending = await Policy.findOne({ policyId, status: "pending_approval", ...tenantFilter });
  if (!pending) throw new NotFoundError(`No policy pending approval for ${policyId}`);
  if (env.requireApprovalSeparation && pending.metadata.updatedBy === actorId) {
    throw new ForbiddenError("The user who submitted this policy for approval cannot also reject it");
  }

  const before = pending.toObject();
  pending.status = "draft";
  pending.metadata.rejectionReason = reason ?? null;
  pending.metadata.updatedBy = actorId;
  pending.metadata.updatedAt = new Date();
  await pending.save();
  await recordAudit({ entityType: "policy", entityId: policyId, action: "reject", actorId, before, after: pending.toObject() });
  return pending;
}

/**
 * Retires a policy from service. Targets the ACTIVE version if one exists (so "archive" actually
 * pulls the live policy out of resolution) and closes its effective window; otherwise archives
 * the latest version (e.g. discarding a draft that was never published). Archiving the highest
 * version blindly would leave a still-active lower version resolving — see the resolve path.
 */
export async function archivePolicy(policyId: string, tenantFilter: Record<string, unknown>, actorId: string): Promise<PolicyDoc> {
  const active = await Policy.findOne({ policyId, status: "active", ...tenantFilter });
  const target = active ?? (await Policy.findOne({ policyId, ...tenantFilter }).sort({ version: -1 }));
  if (!target) throw new NotFoundError(`Policy ${policyId} not found`);

  const before = target.toObject();
  if (target.status === "active" && !target.effectiveTo) {
    target.effectiveTo = new Date();
  }
  target.status = "archived";
  target.metadata.updatedBy = actorId;
  target.metadata.updatedAt = new Date();
  await target.save();
  await recordAudit({ entityType: "policy", entityId: policyId, action: "archive", actorId, before, after: target.toObject() });
  return target;
}

export async function clonePolicy(
  policyId: string,
  targetClientId: string,
  actorId: string,
  effectiveFrom: Date | undefined
): Promise<PolicyDoc> {
  // A global policyId usually has several versions (superseded / active / draft). Clone from the
  // currently ACTIVE one — findOne without this filter returns an arbitrary version and would
  // seed the client copy with stale or unpublished statutory rules.
  const source = await Policy.findOne({ policyId, scope: "global", status: "active" }).lean();
  if (!source) throw new NotFoundError(`No active global policy found for ${policyId}`);

  const Model = getDiscriminatorModel(source.policyType as PolicyType);
  const now = new Date();
  const clone = await Model.create({
    policyId: uuid(),
    version: 1,
    status: "draft",
    scope: "client",
    clientId: new Types.ObjectId(targetClientId),
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
  await recordAudit({ entityType: "policy", entityId: clone.policyId, action: "clone", actorId, before: source, after: clone.toObject() });
  return clone;
}
