import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createRuleGroupSchema,
  updateRuleGroupSchema,
  listRuleGroupsQuerySchema,
  ruleGroupIdParamSchema,
} from "./ruleGroup.validators";
import {
  listRuleGroupsHandler,
  getRuleGroupHandler,
  createRuleGroupHandler,
  updateRuleGroupHandler,
  publishRuleGroupHandler,
  archiveRuleGroupHandler,
} from "./ruleGroup.controller";

export const ruleGroupRouter = Router();
ruleGroupRouter.use(authenticate);

ruleGroupRouter.get("/rule-groups", validateRequest({ query: listRuleGroupsQuerySchema }), listRuleGroupsHandler);
ruleGroupRouter.get("/rule-groups/:ruleGroupId", validateRequest({ params: ruleGroupIdParamSchema }), getRuleGroupHandler);
ruleGroupRouter.post("/rule-groups", validateRequest({ body: createRuleGroupSchema }), createRuleGroupHandler);
ruleGroupRouter.patch(
  "/rule-groups/:ruleGroupId",
  validateRequest({ params: ruleGroupIdParamSchema, body: updateRuleGroupSchema }),
  updateRuleGroupHandler
);
ruleGroupRouter.post("/rule-groups/:ruleGroupId/publish", validateRequest({ params: ruleGroupIdParamSchema }), publishRuleGroupHandler);
ruleGroupRouter.post("/rule-groups/:ruleGroupId/archive", validateRequest({ params: ruleGroupIdParamSchema }), archiveRuleGroupHandler);
