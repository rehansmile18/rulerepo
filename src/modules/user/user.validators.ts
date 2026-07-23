import { z } from "zod";
import { CALENDAR_FORMATS, PREFERRED_LANGUAGES, USER_ROLES } from "../../types/domain";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(USER_ROLES),
  clientId: z.string().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const listUsersQuerySchema = z.object({
  clientId: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateProfileSchema = z.object({
  preferredLanguage: z.enum(PREFERRED_LANGUAGES).nullable().optional(),
  preferredDateFormat: z.enum(CALENDAR_FORMATS).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Deliberately not "min 8" only — a distinct message per rule reads better in the profile form,
// but the schema itself just needs to keep the same floor as account creation.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const AVATAR_DATA_URL_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+=*)$/;
const MAX_AVATAR_BYTES = 1_000_000; // 1MB decoded — the frontend resizes to a small square first

/** Estimates the decoded byte size of a base64 payload without actually allocating a Buffer for it. */
function decodedBase64ByteSize(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export const updateAvatarSchema = z.object({
  avatarUrl: z
    .string()
    .regex(AVATAR_DATA_URL_PATTERN, "Must be a PNG/JPEG/WebP image data URL")
    .refine((value) => {
      const match = value.match(AVATAR_DATA_URL_PATTERN);
      return match ? decodedBase64ByteSize(match[2]) <= MAX_AVATAR_BYTES : false;
    }, "Image is too large")
    .nullable(),
});
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
