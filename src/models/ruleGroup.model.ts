import { Schema, model, Types } from "mongoose";
import { v4 as uuid } from "uuid";
import { RULE_GROUP_STATUSES, RuleGroupStatus, POLICY_TYPES, PolicyType } from "../types/domain";

export interface PolicyRef {
  policyId: string;
  policyType: PolicyType;
  versionPin: "latest" | number;
}

export interface RuleGroupDoc {
  _id: Types.ObjectId;
  ruleGroupId: string;
  clientId: Types.ObjectId;
  name: string;
  description: string | null;
  version: number;
  status: RuleGroupStatus;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  policyRefs: PolicyRef[];
  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedBy: string;
    updatedAt: Date;
  };
}

const policyRefSchema = new Schema<PolicyRef>(
  {
    policyId: { type: String, required: true },
    policyType: { type: String, enum: POLICY_TYPES, required: true },
    versionPin: { type: Schema.Types.Mixed, required: true, default: "latest" },
  },
  { _id: false }
);

const ruleGroupSchema = new Schema<RuleGroupDoc>(
  {
    ruleGroupId: { type: String, required: true, default: () => uuid() },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    version: { type: Number, required: true, default: 1 },
    status: { type: String, enum: RULE_GROUP_STATUSES, required: true, default: "draft" },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    // Array order IS the execution/application sequence — expandRuleGroupPolicies (and therefore
    // /assignments/resolve) returns resolved policies in this same order, so reordering this array
    // is how a client controls the order policies are applied in.
    policyRefs: { type: [policyRefSchema], required: true, default: [] },
    metadata: {
      createdBy: { type: String, required: true },
      createdAt: { type: Date, required: true, default: () => new Date() },
      updatedBy: { type: String, required: true },
      updatedAt: { type: Date, required: true, default: () => new Date() },
    },
  },
  { collection: "ruleGroups" }
);

ruleGroupSchema.index({ ruleGroupId: 1, version: -1 }, { unique: true });
ruleGroupSchema.index({ clientId: 1, status: 1 });

export const RuleGroup = model<RuleGroupDoc>("RuleGroup", ruleGroupSchema);
