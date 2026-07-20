import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createPolicySchema,
  updatePolicySchema,
  listPoliciesQuerySchema,
  policyIdParamSchema,
  clonePolicySchema,
  rejectPolicySchema,
} from "./policy.validators";
import {
  listPoliciesHandler,
  getPolicyHandler,
  getPolicyVersionsHandler,
  createPolicyHandler,
  updatePolicyHandler,
  publishPolicyHandler,
  submitPolicyForApprovalHandler,
  approvePolicyHandler,
  rejectPolicyHandler,
  archivePolicyHandler,
  clonePolicyHandler,
} from "./policy.controller";
import { POLICY_TYPES } from "../../types/domain";
import { policyRulesSchemas } from "../../models/policies/schemaRegistry";

export const policyRouter = Router();
policyRouter.use(authenticate);

policyRouter.get("/policy-types", (_req, res) => {
  res.json({
    policyTypes: POLICY_TYPES.map((policyType) => ({ policyType, ...policyRulesSchemas[policyType] })),
  });
});

policyRouter.get("/policies", validateRequest({ query: listPoliciesQuerySchema }), listPoliciesHandler);
policyRouter.get("/policies/:policyId", validateRequest({ params: policyIdParamSchema }), getPolicyHandler);
policyRouter.get("/policies/:policyId/versions", validateRequest({ params: policyIdParamSchema }), getPolicyVersionsHandler);
policyRouter.post("/policies", validateRequest({ body: createPolicySchema }), createPolicyHandler);
policyRouter.patch(
  "/policies/:policyId",
  validateRequest({ params: policyIdParamSchema, body: updatePolicySchema }),
  updatePolicyHandler
);
policyRouter.post("/policies/:policyId/publish", validateRequest({ params: policyIdParamSchema }), publishPolicyHandler);
policyRouter.post(
  "/policies/:policyId/submit-for-approval",
  validateRequest({ params: policyIdParamSchema }),
  submitPolicyForApprovalHandler
);
policyRouter.post("/policies/:policyId/approve", validateRequest({ params: policyIdParamSchema }), approvePolicyHandler);
policyRouter.post(
  "/policies/:policyId/reject",
  validateRequest({ params: policyIdParamSchema, body: rejectPolicySchema }),
  rejectPolicyHandler
);
policyRouter.post("/policies/:policyId/archive", validateRequest({ params: policyIdParamSchema }), archivePolicyHandler);
policyRouter.post(
  "/policies/:policyId/clone",
  validateRequest({ params: policyIdParamSchema, body: clonePolicySchema }),
  clonePolicyHandler
);
