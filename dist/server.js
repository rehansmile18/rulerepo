"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const activateScheduledPolicies_1 = require("./jobs/activateScheduledPolicies");
async function main() {
    await (0, db_1.connectDb)();
    const app = (0, app_1.createApp)();
    const server = app.listen(env_1.env.port, () => {
        console.log(`TLM Rule Repository API listening on port ${env_1.env.port}`);
    });
    const dayMs = 24 * 60 * 60 * 1000;
    const interval = setInterval(() => {
        (0, activateScheduledPolicies_1.activateScheduledPolicies)().catch((err) => console.error("activateScheduledPolicies failed", err));
    }, dayMs);
    process.on("SIGTERM", () => {
        clearInterval(interval);
        server.close(() => process.exit(0));
    });
}
main().catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map