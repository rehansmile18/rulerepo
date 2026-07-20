"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const errors_1 = require("../utils/errors");
const user_model_1 = require("../models/user.model");
const errorHandler_1 = require("./errorHandler");
function isAuthTokenPayload(payload) {
    if (typeof payload !== "object" || payload === null)
        return false;
    return typeof payload.userId === "string";
}
/**
 * Verifies the JWT signature, then re-reads the user's role/clientId/status fresh from the
 * database on every request — a token only proves *who*, the database is the source of truth
 * for *what they're allowed to do right now*. This means a disabled user or a changed role
 * takes effect immediately, without waiting for their existing tokens to expire.
 */
exports.authenticate = (0, errorHandler_1.asyncHandler)(async (req, _res, next) => {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
        throw new errors_1.HttpError(401, "Missing or malformed Authorization header");
    }
    const token = header.slice("Bearer ".length);
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
    }
    catch {
        throw new errors_1.HttpError(401, "Invalid or expired token");
    }
    if (!isAuthTokenPayload(payload)) {
        throw new errors_1.HttpError(401, "Malformed token payload");
    }
    let user = null;
    try {
        user = await user_model_1.User.findById(payload.userId).lean();
    }
    catch {
        throw new errors_1.HttpError(401, "Malformed token payload");
    }
    if (!user || user.status !== "active") {
        throw new errors_1.HttpError(401, "Invalid or inactive user");
    }
    req.auth = {
        userId: String(user._id),
        role: user.role,
        clientId: user.clientId ? String(user.clientId) : null,
    };
    next();
});
function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.auth || !roles.includes(req.auth.role)) {
            throw new errors_1.HttpError(403, `Requires one of roles: ${roles.join(", ")}`);
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map