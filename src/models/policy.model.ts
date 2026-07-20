import { Schema, model, Types } from "mongoose";
import { v4 as uuid } from "uuid";
import { POLICY_TYPES, POLICY_STATUSES, POLICY_SCOPES, PolicyType, PolicyStatus, PolicyScope } from "../types/domain";

export interface JurisdictionDoc {
  country: string;
  state: string | null;
  county: string | null;
  city: string | null;
}

export interface PolicyMetadataDoc {
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  tags: string[];
  rejectionReason: string | null;
  // Who submitted this version for approval (maker-checker). Tracked separately from the
  // author (createdBy) / last editor (updatedBy) so approval can be blocked for all of them.
  submittedBy: string | null;
}

export interface PolicyDoc {
  _id: Types.ObjectId;
  policyId: string;
  version: number;
  status: PolicyStatus;
  scope: PolicyScope;
  clientId: Types.ObjectId | null;
  clonedFromPolicyId: string | null;
  policyType: PolicyType;
  jurisdiction: JurisdictionDoc;
  name: string;
  description: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  // Not declared on the base Mongoose schema — each policyType discriminator
  // (see models/policies/*.model.ts) defines its own typed `rules` sub-schema
  // and Mongoose hydrates it based on `policyType`. Declared here only so
  // generic (type-erased) code can read/write it without a cast.
  rules: Record<string, unknown>;
  metadata: PolicyMetadataDoc;
}

const jurisdictionSchema = new Schema<JurisdictionDoc>(
  {
    country: { type: String, required: true, default: "US" },
    state: { type: String, default: null },
    county: { type: String, default: null },
    city: { type: String, default: null },
  },
  { _id: false }
);

const metadataSchema = new Schema<PolicyMetadataDoc>(
  {
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedBy: { type: String, required: true },
    updatedAt: { type: Date, required: true, default: () => new Date() },
    tags: { type: [String], default: [] },
    rejectionReason: { type: String, default: null },
    submittedBy: { type: String, default: null },
  },
  { _id: false }
);

const policySchema = new Schema<PolicyDoc>(
  {
    policyId: { type: String, required: true, default: () => uuid() },
    version: { type: Number, required: true, default: 1 },
    status: { type: String, enum: POLICY_STATUSES, required: true, default: "draft" },
    scope: { type: String, enum: POLICY_SCOPES, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    clonedFromPolicyId: { type: String, default: null },
    policyType: { type: String, enum: POLICY_TYPES, required: true },
    jurisdiction: { type: jurisdictionSchema, required: true, default: () => ({ country: "US" }) },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    // `rules` is intentionally NOT declared here — each policyType discriminator
    // (see models/policies/*.model.ts) defines its own typed `rules` sub-schema.
    // Mongoose hydrates the correct discriminator schema based on `policyType`,
    // so querying the base `Policy` model still returns fully-typed `rules`.
    metadata: { type: metadataSchema, required: true },
  },
  {
    discriminatorKey: "policyType",
    collection: "policies",
    timestamps: false,
  }
);

// scope=client requires clientId; scope=global requires clientId to be null.
policySchema.pre("validate", function (next) {
  if (this.scope === "client" && !this.clientId) {
    return next(new Error("clientId is required when scope is 'client'"));
  }
  if (this.scope === "global" && this.clientId) {
    return next(new Error("clientId must be null when scope is 'global'"));
  }
  next();
});

policySchema.index({ policyId: 1, version: -1 }, { unique: true });
policySchema.index({ clientId: 1, policyType: 1, status: 1 });
policySchema.index({ scope: 1, status: 1 });
policySchema.index({ "jurisdiction.state": 1, policyType: 1 });
policySchema.index({ effectiveFrom: 1, effectiveTo: 1 });

export const Policy = model<PolicyDoc>("Policy", policySchema);
