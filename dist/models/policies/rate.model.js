"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RatePolicy = void 0;
const discriminatorFactory_1 = require("./discriminatorFactory");
exports.RatePolicy = (0, discriminatorFactory_1.registerPolicyDiscriminator)("RATE", {
    rateType: { type: String, enum: ["hourly", "salary"], required: true, default: "hourly" },
    minimumWage: { type: Number, required: true, min: 0 },
    minimumWageSource: { type: String, required: true },
});
//# sourceMappingURL=rate.model.js.map