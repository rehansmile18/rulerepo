// Side-effect imports: each file registers its policyType as a Mongoose discriminator
// on the base Policy model. Import this module once at startup before any Policy query.
import "./overtime.model";
import "./caMealBreak.model";
import "./shiftDifferential.model";
import "./mealBreak.model";
import "./restBreak.model";
import "./shift.model";
import "./nightDifferential.model";
import "./payDifferential.model";
import "./rate.model";
import "./paygroup.model";

export { OvertimePolicy } from "./overtime.model";
export { CaMealBreakPolicy } from "./caMealBreak.model";
export { ShiftDifferentialPolicy } from "./shiftDifferential.model";
export { MealBreakPolicy } from "./mealBreak.model";
export { RestBreakPolicy } from "./restBreak.model";
export { ShiftPolicy } from "./shift.model";
export { NightDifferentialPolicy } from "./nightDifferential.model";
export { PayDifferentialPolicy } from "./payDifferential.model";
export { RatePolicy } from "./rate.model";
export { PaygroupPolicy } from "./paygroup.model";
