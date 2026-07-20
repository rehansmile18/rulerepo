"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
function required(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
exports.env = {
    port: Number(process.env.PORT ?? 4000),
    mongoUri: required("MONGODB_URI", "mongodb://localhost:27017/tlm_rule_repository"),
    jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
    nodeEnv: process.env.NODE_ENV ?? "development",
    // Maker-checker control for global (statutory) policy approvals: when true, the user who
    // approves a global policy must differ from the user who submitted it for approval.
    // Defaults to true (real compliance behavior); set to false only for solo dev/demo use.
    requireApprovalSeparation: process.env.REQUIRE_APPROVAL_SEPARATION !== "false",
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "change-me-immediately",
};
//# sourceMappingURL=env.js.map