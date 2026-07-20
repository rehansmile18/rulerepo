"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const user_model_1 = require("../../models/user.model");
const auditLog_model_1 = require("../../models/auditLog.model");
const errors_1 = require("../../utils/errors");
const env_1 = require("../../config/env");
async function login(input) {
    const user = await user_model_1.User.findOne({ email: input.email.toLowerCase() });
    // Same error for "no such user" and "wrong password" — don't leak which one it was.
    if (!user || user.status !== "active") {
        throw new errors_1.HttpError(401, "Invalid email or password");
    }
    const passwordMatches = await bcryptjs_1.default.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
        throw new errors_1.HttpError(401, "Invalid email or password");
    }
    const token = jsonwebtoken_1.default.sign({ userId: String(user._id) }, env_1.env.jwtSecret, { expiresIn: env_1.env.jwtExpiresIn });
    await (0, auditLog_model_1.recordAudit)({ entityType: "user", entityId: String(user._id), action: "login", actorId: String(user._id), before: null, after: null });
    return {
        token,
        user: {
            userId: String(user._id),
            email: user.email,
            role: user.role,
            clientId: user.clientId ? String(user.clientId) : null,
        },
    };
}
//# sourceMappingURL=auth.service.js.map