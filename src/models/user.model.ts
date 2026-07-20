import { Schema, model, Types } from "mongoose";
import { USER_ROLES, UserRole } from "../types/domain";

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  clientId: Types.ObjectId | null;
  status: "active" | "disabled";
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    status: { type: String, enum: ["active", "disabled"], required: true, default: "active" },
    createdAt: { type: Date, required: true, default: () => new Date() },
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
