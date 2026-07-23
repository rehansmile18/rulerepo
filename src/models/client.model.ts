import { Schema, model, Types } from "mongoose";
import { CALENDAR_FORMATS, CalendarFormat } from "../types/domain";

export interface ClientDoc {
  _id: Types.ObjectId;
  name: string;
  status: "active" | "suspended";
  // ISO 3166-1 alpha-2 country code (e.g. "US"), or null for a global/multi-country client not
  // tied to one country — in which case enabledStates is expected to be empty.
  country: string | null;
  enabledStates: string[];
  calendarFormat: CalendarFormat;
  createdAt: Date;
}

const clientSchema = new Schema<ClientDoc>(
  {
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended"], required: true, default: "active" },
    country: { type: String, default: null },
    enabledStates: { type: [String], default: [] },
    calendarFormat: { type: String, enum: CALENDAR_FORMATS, required: true, default: "MM/DD/YYYY" },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "clients" }
);

export const Client = model<ClientDoc>("Client", clientSchema);
