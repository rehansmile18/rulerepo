import { Types } from "mongoose";
import { Assignment, AssignmentDoc } from "../../models/assignment.model";
import { RuleGroup } from "../../models/ruleGroup.model";
import { recordAudit } from "../../models/auditLog.model";
import { expandRuleGroupPolicies } from "../ruleGroup/ruleGroup.service";
import { NotFoundError } from "../../utils/errors";
import { CreateAssignmentInput, UpdateAssignmentInput } from "./assignment.validators";
import { AssignmentTargetType, TARGET_TYPE_SPECIFICITY } from "../../types/domain";

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
  const candidates = await Assignment.find({
    clientId: new Types.ObjectId(params.clientId),
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

  const ruleGroup = await RuleGroup.findOne({
    ruleGroupId: winningAssignment.ruleGroupId,
    effectiveFrom: { $lte: params.date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: params.date } }],
  }).lean();
  if (!ruleGroup) {
    throw new NotFoundError(`Assignment resolved to rule group ${winningAssignment.ruleGroupId}, but no version was effective on that date`);
  }

  const policies = await expandRuleGroupPolicies(ruleGroup, params.date);

  return {
    assignment: winningAssignment,
    ruleGroup,
    policies,
    consideredAssignments: matches.length,
  };
}
