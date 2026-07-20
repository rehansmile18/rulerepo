import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../utils/errors";
import { UserRole } from "../types/domain";
import { User, UserDoc } from "../models/user.model";
import { asyncHandler } from "./errorHandler";

interface AuthTokenPayload {
  userId: string;
}

function isAuthTokenPayload(payload: unknown): payload is AuthTokenPayload {
  if (typeof payload !== "object" || payload === null) return false;
  return typeof (payload as Record<string, unknown>).userId === "string";
}

/**
 * Verifies the JWT signature, then re-reads the user's role/clientId/status fresh from the
 * database on every request — a token only proves *who*, the database is the source of truth
 * for *what they're allowed to do right now*. This means a disabled user or a changed role
 * takes effect immediately, without waiting for their existing tokens to expire.
 */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or malformed Authorization header");
  }
  const token = header.slice("Bearer ".length);
  let payload: unknown;
  try {
    // Pin the accepted algorithm so a token can't be presented with a different alg (e.g. "none"
    // or an RS/HS confusion) — verification only trusts the HS256 signature we actually issue.
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
  if (!isAuthTokenPayload(payload)) {
    throw new HttpError(401, "Malformed token payload");
  }

  let user: UserDoc | null = null;
  try {
    user = await User.findById(payload.userId).lean();
  } catch {
    throw new HttpError(401, "Malformed token payload");
  }
  if (!user || user.status !== "active") {
    throw new HttpError(401, "Invalid or inactive user");
  }

  req.auth = {
    userId: String(user._id),
    role: user.role,
    clientId: user.clientId ? String(user.clientId) : null,
  };
  next();
});

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw new HttpError(403, `Requires one of roles: ${roles.join(", ")}`);
    }
    next();
  };
}
