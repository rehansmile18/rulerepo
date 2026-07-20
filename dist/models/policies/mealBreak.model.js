"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealBreakPolicy = void 0;
const discriminatorFactory_1 = require("./discriminatorFactory");
exports.MealBreakPolicy = (0, discriminatorFactory_1.registerPolicyDiscriminator)("MEAL_BREAK", {
    minShiftLengthForMealMinutes: { type: Number, required: true, min: 0, default: 360 },
    mealDurationMinMinutes: { type: Number, required: true, min: 0, default: 30 },
    paidMeal: { type: Boolean, default: false },
    waiverAllowed: { type: Boolean, default: true },
});
//# sourceMappingURL=mealBreak.model.js.map