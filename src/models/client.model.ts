import { Schema, model, Types } from "mongoose";
import { CALENDAR_FORMATS, CalendarFormat, NUMBER_FORMATS, NumberFormat, TIME_FORMATS, TimeFormat } from "../types/domain";

export interface ClientDoc {
  _id: Types.ObjectId;
  name: string;
  status: "active" | "suspended";
  // ISO 3166-1 alpha-2 country code (e.g. "US"), or null for a global/multi-country client not
  // tied to one country — in which case enabledStates is expected to be empty.
  country: string | null;
  enabledStates: string[];
  calendarFormat: CalendarFormat;
  timeFormat: TimeFormat;
  // Regional display defaults for everyone under this client. Distinct from PayPeriodConfig's own
  // timezone/weekStartDay, which drive pay-period ARITHMETIC — these only affect rendering, and
  // must never be substituted for the pay config's own values.
  defaultTimezone: string | null; // IANA zone; null = let each site/employee supply its own
  currency: string; // ISO 4217
  numberFormat: NumberFormat;
  displayWeekStartDay: number; // 0=Sun..6=Sat — which day calendars and week pickers start on
  createdAt: Date;
  // Per-module display-name overrides (e.g. renaming "Site" to "Business Unit"), shown to every
  // user under this client, throughout the app — same tenant-wide posture as calendarFormat above.
  // Keyed by an opaque module key each frontend defines and interprets; TLM never inspects the
  // keys. One singular/plural pair per supported locale, since a single override reused across
  // languages would produce mixed-language sentences. Null means "unset" — frontends fall back to
  // their own built-in names.
  moduleLabels: Record<string, Record<"en" | "es" | "ar", { singular: string; plural: string }>> | null;
}

const clientSchema = new Schema<ClientDoc>(
  {
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended"], required: true, default: "active" },
    country: { type: String, default: null },
    enabledStates: { type: [String], default: [] },
    calendarFormat: { type: String, enum: CALENDAR_FORMATS, required: true, default: "MM/DD/YYYY" },
    timeFormat: { type: String, enum: TIME_FORMATS, required: true, default: "12h" },
    defaultTimezone: { type: String, default: null },
    currency: { type: String, required: true, default: "USD" },
    numberFormat: { type: String, enum: NUMBER_FORMATS, required: true, default: "1,234.56" },
    displayWeekStartDay: { type: Number, min: 0, max: 6, required: true, default: 0 },
    createdAt: { type: Date, required: true, default: () => new Date() },
    moduleLabels: { type: Schema.Types.Mixed, default: null },
  },
  { collection: "clients" }
);

export const Client = model<ClientDoc>("Client", clientSchema);
