"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyDiscriminators = void 0;
exports.getDiscriminatorModel = getDiscriminatorModel;
const index_1 = require("./index");
// Maps each supported policyType to its Mongoose discriminator model, so the
// policy service can construct/save documents through the type-specific model
// (which enforces that type's `rules` schema) without a giant switch statement.
exports.policyDiscriminators = {
    OVERTIME: index_1.OvertimePolicy,
    CA_MEAL_BREAK: index_1.CaMealBreakPolicy,
    SHIFT_DIFFERENTIAL: index_1.ShiftDifferentialPolicy,
    MEAL_BREAK: index_1.MealBreakPolicy,
    REST_BREAK: index_1.RestBreakPolicy,
    SHIFT: index_1.ShiftPolicy,
    NIGHT_DIFFERENTIAL: index_1.NightDifferentialPolicy,
    PAY_DIFFERENTIAL: index_1.PayDifferentialPolicy,
    RATE: index_1.RatePolicy,
    PAYGROUP: index_1.PaygroupPolicy,
};
function getDiscriminatorModel(policyType) {
    const model = exports.policyDiscriminators[policyType];
    if (!model) {
        throw new Error(`No discriminator model registered for policyType "${policyType}".`);
    }
    return model;
}
//# sourceMappingURL=registry.js.map