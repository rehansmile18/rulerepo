import { registerPolicyDiscriminator } from "./discriminatorFactory";

export interface CaMealBreakRules {
  minShiftLengthForFirstMealMinutes: number;
  mealDurationMinMinutes: number;
  mealMustStartByHourIntoShift: number;
  waiverAllowedUnderShiftHours: number;
  secondMealRequiredOverShiftHours: number;
  onDutyMealAllowed: boolean;
  penalty: {
    type: string;
    hours: number;
    rate: string;
  };
}

export const CaMealBreakPolicy = registerPolicyDiscriminator<CaMealBreakRules>("CA_MEAL_BREAK", {
  minShiftLengthForFirstMealMinutes: { type: Number, required: true, min: 0, default: 300 },
  mealDurationMinMinutes: { type: Number, required: true, min: 0, default: 30 },
  mealMustStartByHourIntoShift: { type: Number, required: true, min: 0, default: 5 },
  waiverAllowedUnderShiftHours: { type: Number, required: true, min: 0, default: 6 },
  secondMealRequiredOverShiftHours: { type: Number, required: true, min: 0, default: 10 },
  onDutyMealAllowed: { type: Boolean, default: false },
  penalty: {
    type: { type: String, enum: ["premium_pay"], default: "premium_pay" },
    hours: { type: Number, default: 1, min: 0 },
    rate: { type: String, enum: ["regular", "overtime"], default: "regular" },
  },
});
