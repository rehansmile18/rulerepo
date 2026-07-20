"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const validateRequest_1 = require("../../middleware/validateRequest");
const auth_validators_1 = require("./auth.validators");
const auth_controller_1 = require("./auth.controller");
exports.authRouter = (0, express_1.Router)();
// Deliberately not behind `authenticate` — this is how a caller gets a token in the first place.
exports.authRouter.post("/auth/login", (0, validateRequest_1.validateRequest)({ body: auth_validators_1.loginSchema }), auth_controller_1.loginHandler);
//# sourceMappingURL=auth.routes.js.map