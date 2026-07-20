"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaygroupPolicy = void 0;
const discriminatorFactory_1 = require("./discriminatorFactory");
exports.PaygroupPolicy = (0, discriminatorFactory_1.registerPolicyDiscriminator)("PAYGROUP", {
    payFrequency: { type: String, enum: ["weekly", "biweekly", "semimonthly", "monthly"], required: true },
    workweekStart: {
        type: String,
        required: true,
        enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    },
    defaultOvertimePolicyId: { type: String, default: null },
});
//# sourceMappingURL=paygroup.model.js.map