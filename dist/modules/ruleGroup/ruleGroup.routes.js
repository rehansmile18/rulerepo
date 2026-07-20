"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ruleGroupRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validateRequest_1 = require("../../middleware/validateRequest");
const ruleGroup_validators_1 = require("./ruleGroup.validators");
const ruleGroup_controller_1 = require("./ruleGroup.controller");
exports.ruleGroupRouter = (0, express_1.Router)();
exports.ruleGroupRouter.use(auth_1.authenticate);
exports.ruleGroupRouter.get("/rule-groups", (0, validateRequest_1.validateRequest)({ query: ruleGroup_validators_1.listRuleGroupsQuerySchema }), ruleGroup_controller_1.listRuleGroupsHandler);
exports.ruleGroupRouter.get("/rule-groups/:ruleGroupId", (0, validateRequest_1.validateRequest)({ params: ruleGroup_validators_1.ruleGroupIdParamSchema }), ruleGroup_controller_1.getRuleGroupHandler);
exports.ruleGroupRouter.post("/rule-groups", (0, validateRequest_1.validateRequest)({ body: ruleGroup_validators_1.createRuleGroupSchema }), ruleGroup_controller_1.createRuleGroupHandler);
exports.ruleGroupRouter.patch("/rule-groups/:ruleGroupId", (0, validateRequest_1.validateRequest)({ params: ruleGroup_validators_1.ruleGroupIdParamSchema, body: ruleGroup_validators_1.updateRuleGroupSchema }), ruleGroup_controller_1.updateRuleGroupHandler);
exports.ruleGroupRouter.post("/rule-groups/:ruleGroupId/publish", (0, validateRequest_1.validateRequest)({ params: ruleGroup_validators_1.ruleGroupIdParamSchema }), ruleGroup_controller_1.publishRuleGroupHandler);
exports.ruleGroupRouter.post("/rule-groups/:ruleGroupId/archive", (0, validateRequest_1.validateRequest)({ params: ruleGroup_validators_1.ruleGroupIdParamSchema }), ruleGroup_controller_1.archiveRuleGroupHandler);
//# sourceMappingURL=ruleGroup.routes.js.map