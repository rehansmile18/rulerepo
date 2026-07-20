import { registerPolicyDiscriminator } from "./discriminatorFactory";

// Generic (non-CA) meal-break rule, for states without CA's specific mechanics.
export interface MealBreakRules {
  minShiftLengthForMealMinutes: number;
  mealDurationMinMinutes: number;
  paidMeal: boolean;
  waiverAllowed: boolean;
}

export const MealBreakPolicy = registerPolicyDiscriminator<MealBreakRules>("MEAL_BREAK", {
  minShiftLengthForMealMinutes: { type: Number, required: true, min: 0, default: 360 },
  mealDurationMinMinutes: { type: Number, required: true, min: 0, default: 30 },
  paidMeal: { type: Boolean, default: false },
  waiverAllowed: { type: Boolean, default: true },
});
