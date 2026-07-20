import { Schema, model, Types } from "mongoose";

export interface ClientDoc {
  _id: Types.ObjectId;
  name: string;
  status: "active" | "suspended";
  enabledStates: string[];
  createdAt: Date;
}

const clientSchema = new Schema<ClientDoc>(
  {
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended"], required: true, default: "active" },
    enabledStates: { type: [String], default: [] },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "clients" }
);

export const Client = model<ClientDoc>("Client", clientSchema);
