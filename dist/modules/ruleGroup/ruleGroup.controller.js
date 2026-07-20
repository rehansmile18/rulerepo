"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveRuleGroupHandler = exports.publishRuleGroupHandler = exports.updateRuleGroupHandler = exports.createRuleGroupHandler = exports.getRuleGroupHandler = exports.listRuleGroupsHandler = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const tenantScope_1 = require("../../middleware/tenantScope");
const ruleGroupService = __importStar(require("./ruleGroup.service"));
exports.listRuleGroupsHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { status, page, pageSize } = req.query;
    const result = await ruleGroupService.listRuleGroups((0, tenantScope_1.getReadClientFilter)(req), status, page, pageSize);
    res.json(result);
});
exports.getRuleGroupHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const doc = await ruleGroupService.getRuleGroup(req.params.ruleGroupId, (0, tenantScope_1.getReadClientFilter)(req));
    res.json(doc);
});
exports.createRuleGroupHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const input = req.body;
    (0, tenantScope_1.assertCanWriteClient)(req, input.clientId);
    const doc = await ruleGroupService.createRuleGroup(input, req.auth.userId);
    res.status(201).json(doc);
});
exports.updateRuleGroupHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await ruleGroupService.getRuleGroup(req.params.ruleGroupId, (0, tenantScope_1.getReadClientFilter)(req));
    (0, tenantScope_1.assertCanWriteClient)(req, String(existing.clientId));
    const doc = await ruleGroupService.updateRuleGroup(req.params.ruleGroupId, req.body, (0, tenantScope_1.getReadClientFilter)(req), req.auth.userId);
    res.json(doc);
});
exports.publishRuleGroupHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await ruleGroupService.getRuleGroup(req.params.ruleGroupId, (0, tenantScope_1.getReadClientFilter)(req));
    (0, tenantScope_1.assertCanWriteClient)(req, String(existing.clientId));
    const doc = await ruleGroupService.publishRuleGroup(req.params.ruleGroupId, (0, tenantScope_1.getReadClientFilter)(req), req.auth.userId);
    res.json(doc);
});
exports.archiveRuleGroupHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await ruleGroupService.getRuleGroup(req.params.ruleGroupId, (0, tenantScope_1.getReadClientFilter)(req));
    (0, tenantScope_1.assertCanWriteClient)(req, String(existing.clientId));
    const doc = await ruleGroupService.archiveRuleGroup(req.params.ruleGroupId, (0, tenantScope_1.getReadClientFilter)(req), req.auth.userId);
    res.json(doc);
});
//# sourceMappingURL=ruleGroup.controller.js.map