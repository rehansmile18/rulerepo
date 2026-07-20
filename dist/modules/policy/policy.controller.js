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
exports.clonePolicyHandler = exports.archivePolicyHandler = exports.rejectPolicyHandler = exports.approvePolicyHandler = exports.submitPolicyForApprovalHandler = exports.publishPolicyHandler = exports.updatePolicyHandler = exports.createPolicyHandler = exports.getPolicyVersionsHandler = exports.getPolicyHandler = exports.listPoliciesHandler = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const tenantScope_1 = require("../../middleware/tenantScope");
const policyService = __importStar(require("./policy.service"));
exports.listPoliciesHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { policyType, clientId, scope, state, status, effectiveOn, page, pageSize } = req.query;
    const tenantFilter = getGlobalOrOwnFilter(req);
    const result = await policyService.listPolicies({
        tenantFilter,
        policyType: policyType,
        clientId,
        scope: scope,
        state,
        status,
        effectiveOn,
    }, page, pageSize);
    res.json(result);
});
exports.getPolicyHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const version = req.query.version ? Number(req.query.version) : undefined;
    const doc = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req), version);
    res.json(doc);
});
exports.getPolicyVersionsHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const docs = await policyService.getPolicyVersions(req.params.policyId, getGlobalOrOwnFilter(req));
    res.json({ items: docs });
});
exports.createPolicyHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const input = req.body;
    if (input.scope === "global") {
        (0, tenantScope_1.assertCanWriteGlobal)(req);
    }
    else {
        (0, tenantScope_1.assertCanWriteClient)(req, (0, tenantScope_1.requireClientId)(input.clientId));
    }
    const doc = await policyService.createPolicy(input, req.auth.userId);
    res.status(201).json(doc);
});
exports.updatePolicyHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req));
    authorizeWriteForExistingPolicy(req, existing);
    const doc = await policyService.updatePolicy(req.params.policyId, req.body, getGlobalOrOwnFilter(req), req.auth.userId);
    res.json(doc);
});
exports.publishPolicyHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req));
    authorizeWriteForExistingPolicy(req, existing);
    const doc = await policyService.publishPolicy(req.params.policyId, getGlobalOrOwnFilter(req), req.auth.userId);
    res.json(doc);
});
exports.submitPolicyForApprovalHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req));
    authorizeWriteForExistingPolicy(req, existing);
    const doc = await policyService.submitPolicyForApproval(req.params.policyId, getGlobalOrOwnFilter(req), req.auth.userId);
    res.json(doc);
});
exports.approvePolicyHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    (0, tenantScope_1.assertCanWriteGlobal)(req); // approval is always a platform-admin (compliance) function
    const doc = await policyService.approvePolicy(req.params.policyId, getGlobalOrOwnFilter(req), req.auth.userId);
    res.json(doc);
});
exports.rejectPolicyHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    (0, tenantScope_1.assertCanWriteGlobal)(req);
    const { reason } = req.body;
    const doc = await policyService.rejectPolicy(req.params.policyId, getGlobalOrOwnFilter(req), req.auth.userId, reason);
    res.json(doc);
});
exports.archivePolicyHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await policyService.getPolicy(req.params.policyId, getGlobalOrOwnFilter(req));
    authorizeWriteForExistingPolicy(req, existing);
    const doc = await policyService.archivePolicy(req.params.policyId, getGlobalOrOwnFilter(req), req.auth.userId);
    res.json(doc);
});
exports.clonePolicyHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { clientId, effectiveFrom } = req.body;
    (0, tenantScope_1.assertCanWriteClient)(req, (0, tenantScope_1.requireClientId)(clientId));
    const doc = await policyService.clonePolicy(req.params.policyId, clientId, req.auth.userId, effectiveFrom);
    res.status(201).json(doc);
});
// A caller may read: their own client's policies, or any global policy.
function getGlobalOrOwnFilter(req) {
    if (req.auth?.role === "PLATFORM_ADMIN")
        return {};
    return { $or: [{ scope: "global" }, { clientId: req.auth?.clientId }] };
}
function authorizeWriteForExistingPolicy(req, existing) {
    if (existing.scope === "global") {
        (0, tenantScope_1.assertCanWriteGlobal)(req);
    }
    else {
        (0, tenantScope_1.assertCanWriteClient)(req, String(existing.clientId));
    }
}
//# sourceMappingURL=policy.controller.js.map