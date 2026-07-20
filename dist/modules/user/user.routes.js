"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validateRequest_1 = require("../../middleware/validateRequest");
const user_validators_1 = require("./user.validators");
const user_controller_1 = require("./user.controller");
exports.userRouter = (0, express_1.Router)();
exports.userRouter.use(auth_1.authenticate);
exports.userRouter.get("/users", (0, validateRequest_1.validateRequest)({ query: user_validators_1.listUsersQuerySchema }), user_controller_1.listUsersHandler);
exports.userRouter.post("/users", (0, auth_1.requireRole)("PLATFORM_ADMIN", "CLIENT_ADMIN"), (0, validateRequest_1.validateRequest)({ body: user_validators_1.createUserSchema }), user_controller_1.createUserHandler);
//# sourceMappingURL=user.routes.js.map