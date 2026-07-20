import { Schema, Model } from "mongoose";
import { Policy, PolicyDoc } from "../policy.model";
import { PolicyType } from "../../types/domain";

/**
 * Registers a policyType-specific `rules` sub-schema as a Mongoose discriminator
 * on the base Policy model, keeping the polymorphic-pattern boilerplate in one place.
 *
 * Deliberately untyped at the Mongoose-generic level (no `Model.discriminator<T>()`):
 * feeding a custom generic through Mongoose 8's discriminator overloads causes
 * pathological TypeScript type-instantiation (observed OOM-crashing `tsc` even at an
 * 8GB heap). We register the schema loosely, then cast once to our own `PolicyDoc`
 * shape for application-level typing.
 */
export function registerPolicyDiscriminator<T>(
  policyType: PolicyType,
  rulesSchemaDefinition: Record<string, unknown>
): Model<PolicyDoc & { rules: T }> {
  const discriminatorSchema = new Schema({
    rules: new Schema(rulesSchemaDefinition, { _id: false }),
  });

  const discriminatorModel: unknown = Policy.discriminator(policyType, discriminatorSchema);
  return discriminatorModel as Model<PolicyDoc & { rules: T }>;
}
