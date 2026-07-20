"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validateRequest_1 = require("../../middleware/validateRequest");
const policy_validators_1 = require("./policy.validators");
const policy_controller_1 = require("./policy.controller");
const domain_1 = require("../../types/domain");
const schemaRegistry_1 = require("../../models/policies/schemaRegistry");
exports.policyRouter = (0, express_1.Router)();
exports.policyRouter.use(auth_1.authenticate);
exports.policyRouter.get("/policy-types", (_req, res) => {
    res.json({
        policyTypes: domain_1.POLICY_TYPES.map((policyType) => ({ policyType, ...schemaRegistry_1.policyRulesSchemas[policyType] })),
    });
});
exports.policyRouter.get("/policies", (0, validateRequest_1.validateRequest)({ query: policy_validators_1.listPoliciesQuerySchema }), policy_controller_1.listPoliciesHandler);
exports.policyRouter.get("/policies/:policyId", (0, validateRequest_1.validateRequest)({ params: policy_validators_1.policyIdParamSchema }), policy_controller_1.getPolicyHandler);
exports.policyRouter.get("/policies/:policyId/versions", (0, validateRequest_1.validateRequest)({ params: policy_validators_1.policyIdParamSchema }), policy_controller_1.getPolicyVersionsHandler);
exports.policyRouter.post("/policies", (0, validateRequest_1.validateRequest)({ body: policy_validators_1.createPolicySchema }), policy_controller_1.createPolicyHandler);
exports.policyRouter.patch("/policies/:policyId", (0, validateRequest_1.validateRequest)({ params: policy_validators_1.policyIdParamSchema, body: policy_validators_1.updatePolicySchema }), policy_controller_1.updatePolicyHandler);
exports.policyRouter.post("/policies/:policyId/publish", (0, validateRequest_1.validateRequest)({ params: policy_validators_1.policyIdParamSchema }), policy_controller_1.publishPolicyHandler);
exports.policyRouter.post("/policies/:policyId/submit-for-approval", (0, validateRequest_1.validateRequest)({ params: policy_validators_1.policyIdParamSchema }), policy_controller_1.submitPolicyForApprovalHandler);
exports.policyRouter.post("/policies/:policyId/approve", (0, validateRequest_1.validateRequest)({ params: policy_validators_1.policyIdParamSchema }), policy_controller_1.approvePolicyHandler);
exports.policyRouter.post("/policies/:policyId/reject", (0, validateRequest_1.validateRequest)({ params: policy_validators_1.policyIdParamSchema, body: policy_validators_1.rejectPolicySchema }), policy_controller_1.rejectPolicyHandler);
exports.policyRouter.post("/policies/:policyId/archive", (0, validateRequest_1.validateRequest)({ params: policy_validators_1.policyIdParamSchema }), policy_controller_1.archivePolicyHandler);
exports.policyRouter.post("/policies/:policyId/clone", (0, validateRequest_1.validateRequest)({ params: policy_validators_1.policyIdParamSchema, body: policy_validators_1.clonePolicySchema }), policy_controller_1.clonePolicyHandler);
//# sourceMappingURL=policy.routes.js.map