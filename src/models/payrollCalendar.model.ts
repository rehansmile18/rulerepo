import { Schema, model, Types } from "mongoose";

// Owned and written EXCLUSIVELY by the sibling tlm-punch-processor service's own API — see the
// comment in employee.model.ts for why this schema-only mirror exists in TLM's own codebase.
export interface PayrollCalendarRow {
  periodEnd: Date; // "YYYY-MM-DD" boundary date this row's payDate applies to
  payDate: Date;
}

export interface PayrollCalendarDoc {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  name: string;
  rows: PayrollCalendarRow[];
  createdAt: Date;
  updatedAt: Date;
}

const payrollCalendarSchema = new Schema<PayrollCalendarDoc>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    rows: {
      type: [
        {
          periodEnd: { type: Date, required: true },
          payDate: { type: Date, required: true },
        },
      ],
      default: [],
    },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "payrollCalendars" }
);

payrollCalendarSchema.index({ clientId: 1, name: 1 }, { unique: true });

export const PayrollCalendar = model<PayrollCalendarDoc>("PayrollCalendar", payrollCalendarSchema);
