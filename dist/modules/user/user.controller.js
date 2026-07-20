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
exports.createUserHandler = exports.listUsersHandler = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const tenantScope_1 = require("../../middleware/tenantScope");
const errors_1 = require("../../utils/errors");
const userService = __importStar(require("./user.service"));
exports.listUsersHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page, pageSize } = req.query;
    const result = await userService.listUsers((0, tenantScope_1.getReadClientFilter)(req), page, pageSize);
    res.json(result);
});
exports.createUserHandler = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const input = req.body;
    authorizeUserCreation(req, input);
    const user = await userService.createUser(input, req.auth.userId);
    res.status(201).json({ userId: user._id, email: user.email, role: user.role, clientId: user.clientId });
});
function authorizeUserCreation(req, input) {
    if (!req.auth)
        throw new errors_1.ForbiddenError("Not authenticated");
    if (req.auth.role === "PLATFORM_ADMIN")
        return;
    if (req.auth.role !== "CLIENT_ADMIN") {
        throw new errors_1.ForbiddenError("Only PLATFORM_ADMIN or CLIENT_ADMIN may create users");
    }
    if (input.role === "PLATFORM_ADMIN") {
        throw new errors_1.ForbiddenError("Only PLATFORM_ADMIN may create another PLATFORM_ADMIN user");
    }
    if (input.clientId !== req.auth.clientId) {
        throw new errors_1.ForbiddenError("CLIENT_ADMIN may only create users within their own client");
    }
}
//# sourceMappingURL=user.controller.js.map