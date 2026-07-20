import { registerPolicyDiscriminator } from "./discriminatorFactory";

export interface RateRules {
  rateType: "hourly" | "salary";
  minimumWage: number;
  minimumWageSource: string;
}

export const RatePolicy = registerPolicyDiscriminator<RateRules>("RATE", {
  rateType: { type: String, enum: ["hourly", "salary"], required: true, default: "hourly" },
  minimumWage: { type: Number, required: true, min: 0 },
  minimumWageSource: { type: String, required: true },
});
