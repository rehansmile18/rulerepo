import { registerPolicyDiscriminator } from "./discriminatorFactory";

export interface RestBreakRules {
  paidRestBreak: boolean;
  restBreakDurationMinutes: number;
  minutesOfWorkPerRestBreak: number; // e.g. one 10-min break per 4 hours worked
  penalty: {
    type: string;
    hours: number;
    rate: string;
  };
}

export const RestBreakPolicy = registerPolicyDiscriminator<RestBreakRules>("REST_BREAK", {
  paidRestBreak: { type: Boolean, default: true },
  restBreakDurationMinutes: { type: Number, required: true, min: 0, default: 10 },
  minutesOfWorkPerRestBreak: { type: Number, required: true, min: 0, default: 240 },
  penalty: {
    type: { type: String, enum: ["premium_pay"], default: "premium_pay" },
    hours: { type: Number, default: 1, min: 0 },
    rate: { type: String, enum: ["regular", "overtime"], default: "regular" },
  },
});
