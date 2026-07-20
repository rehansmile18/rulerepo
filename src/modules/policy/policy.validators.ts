import { z } from "zod";
import { POLICY_TYPES, POLICY_SCOPES } from "../../types/domain";

const jurisdictionSchema = z.object({
  country: z.string().default("US"),
  state: z.string().length(2).nullable().optional(),
  county: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
});

export const createPolicySchema = z.object({
  scope: z.enum(POLICY_SCOPES),
  clientId: z.string().optional(),
  policyType: z.enum(POLICY_TYPES),
  jurisdiction: jurisdictionSchema.optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  effectiveFrom: z.coerce.date(),
  // Shape validated per-policyType by the Mongoose discriminator schema on save.
  rules: z.record(z.string(), z.unknown()),
});
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const updatePolicySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  effectiveFrom: z.coerce.date(),
  jurisdiction: jurisdictionSchema.optional(),
  rules: z.record(z.string(), z.unknown()).optional(),
});
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;

export const listPoliciesQuerySchema = z.object({
  policyType: z.enum(POLICY_TYPES).optional(),
  clientId: z.string().optional(),
  scope: z.enum(POLICY_SCOPES).optional(),
  state: z.string().length(2).optional(),
  status: z.string().optional(),
  effectiveOn: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const policyIdParamSchema = z.object({
  policyId: z.string().uuid(),
});

export const clonePolicySchema = z.object({
  clientId: z.string(),
  effectiveFrom: z.coerce.date().optional(),
});

export const rejectPolicySchema = z.object({
  reason: z.string().min(1).optional(),
});
