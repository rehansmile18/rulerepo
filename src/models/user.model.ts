import { Schema, model, Types } from "mongoose";
import {
  CALENDAR_FORMATS,
  CalendarFormat,
  PREFERRED_LANGUAGES,
  PreferredLanguage,
  TIME_FORMATS,
  TimeFormat,
  USER_ROLES,
  UserRole,
} from "../types/domain";

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  clientId: Types.ObjectId | null;
  // Site ids (matching Site.siteId — owned by the sibling tlm-site-ops service, not a local
  // ObjectId ref) this user is scoped to. Only meaningful for SITE_MANAGER; empty for every other
  // role.
  siteIds: string[];
  // Opaque, freely-editable capability keys (e.g. "employee:write") defined and enforced entirely
  // by tlm-site-ops, not TLM — TLM just stores/returns them via GET /users/me, the same posture as
  // siteIds above. Not tied to role: two users with the same role can have different permissions.
  permissions: string[];
  status: "active" | "disabled";
  createdAt: Date;
  // Personal preferences, distinct from the client-wide calendarFormat/timeFormat. Null means
  // "unset" — the frontend falls back to its own default.
  preferredLanguage: PreferredLanguage | null;
  preferredDateFormat: CalendarFormat | null;
  preferredTimeFormat: TimeFormat | null;
  // A base64 data: URL (frontend pre-resizes to a small square before upload) — no object storage
  // dependency needed for an avatar this small. Null means no photo; frontend falls back to initials.
  avatarUrl: string | null;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    siteIds: { type: [String], default: [] },
    permissions: { type: [String], default: [] },
    status: { type: String, enum: ["active", "disabled"], required: true, default: "active" },
    createdAt: { type: Date, required: true, default: () => new Date() },
    preferredLanguage: { type: String, enum: PREFERRED_LANGUAGES, default: null },
    preferredDateFormat: { type: String, enum: CALENDAR_FORMATS, default: null },
    preferredTimeFormat: { type: String, enum: TIME_FORMATS, default: null },
    avatarUrl: { type: String, default: null },
  },
  { collection: "users" }
);

userSchema.pre("validate", function (next) {
  if (this.role !== "PLATFORM_ADMIN" && !this.clientId) {
    return next(new Error("clientId is required for CLIENT_ADMIN, VIEWER, and SITE_MANAGER users"));
  }
  if (this.role === "PLATFORM_ADMIN" && this.clientId) {
    return next(new Error("clientId must be null for PLATFORM_ADMIN users"));
  }
  if (this.role === "SITE_MANAGER" && this.siteIds.length === 0) {
    return next(new Error("siteIds must have at least one entry for SITE_MANAGER users"));
  }
  next();
});

export const User = model<UserDoc>("User", userSchema);
