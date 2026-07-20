"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestBreakPolicy = void 0;
const discriminatorFactory_1 = require("./discriminatorFactory");
exports.RestBreakPolicy = (0, discriminatorFactory_1.registerPolicyDiscriminator)("REST_BREAK", {
    paidRestBreak: { type: Boolean, default: true },
    restBreakDurationMinutes: { type: Number, required: true, min: 0, default: 10 },
    minutesOfWorkPerRestBreak: { type: Number, required: true, min: 0, default: 240 },
    penalty: {
        type: { type: String, enum: ["premium_pay"], default: "premium_pay" },
        hours: { type: Number, default: 1, min: 0 },
        rate: { type: String, enum: ["regular", "overtime"], default: "regular" },
    },
});
//# sourceMappingURL=restBreak.model.js.map