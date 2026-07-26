import { Schema, model, Types } from "mongoose";

// Owned and written EXCLUSIVELY by the sibling tlm-punch-processor service's own API — this file
// exists only so the shape of data living in this database is documented/typed here too, since
// this service (TLM) physically hosts the collection. Nothing in TLM's own code should create,
// update, or delete Employee documents through this model; if TLM ever needs to read one (e.g. a
// future cross-service feature), import this file rather than re-declaring the shape elsewhere.
// Field-for-field mirror of tlm-punch-processor's src/models/employee.model.ts — keep the two in
// sync if either changes, since they describe the same physical collection.
export interface EmployeeDoc {
  _id: Types.ObjectId;
  employeeId: string; // external reference id (matches whatever upstream HRIS/payroll uses)
  clientId: Types.ObjectId;
  employeeGroupId: Types.ObjectId | null;
  timezone: string; // IANA tz, e.g. "America/Los_Angeles"
  payPeriodConfigId: Types.ObjectId | null; // falls back to the employeeGroup's config when null
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<EmployeeDoc>(
  {
    employeeId: { type: String, required: true, trim: true },
    clientId: { type: Schema.Types.ObjectId, required: true },
    employeeGroupId: { type: Schema.Types.ObjectId, ref: "EmployeeGroup", default: null },
    timezone: { type: String, required: true },
    payPeriodConfigId: { type: Schema.Types.ObjectId, ref: "PayPeriodConfig", default: null },
    status: { type: String, enum: ["active", "inactive"], required: true, default: "active" },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "employees" }
);

employeeSchema.index({ clientId: 1, employeeId: 1 }, { unique: true });

export const Employee = model<EmployeeDoc>("Employee", employeeSchema);
