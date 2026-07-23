import { Schema, model, Types } from "mongoose";

export type AuditEntityType = "policy" | "ruleGroup" | "assignment" | "user";
export type AuditAction =
  | "create"
  | "update"
  | "publish"
  | "archive"
  | "clone"
  | "submit_for_approval"
  | "approve"
  | "reject"
  | "login"
  | "update_profile"
  | "change_password"
  | "update_avatar";

export interface AuditLogDoc {
  _id: Types.ObjectId;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorId: string;
  before: unknown;
  after: unknown;
  timestamp: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    entityType: { type: String, enum: ["policy", "ruleGroup", "assignment", "user"], required: true },
    entityId: { type: String, required: true },
    action: {
      type: String,
      enum: [
        "create",
        "update",
        "publish",
        "archive",
        "clone",
        "submit_for_approval",
        "approve",
        "reject",
        "login",
        "update_profile",
        "change_password",
        "update_avatar",
      ],
      required: true,
    },
    actorId: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    timestamp: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "auditLogs" }
);

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const AuditLog = model<AuditLogDoc>("AuditLog", auditLogSchema);

export async function recordAudit(entry: Omit<AuditLogDoc, "_id" | "timestamp">): Promise<void> {
  await AuditLog.create({ ...entry, timestamp: new Date() });
}
