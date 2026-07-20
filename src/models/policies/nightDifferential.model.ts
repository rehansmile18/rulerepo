import { registerPolicyDiscriminator } from "./discriminatorFactory";
import { TimeBand } from "./shiftDifferential.model";

// Same shape as SHIFT_DIFFERENTIAL — modeled as its own policyType because night-shift
// differentials are frequently governed by a separate statutory/contractual rule than
// general shift differentials, even though the rule mechanics are identical.
export interface NightDifferentialRules {
  timeBands: TimeBand[];
}

export const NightDifferentialPolicy = registerPolicyDiscriminator<NightDifferentialRules>("NIGHT_DIFFERENTIAL", {
  timeBands: [
    {
      start: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
      end: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
      differentialType: { type: String, enum: ["percent", "flat"], required: true },
      value: { type: Number, required: true, min: 0 },
    },
  ],
});
