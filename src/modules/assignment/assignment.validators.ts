import { z } from "zod";
import { ASSIGNMENT_TARGET_TYPES } from "../../types/domain";

export const createAssignmentSchema = z.object({
  clientId: z.string(),
  ruleGroupId: z.string().uuid(),
  targetType: z.enum(ASSIGNMENT_TARGET_TYPES),
  targetIds: z.array(z.string().min(1)).min(1),
  priority: z.number().int().default(0),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const updateAssignmentSchema = z.object({
  targetIds: z.array(z.string().min(1)).min(1).optional(),
  priority: z.number().int().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  status: z.enum(["active", "scheduled", "expired"]).optional(),
});
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export const listAssignmentsQuerySchema = z.object({
  clientId: z.string().optional(),
  ruleGroupId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const assignmentIdParamSchema = z.object({
  assignmentId: z.string(),
});

export const resolveAssignmentQuerySchema = z.object({
  clientId: z.string(),
  employeeId: z.string(),
  date: z.coerce.date(),
  paygroupId: z.string().optional(),
  locationId: z.string().optional(),
  departmentId: z.string().optional(),
  state: z.string().length(2).optional(),
});
