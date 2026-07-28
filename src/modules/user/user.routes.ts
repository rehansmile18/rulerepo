import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import {
  changePasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateAvatarSchema,
  updateProfileSchema,
  updateUserSchema,
  userIdParamSchema,
} from "./user.validators";
import {
  changePasswordHandler,
  createUserHandler,
  getMeHandler,
  getUserByIdHandler,
  listUsersHandler,
  updateAvatarHandler,
  updateMeHandler,
  updateUserHandler,
} from "./user.controller";

// Throttles guesses at the caller's own current password — a stolen/leaked bearer token alone
// shouldn't be enough to brute-force the account's password within a live session.
const changePasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "TooManyRequests", message: "Too many attempts; try again later" },
});

export const userRouter = Router();
userRouter.use(authenticate);

// Self-service profile — every authenticated role, not just admins. Registered before the
// admin-gated routes below (same pattern as GET /clients/me).
userRouter.get("/users/me", getMeHandler);
userRouter.patch("/users/me", validateRequest({ body: updateProfileSchema }), updateMeHandler);
userRouter.patch("/users/me/avatar", validateRequest({ body: updateAvatarSchema }), updateAvatarHandler);
userRouter.post(
  "/users/me/change-password",
  changePasswordRateLimiter,
  validateRequest({ body: changePasswordSchema }),
  changePasswordHandler
);

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
userRouter.get(
  "/users/:id",
  requireRole("PLATFORM_ADMIN", "CLIENT_ADMIN"),
  validateRequest({ params: userIdParamSchema }),
  getUserByIdHandler
);
userRouter.patch(
  "/users/:id",
  requireRole("PLATFORM_ADMIN", "CLIENT_ADMIN"),
  validateRequest({ params: userIdParamSchema, body: updateUserSchema }),
  updateUserHandler
);
