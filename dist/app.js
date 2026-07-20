"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
require("./models/policies"); // registers all policyType discriminators
const auth_routes_1 = require("./modules/auth/auth.routes");
const user_routes_1 = require("./modules/user/user.routes");
const policy_routes_1 = require("./modules/policy/policy.routes");
const ruleGroup_routes_1 = require("./modules/ruleGroup/ruleGroup.routes");
const assignment_routes_1 = require("./modules/assignment/assignment.routes");
const client_routes_1 = require("./modules/client/client.routes");
const auditLog_routes_1 = require("./modules/auditLog/auditLog.routes");
const errorHandler_1 = require("./middleware/errorHandler");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    if (process.env.NODE_ENV !== "test") {
        app.use((0, morgan_1.default)("dev"));
    }
    app.get("/health", (_req, res) => res.json({ status: "ok" }));
    const v1 = express_1.default.Router();
    v1.use(auth_routes_1.authRouter);
    v1.use(user_routes_1.userRouter);
    v1.use(policy_routes_1.policyRouter);
    v1.use(ruleGroup_routes_1.ruleGroupRouter);
    v1.use(assignment_routes_1.assignmentRouter);
    v1.use(client_routes_1.clientRouter);
    v1.use(auditLog_routes_1.auditLogRouter);
    app.use("/api/v1", v1);
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map