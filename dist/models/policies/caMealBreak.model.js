"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaMealBreakPolicy = void 0;
const discriminatorFactory_1 = require("./discriminatorFactory");
exports.CaMealBreakPolicy = (0, discriminatorFactory_1.registerPolicyDiscriminator)("CA_MEAL_BREAK", {
    minShiftLengthForFirstMealMinutes: { type: Number, required: true, min: 0, default: 300 },
    mealDurationMinMinutes: { type: Number, required: true, min: 0, default: 30 },
    mealMustStartByHourIntoShift: { type: Number, required: true, min: 0, default: 5 },
    waiverAllowedUnderShiftHours: { type: Number, required: true, min: 0, default: 6 },
    secondMealRequiredOverShiftHours: { type: Number, required: true, min: 0, default: 10 },
    onDutyMealAllowed: { type: Boolean, default: false },
    penalty: {
        type: { type: String, enum: ["premium_pay"], default: "premium_pay" },
        hours: { type: Number, default: 1, min: 0 },
        rate: { type: String, enum: ["regular", "overtime"], default: "regular" },
    },
});
//# sourceMappingURL=caMealBreak.model.js.map