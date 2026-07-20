import { Types } from "mongoose";
import { v4 as uuid } from "uuid";
import { RuleGroup, RuleGroupDoc, PolicyRef } from "../../models/ruleGroup.model";
import { Policy, PolicyDoc } from "../../models/policy.model";
import { recordAudit } from "../../models/auditLog.model";
import { NotFoundError, BadRequestError } from "../../utils/errors";
import { CreateRuleGroupInput, UpdateRuleGroupInput } from "./ruleGroup.validators";

async function assertPolicyRefsResolvable(clientId: string, refs: PolicyRef[]): Promise<void> {
  for (const ref of refs) {
    const query: Record<string, unknown> =
      ref.versionPin === "latest"
        ? { policyId: ref.policyId, status: "active" }
        : { policyId: ref.policyId, version: ref.versionPin };
    const match = await Policy.findOne({ ...query, $or: [{ scope: "global" }, { clientId: new Types.ObjectId(clientId) }] }).lean();
    if (!match) {
      throw new BadRequestError(`policyRefs entry ${ref.policyId} (${ref.policyType}) does not resolve to an accessible policy`);
    }
  }
}

export async function listRuleGroups(tenantFilter: Record<string, unknown>, status: string | undefined, page: number, pageSize: number) {
  const query: Record<string, unknown> = { ...tenantFilter };
  if (status) query.status = status;
  const [items, total] = await Promise.all([
    RuleGroup.find(query).sort({ "metadata.updatedAt": -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    RuleGroup.countDocuments(query),
  ]);
  return { items, total, page, pageSize };
}

async function findLatestByRuleGroupId(ruleGroupId: string, tenantFilter: Record<string, unknown>) {
  const doc = await RuleGroup.findOne({ ruleGroupId, ...tenantFilter }).sort({ version: -1 }).lean();
  if (!doc) throw new NotFoundError(`Rule group ${ruleGroupId} not found`);
  return doc;
}

export async function getRuleGroup(ruleGroupId: string, tenantFilter: Record<string, unknown>) {
  return findLatestByRuleGroupId(ruleGroupId, tenantFilter);
}

export async function createRuleGroup(input: CreateRuleGroupInput, actorId: string): Promise<RuleGroupDoc> {
  await assertPolicyRefsResolvable(input.clientId, input.policyRefs);
  const now = new Date();
  const doc = await RuleGroup.create({
    ruleGroupId: uuid(),
    clientId: new Types.ObjectId(input.clientId),
    name: input.name,
    description: input.description ?? null,
    version: 1,
    status: "draft",
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    policyRefs: input.policyRefs,
    metadata: { createdBy: actorId, createdAt: now, updatedBy: actorId, updatedAt: now },
  });
  await recordAudit({ entityType: "ruleGroup", entityId: doc.ruleGroupId, action: "create", actorId, before: null, after: doc.toObject() });
  return doc;
}

export async function updateRuleGroup(
  ruleGroupId: string,
  input: UpdateRuleGroupInput,
  tenantFilter: Record<string, unknown>,
  actorId: string
): Promise<RuleGroupDoc> {
  const current = await findLatestByRuleGroupId(ruleGroupId, tenantFilter);
  if (current.status === "draft") {
    throw new BadRequestError("Rule group already has an unpublished draft version — publish or discard it first");
  }
  const nextRefs = input.policyRefs ?? current.policyRefs;
  await assertPolicyRefsResolvable(String(current.clientId), nextRefs);

  const now = new Date();
  const nextVersion = await RuleGroup.create({
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
  await recordAudit({ entityType: "ruleGroup", entityId: ruleGroupId, action: "update", actorId, before: current, after: nextVersion.toObject() });
  return nextVersion;
}

export async function publishRuleGroup(ruleGroupId: string, tenantFilter: Record<string, unknown>, actorId: string): Promise<RuleGroupDoc> {
  const draft = await RuleGroup.findOne({ ruleGroupId, status: "draft", ...tenantFilter });
  if (!draft) throw new NotFoundError(`No draft version found for rule group ${ruleGroupId}`);

  const previousActive = await RuleGroup.findOne({ ruleGroupId, status: "active", ...tenantFilter });
  if (previousActive) {
    previousActive.status = "superseded";
    previousActive.effectiveTo = draft.effectiveFrom;
    await previousActive.save();
  }
  draft.status = "active";
  await draft.save();
  await recordAudit({ entityType: "ruleGroup", entityId: ruleGroupId, action: "publish", actorId, before: previousActive?.toObject() ?? null, after: draft.toObject() });
  return draft;
}

export async function archiveRuleGroup(ruleGroupId: string, tenantFilter: Record<string, unknown>, actorId: string): Promise<RuleGroupDoc> {
  const latest = await findLatestByRuleGroupId(ruleGroupId, tenantFilter);
  const full = await RuleGroup.findById(latest._id);
  if (!full) throw new NotFoundError(`Rule group ${ruleGroupId} not found`);
  const before = full.toObject();
  full.status = "archived";
  await full.save();
  await recordAudit({ entityType: "ruleGroup", entityId: ruleGroupId, action: "archive", actorId, before, after: full.toObject() });
  return full;
}

export interface ExpandedPolicies {
  policies: PolicyDoc[];
  /** policyRefs that could not be resolved to an eligible policy version — never silently dropped. */
  unresolvedRefs: PolicyRef[];
}

/**
 * Expands a rule group's policyRefs into the fully resolved Policy documents.
 * When `asOfDate` is given, a "latest" pin resolves to whichever version was LIVE on that
 * date (status active or superseded — never a draft, pending_approval, or archived version),
 * which is what makes historical/audit lookups authoritative under effective-dating.
 * Unresolved refs are returned rather than dropped, so callers (e.g. pay resolution) can
 * detect an incomplete rule set instead of computing on a silently-partial one.
 */
export async function expandRuleGroupPolicies(
  ruleGroup: Pick<RuleGroupDoc, "clientId" | "policyRefs">,
  asOfDate?: Date
): Promise<ExpandedPolicies> {
  const policies: PolicyDoc[] = [];
  const unresolvedRefs: PolicyRef[] = [];
  for (const ref of ruleGroup.policyRefs) {
    let query: Record<string, unknown>;
    if (ref.versionPin !== "latest") {
      query = { policyId: ref.policyId, version: ref.versionPin };
    } else if (asOfDate) {
      // Only versions that were ever live (active or later superseded) are eligible on a past
      // date — a never-published draft or an archived version must not resolve as authoritative.
      query = {
        policyId: ref.policyId,
        status: { $in: ["active", "superseded"] },
        effectiveFrom: { $lte: asOfDate },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: asOfDate } }],
      };
    } else {
      query = { policyId: ref.policyId, status: "active" };
    }
    const policy = await Policy.findOne({
      $and: [query, { $or: [{ scope: "global" }, { clientId: ruleGroup.clientId }] }],
    })
      .sort({ version: -1 }) // deterministic when multiple versions overlap the window
      .lean();
    if (policy) {
      policies.push(policy as unknown as PolicyDoc);
    } else {
      unresolvedRefs.push(ref);
    }
  }
  return { policies, unresolvedRefs };
}
