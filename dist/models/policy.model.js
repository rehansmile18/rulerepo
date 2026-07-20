"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Policy = void 0;
const mongoose_1 = require("mongoose");
const uuid_1 = require("uuid");
const domain_1 = require("../types/domain");
const jurisdictionSchema = new mongoose_1.Schema({
    country: { type: String, required: true, default: "US" },
    state: { type: String, default: null },
    county: { type: String, default: null },
    city: { type: String, default: null },
}, { _id: false });
const metadataSchema = new mongoose_1.Schema({
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedBy: { type: String, required: true },
    updatedAt: { type: Date, required: true, default: () => new Date() },
    tags: { type: [String], default: [] },
    rejectionReason: { type: String, default: null },
}, { _id: false });
const policySchema = new mongoose_1.Schema({
    policyId: { type: String, required: true, default: () => (0, uuid_1.v4)() },
    version: { type: Number, required: true, default: 1 },
    status: { type: String, enum: domain_1.POLICY_STATUSES, required: true, default: "draft" },
    scope: { type: String, enum: domain_1.POLICY_SCOPES, required: true },
    clientId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Client", default: null },
    clonedFromPolicyId: { type: String, default: null },
    policyType: { type: String, enum: domain_1.POLICY_TYPES, required: true },
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
}, {
    discriminatorKey: "policyType",
    collection: "policies",
    timestamps: false,
});
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
exports.Policy = (0, mongoose_1.model)("Policy", policySchema);
//# sourceMappingURL=policy.model.js.map