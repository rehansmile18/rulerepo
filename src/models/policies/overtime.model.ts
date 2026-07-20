import { registerPolicyDiscriminator } from "./discriminatorFactory";

export interface OvertimeRules {
  workweekStartDay: string;
  dailyOTThresholdHours: number | null;
  dailyDTThresholdHours: number | null;
  weeklyOTThresholdHours: number;
  seventhConsecutiveDayRule: {
    enabled: boolean;
    otAfterHours: number;
    dtAfterHours: number | null;
  };
}

export const OvertimePolicy = registerPolicyDiscriminator<OvertimeRules>("OVERTIME", {
  workweekStartDay: {
    type: String,
    required: true,
    enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  dailyOTThresholdHours: { type: Number, default: null, min: 0 },
  dailyDTThresholdHours: { type: Number, default: null, min: 0 },
  weeklyOTThresholdHours: { type: Number, required: true, min: 0, default: 40 },
  seventhConsecutiveDayRule: {
    enabled: { type: Boolean, default: false },
    otAfterHours: { type: Number, default: 0, min: 0 },
    dtAfterHours: { type: Number, default: null, min: 0 },
  },
});
