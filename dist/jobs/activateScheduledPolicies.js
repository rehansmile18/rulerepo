"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateScheduledPolicies = activateScheduledPolicies;
const policy_model_1 = require("../models/policy.model");
const ruleGroup_model_1 = require("../models/ruleGroup.model");
/**
 * Flips documents whose stored `status` has drifted from what their effective
 * date range implies (an `active` version whose effectiveTo has passed becomes
 * `superseded`/`archived`). Publishing already sets effectiveTo correctly at
 * publish time — this job is a safety net for effectiveTo dates that arrive
 * after the fact with no corresponding publish action.
 */
async function activateScheduledPolicies(now = new Date()) {
    await policy_model_1.Policy.updateMany({ status: "active", effectiveTo: { $ne: null, $lte: now } }, { $set: { status: "superseded" } });
    await ruleGroup_model_1.RuleGroup.updateMany({ status: "active", effectiveTo: { $ne: null, $lte: now } }, { $set: { status: "superseded" } });
}
//# sourceMappingURL=activateScheduledPolicies.js.map