import { Schema, model, Types } from "mongoose";
import { CALENDAR_FORMATS, CalendarFormat, PREFERRED_LANGUAGES, PreferredLanguage, USER_ROLES, UserRole } from "../types/domain";

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  clientId: Types.ObjectId | null;
  status: "active" | "disabled";
  createdAt: Date;
  // Personal preferences, distinct from the client-wide calendarFormat. Null means "unset" — the
  // frontend falls back to its own default.
  preferredLanguage: PreferredLanguage | null;
  preferredDateFormat: CalendarFormat | null;
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
    status: { type: String, enum: ["active", "disabled"], required: true, default: "active" },
    createdAt: { type: Date, required: true, default: () => new Date() },
    preferredLanguage: { type: String, enum: PREFERRED_LANGUAGES, default: null },
    preferredDateFormat: { type: String, enum: CALENDAR_FORMATS, default: null },
    avatarUrl: { type: String, default: null },
  },
  { collection: "users" }
);

userSchema.pre("validate", function (next) {
  if (this.role !== "PLATFORM_ADMIN" && !this.clientId) {
    return next(new Error("clientId is required for CLIENT_ADMIN and VIEWER users"));
  }
  if (this.role === "PLATFORM_ADMIN" && this.clientId) {
    return next(new Error("clientId must be null for PLATFORM_ADMIN users"));
  }
  next();
});

export const User = model<UserDoc>("User", userSchema);
