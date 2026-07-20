import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { createUserSchema, listUsersQuerySchema } from "./user.validators";
import { listUsersHandler, createUserHandler } from "./user.controller";

export const userRouter = Router();
userRouter.use(authenticate);

userRouter.get("/users", validateRequest({ query: listUsersQuerySchema }), listUsersHandler);
userRouter.post(
  "/users",
  requireRole("PLATFORM_ADMIN", "CLIENT_ADMIN"),
  validateRequest({ body: createUserSchema }),
  createUserHandler
);
