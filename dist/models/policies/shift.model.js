"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftPolicy = void 0;
const discriminatorFactory_1 = require("./discriminatorFactory");
exports.ShiftPolicy = (0, discriminatorFactory_1.registerPolicyDiscriminator)("SHIFT", {
    minShiftLengthHours: { type: Number, required: true, min: 0, default: 2 },
    maxShiftLengthHours: { type: Number, required: true, min: 0, default: 12 },
    minRestBetweenShiftsHours: { type: Number, required: true, min: 0, default: 8 },
    splitShiftPremium: {
        enabled: { type: Boolean, default: false },
        hours: { type: Number, default: 1, min: 0 },
    },
});
//# sourceMappingURL=shift.model.js.map