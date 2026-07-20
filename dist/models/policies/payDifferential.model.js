"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayDifferentialPolicy = void 0;
const discriminatorFactory_1 = require("./discriminatorFactory");
exports.PayDifferentialPolicy = (0, discriminatorFactory_1.registerPolicyDiscriminator)("PAY_DIFFERENTIAL", {
    conditions: [
        {
            type: { type: String, required: true },
            code: { type: String, required: true },
            differentialType: { type: String, enum: ["percent", "flat"], required: true },
            value: { type: Number, required: true, min: 0 },
        },
    ],
});
//# sourceMappingURL=payDifferential.model.js.map