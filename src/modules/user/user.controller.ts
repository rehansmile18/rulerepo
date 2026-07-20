import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { getReadClientFilter } from "../../middleware/tenantScope";
import { ForbiddenError } from "../../utils/errors";
import * as userService from "./user.service";
import { CreateUserInput } from "./user.validators";

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await userService.listUsers(getReadClientFilter(req), page, pageSize);
  res.json(result);
});

export const createUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateUserInput;
  authorizeUserCreation(req, input);
  const user = await userService.createUser(input, req.auth!.userId);
  res.status(201).json({ userId: user._id, email: user.email, role: user.role, clientId: user.clientId });
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
