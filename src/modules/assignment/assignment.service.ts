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
 * Loads every active assignment whose (targetType, targetId) matches one of the supplied
 * identifiers, effective on `params.date`. Shared by both resolveAssignment (which collapses to
 * one overall winner) and resolveAssignmentLayered (which keeps one winner per target type).
 */
async function findCandidateAssignments(params: ResolveParams): Promise<AssignmentDoc[]> {
  const targetMatchClauses = (Object.entries(TARGET_ID_BY_TYPE) as [AssignmentTargetType, StringTargetParamKey][])
    .flatMap(([targetType, paramKey]) => {
      const value = params[paramKey];
      return value !== undefined ? [{ targetType, targetIds: value }] : [];
    });

  return Assignment.find({
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
}

/** Resolves the rule-group version that was LIVE on `date` — never an in-flight draft or archived version. */
async function findLiveRuleGroup(ruleGroupId: string, clientId: string, date: Date) {
  // Scope to the caller's own client. createAssignment already blocks cross-tenant ruleGroupIds,
  // but this closes resolve for any assignment planted before that guard existed — a rule group
  // owned by another client must never resolve here.
  return RuleGroup.findOne({
    ruleGroupId,
    clientId: new Types.ObjectId(clientId),
    status: { $in: ["active", "superseded"] },
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: date } }],
  })
    .sort({ version: -1 })
    .lean();
}

/**
 * Resolves the single most-specific active assignment for a worker on a given date,
 * then expands it into the concrete policies effective on that date.
 * Specificity order: EMPLOYEE > PAYGROUP > LOCATION > DEPARTMENT > STATE, tie-broken by priority.
 */
export async function resolveAssignment(params: ResolveParams) {
  const matches = await findCandidateAssignments(params);

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

  const ruleGroup = await findLiveRuleGroup(winningAssignment.ruleGroupId, params.clientId, params.date);
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

export interface ResolvedLayer {
  targetType: AssignmentTargetType;
  assignment: AssignmentDoc;
  ruleGroup: Awaited<ReturnType<typeof findLiveRuleGroup>> | null;
  policies: Awaited<ReturnType<typeof expandRuleGroupPolicies>>["policies"];
  unresolvedRefs: Awaited<ReturnType<typeof expandRuleGroupPolicies>>["unresolvedRefs"];
  unresolved?: true;
}

/**
 * Like resolveAssignment, but does NOT collapse across target types — every target type that has
 * a live matching assignment (e.g. both an EMPLOYEE-targeted and a LOCATION-targeted assignment
 * for the same punch) is returned as its own "layer", so a downstream engine (the punch/timesheet
 * processor) can run all of them together instead of picking a single winner. Within one target
 * type, the same specificity-then-priority tie-break as resolveAssignment still picks one winner —
 * layering only happens ACROSS types, never across two competing assignments of the same type.
 * Callers decide their own cross-layer ordering (e.g. by assignment.priority); this function
 * returns layers grouped by type, not pre-sorted relative to each other.
 */
export async function resolveAssignmentLayered(params: ResolveParams): Promise<{ layers: ResolvedLayer[]; consideredAssignments: number }> {
  const matches = await findCandidateAssignments(params);

  const byType = new Map<AssignmentTargetType, AssignmentDoc[]>();
  for (const match of matches) {
    const bucket = byType.get(match.targetType);
    if (bucket) bucket.push(match);
    else byType.set(match.targetType, [match]);
  }

  const layers: ResolvedLayer[] = [];
  for (const [targetType, candidates] of byType) {
    candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const effDiff = b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
      if (effDiff !== 0) return effDiff;
      return String(a._id).localeCompare(String(b._id));
    });
    const winner = candidates[0];

    const ruleGroup = await findLiveRuleGroup(winner.ruleGroupId, params.clientId, params.date);
    if (!ruleGroup) {
      layers.push({ targetType, assignment: winner, ruleGroup: null, policies: [], unresolvedRefs: [], unresolved: true });
      continue;
    }
    const { policies, unresolvedRefs } = await expandRuleGroupPolicies(ruleGroup, params.date);
    layers.push({ targetType, assignment: winner, ruleGroup, policies, unresolvedRefs });
  }

  return { layers, consideredAssignments: matches.length };
}

/**
 * A run of consecutive calendar days over which resolveAssignmentLayered returns an identical
 * result. `startDate`/`endDate` are inclusive "YYYY-MM-DD" strings.
 */
export interface ResolvedLayerSegment {
  startDate: string;
  endDate: string;
  layers: ResolvedLayer[];
  consideredAssignments: number;
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Resolves every calendar day in [startDate, endDate] and collapses consecutive days whose
 * resolution is byte-identical into a single segment.
 *
 * This exists because resolution is a step function of the date — it changes only where an
 * assignment, rule-group version or policy version boundary falls — but a caller processing a pay
 * period has no sound way to know where those steps are. A caller cannot infer them from a
 * single-date response either: the response describes what DID match, and says nothing about a
 * not-yet-effective assignment that will start winning tomorrow. So the boundaries have to be
 * found here, where the data is.
 *
 * Each day is resolved by the exact same resolveAssignmentLayered call the single-date endpoint
 * uses, and segments are formed purely by comparing those results — no separate window arithmetic
 * that could disagree with the resolver. That makes a segment's correctness a consequence of the
 * per-day resolution rather than a second implementation of it.
 */
export async function resolveAssignmentLayeredRange(
  params: Omit<ResolveParams, "date"> & { startDate: Date; endDate: Date }
): Promise<{ segments: ResolvedLayerSegment[] }> {
  const { startDate, endDate, ...rest } = params;
  const segments: ResolvedLayerSegment[] = [];
  let previousFingerprint: string | null = null;

  for (
    let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    cursor.getTime() <= endDate.getTime();
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const dateStr = toUtcDateString(cursor);
    const { layers, consideredAssignments } = await resolveAssignmentLayered({ ...rest, date: cursor });
    const fingerprint = JSON.stringify(layers);

    if (fingerprint === previousFingerprint) {
      segments[segments.length - 1].endDate = dateStr;
      continue;
    }
    segments.push({ startDate: dateStr, endDate: dateStr, layers, consideredAssignments });
    previousFingerprint = fingerprint;
  }

  return { segments };
}
