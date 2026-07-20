import { Schema, model, Types } from "mongoose";
import { ASSIGNMENT_TARGET_TYPES, ASSIGNMENT_STATUSES, AssignmentTargetType, AssignmentStatus } from "../types/domain";

export interface AssignmentDoc {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  ruleGroupId: string;
  targetType: AssignmentTargetType;
  targetIds: string[];
  priority: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: AssignmentStatus;
}

const assignmentSchema = new Schema<AssignmentDoc>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    ruleGroupId: { type: String, required: true },
    targetType: { type: String, enum: ASSIGNMENT_TARGET_TYPES, required: true },
    targetIds: { type: [String], required: true, validate: (v: string[]) => v.length > 0 },
    priority: { type: Number, required: true, default: 0 },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    status: { type: String, enum: ASSIGNMENT_STATUSES, required: true, default: "active" },
  },
  { collection: "assignments" }
);

assignmentSchema.index({ clientId: 1, targetType: 1, targetIds: 1 });
assignmentSchema.index({ clientId: 1, ruleGroupId: 1 });

export const Assignment = model<AssignmentDoc>("Assignment", assignmentSchema);
