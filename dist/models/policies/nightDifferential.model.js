"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NightDifferentialPolicy = void 0;
const discriminatorFactory_1 = require("./discriminatorFactory");
exports.NightDifferentialPolicy = (0, discriminatorFactory_1.registerPolicyDiscriminator)("NIGHT_DIFFERENTIAL", {
    timeBands: [
        {
            start: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
            end: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
            differentialType: { type: String, enum: ["percent", "flat"], required: true },
            value: { type: Number, required: true, min: 0 },
        },
    ],
});
//# sourceMappingURL=nightDifferential.model.js.map