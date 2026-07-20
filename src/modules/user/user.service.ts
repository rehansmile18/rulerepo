import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { User, UserDoc } from "../../models/user.model";
import { recordAudit } from "../../models/auditLog.model";
import { BadRequestError } from "../../utils/errors";
import { CreateUserInput } from "./user.validators";

const SALT_ROUNDS = 12;

export async function createUser(input: CreateUserInput, actorId: string): Promise<UserDoc> {
  if (input.role !== "PLATFORM_ADMIN" && !input.clientId) {
    throw new BadRequestError("clientId is required for CLIENT_ADMIN and VIEWER users");
  }
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  let user: InstanceType<typeof User>;
  try {
    user = await User.create({
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      clientId: input.role === "PLATFORM_ADMIN" ? null : new Types.ObjectId(input.clientId),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("clientId")) {
      throw new BadRequestError(err.message);
    }
    throw err;
  }
  await recordAudit({
    entityType: "user",
    entityId: String(user._id),
    action: "create",
    actorId,
    before: null,
    after: { email: user.email, role: user.role, clientId: user.clientId },
  });
  return user;
}

export async function listUsers(tenantFilter: Record<string, unknown>, page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    User.find(tenantFilter, { passwordHash: 0 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    User.countDocuments(tenantFilter),
  ]);
  return { items, total, page, pageSize };
}
