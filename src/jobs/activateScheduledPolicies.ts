import { Policy } from "../models/policy.model";
import { RuleGroup } from "../models/ruleGroup.model";

/**
 * Flips documents whose stored `status` has drifted from what their effective
 * date range implies (an `active` version whose effectiveTo has passed becomes
 * `superseded`/`archived`). Publishing already sets effectiveTo correctly at
 * publish time — this job is a safety net for effectiveTo dates that arrive
 * after the fact with no corresponding publish action.
 */
export async function activateScheduledPolicies(now: Date = new Date()): Promise<void> {
  await Policy.updateMany(
    { status: "active", effectiveTo: { $ne: null, $lte: now } },
    { $set: { status: "superseded" } }
  );
  await RuleGroup.updateMany(
    { status: "active", effectiveTo: { $ne: null, $lte: now } },
    { $set: { status: "superseded" } }
  );
}
