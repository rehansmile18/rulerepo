import { Types } from "mongoose";
import { Assignment, AssignmentDoc } from "../../models/assignment.model";
import { RuleGroup } from "../../models/ruleGroup.model";
import { recordAudit } from "../../models/auditLog.model";
import { expandRuleGroupPolicies } from "../ruleGroup/ruleGroup.service";
import { NotFoundError, BadRequestError } from "../../utils/errors";
import { CreateAssignmentInput, UpdateAssignmentInput } from "./assignment.validators";
import { AssignmentTargetType, TARGET_TYPE_SPECIFICITY } from "../../types/domain";

// Upper bound on how many candidate assignments a single resolve call will load. A worker on one
// date should match a handful; this is purely a DoS backstop so a client can't force an unbounded
// scan. Well above any realistic assignment count for one (client, employee, date).
const MAX_RESOLVE_CANDIDATES = 500;

/**
 * A rule group is always client-owned (there are no global rule groups). An assignment may only
 * point at a rule group belonging to the SAME client it is being created under — otherwise a
 * client admin who learned another tenant's ruleGroupId could bind it and read that tenant's
 * rules back through resolve. Rejects unknown or cross-tenant ruleGroupIds at write time.
 */
async function assertRuleGroupOwnedByClient(clientId: string, ruleGroupId: string): Promise<void> {
  const owned = await RuleGroup.exists({ ruleGroupId, clientId: new Types.ObjectId(clientId) });
  if (!owned) {
    throw new BadRequestError(`ruleGroupId ${ruleGroupId} does not resolve to a rule group owned by this client`);
  }
}

export async function listAssignments(tenantFilter: Record<string, unknown>, ruleGroupId: string | undefined, page: number, pageSize: number) {
  const query: Record<string, unknown> = { ...tenantFilter };
  if (ruleGroupId) query.ruleGroupId = ruleGroupId;
  const [items, total] = await Promise.all([
    Assignment.find(query).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Assignment.countDocuments(query),
  ]);
  return { items, total, page, pageSize };
}

export async function getAssignment(assignmentId: string, tenantFilter: Record<string, unknown>) {
  const doc = await Assignment.findOne({ _id: assignmentId, ...tenantFilter }).lean();
  if (!doc) throw new NotFoundError(`Assignment ${assignmentId} not found`);
  return doc;
}

export async function createAssignment(input: CreateAssignmentInput, actorId: string): Promise<AssignmentDoc> {
  await assertRuleGroupOwnedByClient(input.clientId, input.ruleGroupId);
  const doc = await Assignment.create({
    clientId: new Types.ObjectId(input.clientId),
    ruleGroupId: input.ruleGroupId,
    targetType: input.targetType,
    targetIds: input.targetIds,
    priority: input.priority,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    status: "active",
  });
  await recordAudit({ entityType: "assignment", entityId: String(doc._id), action: "create", actorId, before: null, after: doc.toObject() });
  return doc;
}

export async function updateAssignment(
  assignmentId: string,
  input: UpdateAssignmentInput,
  tenantFilter: Record<string, unknown>,
  actorId: string
): Promise<AssignmentDoc> {
  const doc = await Assignment.findOne({ _id: assignmentId, ...tenantFilter });
  if (!doc) throw new NotFoundError(`Assignment ${assignmentId} not found`);
  const before = doc.toObject();
  Object.assign(doc, input);
  await doc.save();
  await recordAudit({ entityType: "assignment", entityId: assignmentId, action: "update", actorId, before, after: doc.toObject() });
  return doc;
}

interface ResolveParams {
  clientId: string;
  employeeId: string;
  date: Date;
  paygroupId?: string;
  locationId?: string;
  departmentId?: string;
  state?: string;
}

type StringTargetParamKey = "employeeId" | "paygroupId" | "locationId" | "departmentId" | "state";

const TARGET_ID_BY_TYPE: Record<AssignmentTargetType, StringTargetParamKey> = {
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
export async function resolveAssignment(params: ResolveParams) {
  // Push target matching into the query (only assignments whose (targetType, targetId) actually
  // match one of the supplied identifiers) instead of loading every active assignment and
  // filtering in memory — this bounds the working set and lets the limit below be safe.
  const targetMatchClauses = (Object.entries(TARGET_ID_BY_TYPE) as [AssignmentTargetType, StringTargetParamKey][])
    .flatMap(([targetType, paramKey]) => {
      const value = params[paramKey];
      return value !== undefined ? [{ targetType, targetIds: value }] : [];
    });

  const matches = await Assignment.find({
    clientId: new Types.ObjectId(params.clientId),
    status: "active",
    effectiveFrom: { $lte: params.date },
    $and: [
      { $or: [{ effectiveTo: null }, { effectiveTo: { $gt: params.date } }] },
      { $or: targetMatchClauses },
    ],
  })
    .limit(MAX_RESOLVE_CANDIDATES)
    .lean();

  if (matches.length === 0) {
    throw new NotFoundError(
      `No active assignment resolves for employee ${params.employeeId} on ${params.date.toISOString().slice(0, 10)}`
    );
  }

  matches.sort((a, b) => {
    const specificityDiff = TARGET_TYPE_SPECIFICITY[b.targetType] - TARGET_TYPE_SPECIFICITY[a.targetType];
    if (specificityDiff !== 0) return specificityDiff;
    return b.priority - a.priority;
  });
  const winningAssignment = matches[0];

  // Resolve the rule-group version that was LIVE on the date — never an in-flight draft or an
  // archived version. Sort makes it deterministic when versions overlap the effective window.
  const ruleGroup = await RuleGroup.findOne({
    ruleGroupId: winningAssignment.ruleGroupId,
    // Scope to the caller's own client. createAssignment already blocks cross-tenant ruleGroupIds,
    // but this closes resolve for any assignment planted before that guard existed — a rule group
    // owned by another client must never resolve here.
    clientId: new Types.ObjectId(params.clientId),
    status: { $in: ["active", "superseded"] },
    effectiveFrom: { $lte: params.date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: params.date } }],
  })
    .sort({ version: -1 })
    .lean();
  if (!ruleGroup) {
    throw new NotFoundError(`Assignment resolved to rule group ${winningAssignment.ruleGroupId}, but no live version was effective on that date`);
  }

  const { policies, unresolvedRefs } = await expandRuleGroupPolicies(ruleGroup, params.date);

  return {
    assignment: winningAssignment,
    ruleGroup,
    policies,
    // Surfaced, not hidden: a non-empty list means the resolved rule set is incomplete for this
    // date (e.g. a pinned version was archived), which a pay engine must treat as an error.
    unresolvedRefs,
    consideredAssignments: matches.length,
  };
}
