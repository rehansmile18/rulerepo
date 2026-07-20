import { Model } from "mongoose";
import { PolicyType } from "../../types/domain";
import { PolicyDoc } from "../policy.model";
import {
  OvertimePolicy,
  CaMealBreakPolicy,
  ShiftDifferentialPolicy,
  MealBreakPolicy,
  RestBreakPolicy,
  ShiftPolicy,
  NightDifferentialPolicy,
  PayDifferentialPolicy,
  RatePolicy,
  PaygroupPolicy,
} from "./index";

// Maps each supported policyType to its Mongoose discriminator model, so the
// policy service can construct/save documents through the type-specific model
// (which enforces that type's `rules` schema) without a giant switch statement.
export const policyDiscriminators: Record<PolicyType, Model<PolicyDoc>> = {
  OVERTIME: OvertimePolicy as unknown as Model<PolicyDoc>,
  CA_MEAL_BREAK: CaMealBreakPolicy as unknown as Model<PolicyDoc>,
  SHIFT_DIFFERENTIAL: ShiftDifferentialPolicy as unknown as Model<PolicyDoc>,
  MEAL_BREAK: MealBreakPolicy as unknown as Model<PolicyDoc>,
  REST_BREAK: RestBreakPolicy as unknown as Model<PolicyDoc>,
  SHIFT: ShiftPolicy as unknown as Model<PolicyDoc>,
  NIGHT_DIFFERENTIAL: NightDifferentialPolicy as unknown as Model<PolicyDoc>,
  PAY_DIFFERENTIAL: PayDifferentialPolicy as unknown as Model<PolicyDoc>,
  RATE: RatePolicy as unknown as Model<PolicyDoc>,
  PAYGROUP: PaygroupPolicy as unknown as Model<PolicyDoc>,
};

export function getDiscriminatorModel(policyType: PolicyType): Model<PolicyDoc> {
  const model = policyDiscriminators[policyType];
  if (!model) {
    throw new Error(`No discriminator model registered for policyType "${policyType}".`);
  }
  return model;
}
