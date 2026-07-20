import { registerPolicyDiscriminator } from "./discriminatorFactory";

export interface TimeBand {
  start: string; // "HH:mm", 24hr
  end: string; // "HH:mm", 24hr — may be < start to represent an overnight band
  differentialType: "percent" | "flat";
  value: number;
}

export interface ShiftDifferentialRules {
  timeBands: TimeBand[];
}

export const ShiftDifferentialPolicy = registerPolicyDiscriminator<ShiftDifferentialRules>("SHIFT_DIFFERENTIAL", {
  timeBands: [
    {
      start: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
      end: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
      differentialType: { type: String, enum: ["percent", "flat"], required: true },
      value: { type: Number, required: true, min: 0 },
    },
  ],
});
