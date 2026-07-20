import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { createUserSchema, listUsersQuerySchema } from "./user.validators";
import { listUsersHandler, createUserHandler } from "./user.controller";

export const userRouter = Router();
userRouter.use(authenticate);

// Only admins may list the user roster — a VIEWER/APPROVER must not be able to enumerate
// accounts and roles for their tenant. Tenant scoping (own-client only) is applied in the handler.
userRouter.get(
  "/users",
  requireRole("PLATFORM_ADMIN", "CLIENT_ADMIN"),
  validateRequest({ query: listUsersQuerySchema }),
  listUsersHandler
);
userRouter.post(
  "/users",
  requireRole("PLATFORM_ADMIN", "CLIENT_ADMIN"),
  validateRequest({ body: createUserSchema }),
  createUserHandler
);
