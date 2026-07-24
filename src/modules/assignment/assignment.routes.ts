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
  resolveAssignmentLayeredHandler,
} from "./assignment.controller";

export const assignmentRouter = Router();
assignmentRouter.use(authenticate);

// Registered before the "/:assignmentId" route so "resolve"/"resolve-layered" aren't captured as an id param.
assignmentRouter.get("/assignments/resolve", validateRequest({ query: resolveAssignmentQuerySchema }), resolveAssignmentHandler);
// Same query shape as /resolve, but returns every target-type layer that matched (e.g. an EMPLOYEE
// assignment AND a LOCATION assignment both applying to one punch) instead of one overall winner —
// used by the downstream punch-processing engine to run all applicable rule groups together.
assignmentRouter.get(
  "/assignments/resolve-layered",
  validateRequest({ query: resolveAssignmentQuerySchema }),
  resolveAssignmentLayeredHandler
);

assignmentRouter.get("/assignments", validateRequest({ query: listAssignmentsQuerySchema }), listAssignmentsHandler);
assignmentRouter.get("/assignments/:assignmentId", validateRequest({ params: assignmentIdParamSchema }), getAssignmentHandler);
assignmentRouter.post("/assignments", validateRequest({ body: createAssignmentSchema }), createAssignmentHandler);
assignmentRouter.patch(
  "/assignments/:assignmentId",
  validateRequest({ params: assignmentIdParamSchema, body: updateAssignmentSchema }),
  updateAssignmentHandler
);
