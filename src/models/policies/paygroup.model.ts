import { registerPolicyDiscriminator } from "./discriminatorFactory";

export interface PaygroupRules {
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
  workweekStart: string;
  defaultOvertimePolicyId: string | null;
}

export const PaygroupPolicy = registerPolicyDiscriminator<PaygroupRules>("PAYGROUP", {
  payFrequency: { type: String, enum: ["weekly", "biweekly", "semimonthly", "monthly"], required: true },
  workweekStart: {
    type: String,
    required: true,
    enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  defaultOvertimePolicyId: { type: String, default: null },
});
