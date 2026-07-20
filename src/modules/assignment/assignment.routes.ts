import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  listAssignmentsQuerySchema,
  assignmentIdParamSchema,
  resolveAssignmentQuerySchema,
} from "./assignment.validators";
import {
  listAssignmentsHandler,
  getAssignmentHandler,
  createAssignmentHandler,
  updateAssignmentHandler,
  resolveAssignmentHandler,
} from "./assignment.controller";

export const assignmentRouter = Router();
assignmentRouter.use(authenticate);

// Registered before the "/:assignmentId" route so "resolve" isn't captured as an id param.
assignmentRouter.get("/assignments/resolve", validateRequest({ query: resolveAssignmentQuerySchema }), resolveAssignmentHandler);

assignmentRouter.get("/assignments", validateRequest({ query: listAssignmentsQuerySchema }), listAssignmentsHandler);
assignmentRouter.get("/assignments/:assignmentId", validateRequest({ params: assignmentIdParamSchema }), getAssignmentHandler);
assignmentRouter.post("/assignments", validateRequest({ body: createAssignmentSchema }), createAssignmentHandler);
assignmentRouter.patch(
  "/assignments/:assignmentId",
  validateRequest({ params: assignmentIdParamSchema, body: updateAssignmentSchema }),
  updateAssignmentHandler
);
