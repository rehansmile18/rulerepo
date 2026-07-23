import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { User, UserDoc } from "../../models/user.model";
import { recordAudit } from "../../models/auditLog.model";
import { BadRequestError, HttpError, NotFoundError } from "../../utils/errors";
import { ChangePasswordInput, CreateUserInput, UpdateAvatarInput, UpdateProfileInput } from "./user.validators";

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

export async function getProfile(userId: string): Promise<UserDoc> {
  const user = await User.findById(userId, { passwordHash: 0 }).lean();
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<UserDoc> {
  const user = await User.findByIdAndUpdate(userId, { $set: input }, { new: true, projection: { passwordHash: 0 } }).lean();
  if (!user) throw new NotFoundError("User not found");
  await recordAudit({
    entityType: "user",
    entityId: userId,
    action: "update_profile",
    actorId: userId,
    before: null,
    after: input,
  });
  return user;
}

export async function updateAvatar(userId: string, input: UpdateAvatarInput): Promise<UserDoc> {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { avatarUrl: input.avatarUrl } },
    { new: true, projection: { passwordHash: 0 } }
  ).lean();
  if (!user) throw new NotFoundError("User not found");
  // Record that the photo changed without duplicating the (possibly sizeable) image data itself
  // into the audit trail.
  await recordAudit({
    entityType: "user",
    entityId: userId,
    action: "update_avatar",
    actorId: userId,
    before: null,
    after: { changed: true, cleared: input.avatarUrl === null },
  });
  return user;
}

/** Requires the caller's current password — proves account ownership beyond just holding a live token. */
export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User not found");
  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!matches) throw new HttpError(401, "Current password is incorrect");
  user.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await user.save();
  // Never put password material in the audit trail — before/after stay null, the action alone is the record.
  await recordAudit({
    entityType: "user",
    entityId: userId,
    action: "change_password",
    actorId: userId,
    before: null,
    after: null,
  });
}
