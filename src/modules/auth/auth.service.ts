import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../../models/user.model";
import { recordAudit } from "../../models/auditLog.model";
import { HttpError } from "../../utils/errors";
import { env } from "../../config/env";
import { LoginInput } from "./auth.validators";

// A pre-computed bcrypt hash of a random string, compared against on the user-miss path so the
// endpoint spends roughly the same time whether or not the account exists — closes the timing
// oracle that would otherwise let an attacker enumerate valid emails.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO3fUx1cQF8sWnP0G7q3xJ8kqE0aI0hK";

export async function login(input: LoginInput) {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  // Same error for "no such user" and "wrong password" — don't leak which one it was, and always
  // run a bcrypt compare so response timing doesn't reveal whether the account exists.
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || user.status !== "active" || !passwordMatches) {
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
