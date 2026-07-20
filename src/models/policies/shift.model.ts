import { registerPolicyDiscriminator } from "./discriminatorFactory";

export interface ShiftRules {
  minShiftLengthHours: number;
  maxShiftLengthHours: number;
  minRestBetweenShiftsHours: number;
  splitShiftPremium: {
    enabled: boolean;
    hours: number;
  };
}

export const ShiftPolicy = registerPolicyDiscriminator<ShiftRules>("SHIFT", {
  minShiftLengthHours: { type: Number, required: true, min: 0, default: 2 },
  maxShiftLengthHours: { type: Number, required: true, min: 0, default: 12 },
  minRestBetweenShiftsHours: { type: Number, required: true, min: 0, default: 8 },
  splitShiftPremium: {
    enabled: { type: Boolean, default: false },
    hours: { type: Number, default: 1, min: 0 },
  },
});
