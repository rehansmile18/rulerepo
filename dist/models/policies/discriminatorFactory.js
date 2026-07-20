"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPolicyDiscriminator = registerPolicyDiscriminator;
const mongoose_1 = require("mongoose");
const policy_model_1 = require("../policy.model");
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
function registerPolicyDiscriminator(policyType, rulesSchemaDefinition) {
    const discriminatorSchema = new mongoose_1.Schema({
        rules: new mongoose_1.Schema(rulesSchemaDefinition, { _id: false }),
    });
    const discriminatorModel = policy_model_1.Policy.discriminator(policyType, discriminatorSchema);
    return discriminatorModel;
}
//# sourceMappingURL=discriminatorFactory.js.map