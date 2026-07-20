"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.listUsers = listUsers;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mongoose_1 = require("mongoose");
const user_model_1 = require("../../models/user.model");
const auditLog_model_1 = require("../../models/auditLog.model");
const errors_1 = require("../../utils/errors");
const SALT_ROUNDS = 12;
async function createUser(input, actorId) {
    if (input.role !== "PLATFORM_ADMIN" && !input.clientId) {
        throw new errors_1.BadRequestError("clientId is required for CLIENT_ADMIN and VIEWER users");
    }
    const passwordHash = await bcryptjs_1.default.hash(input.password, SALT_ROUNDS);
    let user;
    try {
        user = await user_model_1.User.create({
            email: input.email.toLowerCase(),
            passwordHash,
            role: input.role,
            clientId: input.role === "PLATFORM_ADMIN" ? null : new mongoose_1.Types.ObjectId(input.clientId),
        });
    }
    catch (err) {
        if (err instanceof Error && err.message.includes("clientId")) {
            throw new errors_1.BadRequestError(err.message);
        }
        throw err;
    }
    await (0, auditLog_model_1.recordAudit)({
        entityType: "user",
        entityId: String(user._id),
        action: "create",
        actorId,
        before: null,
        after: { email: user.email, role: user.role, clientId: user.clientId },
    });
    return user;
}
async function listUsers(tenantFilter, page, pageSize) {
    const [items, total] = await Promise.all([
        user_model_1.User.find(tenantFilter, { passwordHash: 0 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean(),
        user_model_1.User.countDocuments(tenantFilter),
    ]);
    return { items, total, page, pageSize };
}
//# sourceMappingURL=user.service.js.map