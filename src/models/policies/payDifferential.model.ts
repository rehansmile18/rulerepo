import { registerPolicyDiscriminator } from "./discriminatorFactory";

export interface PayDifferentialCondition {
  type: string; // e.g. "certification", "hazard", "location"
  code: string;
  differentialType: "percent" | "flat";
  value: number;
}

export interface PayDifferentialRules {
  conditions: PayDifferentialCondition[];
}

export const PayDifferentialPolicy = registerPolicyDiscriminator<PayDifferentialRules>("PAY_DIFFERENTIAL", {
  conditions: [
    {
      type: { type: String, required: true },
      code: { type: String, required: true },
      differentialType: { type: String, enum: ["percent", "flat"], required: true },
      value: { type: Number, required: true, min: 0 },
    },
  ],
});
