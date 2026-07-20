"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validateRequest_1 = require("../../middleware/validateRequest");
const assignment_validators_1 = require("./assignment.validators");
const assignment_controller_1 = require("./assignment.controller");
exports.assignmentRouter = (0, express_1.Router)();
exports.assignmentRouter.use(auth_1.authenticate);
// Registered before the "/:assignmentId" route so "resolve" isn't captured as an id param.
exports.assignmentRouter.get("/assignments/resolve", (0, validateRequest_1.validateRequest)({ query: assignment_validators_1.resolveAssignmentQuerySchema }), assignment_controller_1.resolveAssignmentHandler);
exports.assignmentRouter.get("/assignments", (0, validateRequest_1.validateRequest)({ query: assignment_validators_1.listAssignmentsQuerySchema }), assignment_controller_1.listAssignmentsHandler);
exports.assignmentRouter.get("/assignments/:assignmentId", (0, validateRequest_1.validateRequest)({ params: assignment_validators_1.assignmentIdParamSchema }), assignment_controller_1.getAssignmentHandler);
exports.assignmentRouter.post("/assignments", (0, validateRequest_1.validateRequest)({ body: assignment_validators_1.createAssignmentSchema }), assignment_controller_1.createAssignmentHandler);
exports.assignmentRouter.patch("/assignments/:assignmentId", (0, validateRequest_1.validateRequest)({ params: assignment_validators_1.assignmentIdParamSchema, body: assignment_validators_1.updateAssignmentSchema }), assignment_controller_1.updateAssignmentHandler);
//# sourceMappingURL=assignment.routes.js.map