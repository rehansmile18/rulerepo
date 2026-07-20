import { z } from "zod";
import { POLICY_TYPES } from "../../types/domain";

const policyRefSchema = z.object({
  policyId: z.string().uuid(),
  policyType: z.enum(POLICY_TYPES),
  versionPin: z.union([z.literal("latest"), z.number().int().min(1)]).default("latest"),
});

export const createRuleGroupSchema = z.object({
  clientId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  effectiveFrom: z.coerce.date(),
  policyRefs: z.array(policyRefSchema).min(1),
});
export type CreateRuleGroupInput = z.infer<typeof createRuleGroupSchema>;

export const updateRuleGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  effectiveFrom: z.coerce.date(),
  policyRefs: z.array(policyRefSchema).min(1).optional(),
});
export type UpdateRuleGroupInput = z.infer<typeof updateRuleGroupSchema>;

export const listRuleGroupsQuerySchema = z.object({
  clientId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const ruleGroupIdParamSchema = z.object({
  ruleGroupId: z.string().uuid(),
});
