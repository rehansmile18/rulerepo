"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaygroupPolicy = exports.RatePolicy = exports.PayDifferentialPolicy = exports.NightDifferentialPolicy = exports.ShiftPolicy = exports.RestBreakPolicy = exports.MealBreakPolicy = exports.ShiftDifferentialPolicy = exports.CaMealBreakPolicy = exports.OvertimePolicy = void 0;
// Side-effect imports: each file registers its policyType as a Mongoose discriminator
// on the base Policy model. Import this module once at startup before any Policy query.
require("./overtime.model");
require("./caMealBreak.model");
require("./shiftDifferential.model");
require("./mealBreak.model");
require("./restBreak.model");
require("./shift.model");
require("./nightDifferential.model");
require("./payDifferential.model");
require("./rate.model");
require("./paygroup.model");
var overtime_model_1 = require("./overtime.model");
Object.defineProperty(exports, "OvertimePolicy", { enumerable: true, get: function () { return overtime_model_1.OvertimePolicy; } });
var caMealBreak_model_1 = require("./caMealBreak.model");
Object.defineProperty(exports, "CaMealBreakPolicy", { enumerable: true, get: function () { return caMealBreak_model_1.CaMealBreakPolicy; } });
var shiftDifferential_model_1 = require("./shiftDifferential.model");
Object.defineProperty(exports, "ShiftDifferentialPolicy", { enumerable: true, get: function () { return shiftDifferential_model_1.ShiftDifferentialPolicy; } });
var mealBreak_model_1 = require("./mealBreak.model");
Object.defineProperty(exports, "MealBreakPolicy", { enumerable: true, get: function () { return mealBreak_model_1.MealBreakPolicy; } });
var restBreak_model_1 = require("./restBreak.model");
Object.defineProperty(exports, "RestBreakPolicy", { enumerable: true, get: function () { return restBreak_model_1.RestBreakPolicy; } });
var shift_model_1 = require("./shift.model");
Object.defineProperty(exports, "ShiftPolicy", { enumerable: true, get: function () { return shift_model_1.ShiftPolicy; } });
var nightDifferential_model_1 = require("./nightDifferential.model");
Object.defineProperty(exports, "NightDifferentialPolicy", { enumerable: true, get: function () { return nightDifferential_model_1.NightDifferentialPolicy; } });
var payDifferential_model_1 = require("./payDifferential.model");
Object.defineProperty(exports, "PayDifferentialPolicy", { enumerable: true, get: function () { return payDifferential_model_1.PayDifferentialPolicy; } });
var rate_model_1 = require("./rate.model");
Object.defineProperty(exports, "RatePolicy", { enumerable: true, get: function () { return rate_model_1.RatePolicy; } });
var paygroup_model_1 = require("./paygroup.model");
Object.defineProperty(exports, "PaygroupPolicy", { enumerable: true, get: function () { return paygroup_model_1.PaygroupPolicy; } });
//# sourceMappingURL=index.js.map