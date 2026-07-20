import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../../models/user.model";
import { recordAudit } from "../../models/auditLog.model";
import { HttpError } from "../../utils/errors";
import { env } from "../../config/env";
import { LoginInput } from "./auth.validators";

export async function login(input: LoginInput) {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  // Same error for "no such user" and "wrong password" — don't leak which one it was.
  if (!user || user.status !== "active") {
    throw new HttpError(401, "Invalid email or password");
  }
  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password");
  }

  const token = jwt.sign({ userId: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
  await recordAudit({ entityType: "user", entityId: String(user._id), action: "login", actorId: String(user._id), before: null, after: null });

  return {
    token,
    user: {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      clientId: user.clientId ? String(user.clientId) : null,
    },
  };
}
