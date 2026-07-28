import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadClientFilter } from "../../middleware/tenantScope";
import { ForbiddenError } from "../../utils/errors";
import * as userService from "./user.service";
import {
  ChangePasswordInput,
  CreateUserInput,
  UpdateAvatarInput,
  UpdateProfileInput,
  UpdateUserInput,
} from "./user.validators";

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await userService.listUsers(getReadClientFilter(req), page, pageSize);
  res.json(result);
});

export const getMeHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getProfile(req.auth!.userId);
  res.json(user);
});

export const updateMeHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateProfile(req.auth!.userId, req.body as UpdateProfileInput);
  res.json(user);
});

export const changePasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  await userService.changePassword(req.auth!.userId, req.body as ChangePasswordInput);
  res.status(204).send();
});

export const updateAvatarHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateAvatar(req.auth!.userId, req.body as UpdateAvatarInput);
  res.json(user);
});

export const createUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateUserInput;
  authorizeUserCreation(req, input);
  const user = await userService.createUser(input, req.auth!.userId);
  res.status(201).json({
    userId: user._id,
    email: user.email,
    role: user.role,
    clientId: user.clientId,
    siteIds: user.siteIds,
    permissions: user.permissions,
  });
});

export const getUserByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id, getReadClientFilter(req));
  res.json(user);
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as UpdateUserInput;
  // Load under the caller's own read filter first (so a cross-client id 404s instead of leaking
  // whether it exists), then authorize the specific mutation against its current + target state —
  // mirrors employee.controller.ts's updateEmployeeHandler pattern used elsewhere in this codebase.
  await userService.getUserById(req.params.id, getReadClientFilter(req));
  authorizeUserUpdate(req, input);
  const user = await userService.updateUser(req.params.id, input, req.auth!.userId);
  res.json(user);
});

function authorizeUserCreation(req: Request, input: CreateUserInput): void {
  if (!req.auth) throw new ForbiddenError("Not authenticated");
  if (req.auth.role === "PLATFORM_ADMIN") return;
  if (req.auth.role !== "CLIENT_ADMIN") {
    throw new ForbiddenError("Only PLATFORM_ADMIN or CLIENT_ADMIN may create users");
  }
  if (input.role === "PLATFORM_ADMIN") {
    throw new ForbiddenError("Only PLATFORM_ADMIN may create another PLATFORM_ADMIN user");
  }
  if (input.clientId !== req.auth.clientId) {
    throw new ForbiddenError("CLIENT_ADMIN may only create users within their own client");
  }
}

// `existing` was already fetched under the caller's own getReadClientFilter — for a CLIENT_ADMIN
// that filter alone guarantees `existing` can neither belong to another client nor be a
// PLATFORM_ADMIN (whose clientId is always null, so it'd never match a client-scoped query), so
// only the escalation checks below are actually reachable; both branches would otherwise be dead code.
function authorizeUserUpdate(req: Request, input: UpdateUserInput): void {
  if (!req.auth) throw new ForbiddenError("Not authenticated");
  if (req.auth.role === "PLATFORM_ADMIN") return;
  if (req.auth.role !== "CLIENT_ADMIN") {
    throw new ForbiddenError("Only PLATFORM_ADMIN or CLIENT_ADMIN may edit users");
  }
  if (input.role === "PLATFORM_ADMIN") {
    throw new ForbiddenError("Only PLATFORM_ADMIN may promote a user to PLATFORM_ADMIN");
  }
  if (input.clientId !== undefined && input.clientId !== req.auth.clientId) {
    throw new ForbiddenError("CLIENT_ADMIN may only move users within their own client");
  }
}
