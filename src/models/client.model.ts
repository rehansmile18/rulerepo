import { Schema, model, Types } from "mongoose";
import { CALENDAR_FORMATS, CalendarFormat, TIME_FORMATS, TimeFormat } from "../types/domain";

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
    createdAt: { type: Date, required: true, default: () => new Date() },
    moduleLabels: { type: Schema.Types.Mixed, default: null },
  },
  { collection: "clients" }
);

export const Client = model<ClientDoc>("Client", clientSchema);
