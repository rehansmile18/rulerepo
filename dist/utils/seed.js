"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const user_model_1 = require("../models/user.model");
async function main() {
    await (0, db_1.connectDb)();
    const existing = await user_model_1.User.findOne({ email: env_1.env.seedAdminEmail.toLowerCase() });
    if (existing) {
        console.log(`Seed admin ${env_1.env.seedAdminEmail} already exists — nothing to do.`);
        process.exit(0);
    }
    const passwordHash = await bcryptjs_1.default.hash(env_1.env.seedAdminPassword, 12);
    await user_model_1.User.create({
        email: env_1.env.seedAdminEmail.toLowerCase(),
        passwordHash,
        role: "PLATFORM_ADMIN",
        clientId: null,
    });
    console.log(`Seeded initial PLATFORM_ADMIN user: ${env_1.env.seedAdminEmail}`);
    console.log("Log in with this account, then create additional users via POST /api/v1/users.");
    if (env_1.env.seedAdminPassword === "change-me-immediately") {
        console.warn("WARNING: using the default seed password — set SEED_ADMIN_PASSWORD before deploying anywhere real.");
    }
    process.exit(0);
}
main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map