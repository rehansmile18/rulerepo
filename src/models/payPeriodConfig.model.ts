import { Schema, model, Types } from "mongoose";
import { CADENCES, Cadence, PAY_DATE_WEEKEND_RULES, PayDateWeekendRule } from "../types/domain";

// Owned and written EXCLUSIVELY by the sibling tlm-punch-processor service's own API — see the
// comment in employee.model.ts for why this schema-only mirror exists in TLM's own codebase.
export interface PayPeriodConfigDoc {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  name: string;
  cadence: Cadence;
  timezone: string; // period boundaries computed in this tz, not UTC/server tz
  weekStartDay: number | null; // 0=Sun..6=Sat — required for weekly/biweekly
  anchorDate: string | null; // "YYYY-MM-DD" — required for biweekly (which 2-week cycle a date falls in)
  semiMonthlySplitDay: number; // default 15 — boundary between the two halves of a month
  payDateOffsetDays: number; // used unless payCalendarId is set
  payDateWeekendRule: PayDateWeekendRule;
  payCalendarId: Types.ObjectId | null; // when set, overrides payDateOffsetDays entirely
  // false only for "salaried" — gates whether the engine computes per-day hourly lines or
  // collapses the whole period to a single salary line.
  producesHourlyLines: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const payPeriodConfigSchema = new Schema<PayPeriodConfigDoc>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    cadence: { type: String, enum: CADENCES, required: true },
    timezone: { type: String, required: true },
    weekStartDay: { type: Number, min: 0, max: 6, default: null },
    anchorDate: { type: String, default: null },
    semiMonthlySplitDay: { type: Number, min: 1, max: 27, default: 15 },
    payDateOffsetDays: { type: Number, default: 0 },
    payDateWeekendRule: { type: String, enum: PAY_DATE_WEEKEND_RULES, default: "none" },
    payCalendarId: { type: Schema.Types.ObjectId, ref: "PayrollCalendar", default: null },
    producesHourlyLines: { type: Boolean, required: true, default: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "payPeriodConfigs" }
);

payPeriodConfigSchema.index({ clientId: 1, name: 1 }, { unique: true });

export const PayPeriodConfig = model<PayPeriodConfigDoc>("PayPeriodConfig", payPeriodConfigSchema);
