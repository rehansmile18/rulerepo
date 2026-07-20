"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OvertimePolicy = void 0;
const discriminatorFactory_1 = require("./discriminatorFactory");
exports.OvertimePolicy = (0, discriminatorFactory_1.registerPolicyDiscriminator)("OVERTIME", {
    workweekStartDay: {
        type: String,
        required: true,
        enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    },
    dailyOTThresholdHours: { type: Number, default: null, min: 0 },
    dailyDTThresholdHours: { type: Number, default: null, min: 0 },
    weeklyOTThresholdHours: { type: Number, required: true, min: 0, default: 40 },
    seventhConsecutiveDayRule: {
        enabled: { type: Boolean, default: false },
        otAfterHours: { type: Number, default: 0, min: 0 },
        dtAfterHours: { type: Number, default: null, min: 0 },
    },
});
//# sourceMappingURL=overtime.model.js.map