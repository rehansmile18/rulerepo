"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const domain_1 = require("../types/domain");
const userSchema = new mongoose_1.Schema({
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: domain_1.USER_ROLES, required: true },
    clientId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Client", default: null },
    status: { type: String, enum: ["active", "disabled"], required: true, default: "active" },
    createdAt: { type: Date, required: true, default: () => new Date() },
}, { collection: "users" });
userSchema.pre("validate", function (next) {
    if (this.role !== "PLATFORM_ADMIN" && !this.clientId) {
        return next(new Error("clientId is required for CLIENT_ADMIN and VIEWER users"));
    }
    if (this.role === "PLATFORM_ADMIN" && this.clientId) {
        return next(new Error("clientId must be null for PLATFORM_ADMIN users"));
    }
    next();
});
exports.User = (0, mongoose_1.model)("User", userSchema);
//# sourceMappingURL=user.model.js.map