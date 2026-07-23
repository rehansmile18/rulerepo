/**
 * Populates a fresh MongoDB with realistic demo data so anyone cloning this repo can start
 * exploring the API immediately: two demo platform admins, two demo clients with their own
 * admin users, a published global policy for every policy type, a rule group per client, and
 * assignments that demonstrate specificity-based resolution (state-wide vs. employee-specific).
 *
 * This is separate from `npm run seed` (src/utils/seed.ts), which only bootstraps the single
 * production admin account. Run this one when you want something to actually look at.
 *
 * Usage:  npm run seed:demo
 * Safe to re-run — it checks for existing demo data and exits early instead of duplicating it.
 */
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { connectDb } from "../config/db";
import { User } from "../models/user.model";
import { Client } from "../models/client.model";
import * as policyService from "../modules/policy/policy.service";
import * as ruleGroupService from "../modules/ruleGroup/ruleGroup.service";
import * as assignmentService from "../modules/assignment/assignment.service";
import * as userService from "../modules/user/user.service";
import { CreatePolicyInput } from "../modules/policy/policy.validators";

const DEMO_PASSWORD_HASH_ROUNDS = 10;

const DEMO_USERS = {
  maker: { email: "demo-admin@tlm.dev", password: "Demo-Admin-Pass1!" },
  checker: { email: "demo-checker@tlm.dev", password: "Demo-Checker-Pass1!" },
  acmeAdmin: { email: "acme-admin@tlm.dev", password: "Acme-Admin-Pass1!" },
  boltAdmin: { email: "bolt-admin@tlm.dev", password: "Bolt-Admin-Pass1!" },
};

async function createPlatformAdmin(email: string, password: string): Promise<string> {
  const passwordHash = await bcrypt.hash(password, DEMO_PASSWORD_HASH_ROUNDS);
  const user = await User.create({ email, passwordHash, role: "PLATFORM_ADMIN", clientId: null });
  return String(user._id);
}

/** Creates a global policy and pushes it through submit-for-approval + approve, returning the active policy. */
async function publishGlobalPolicy(input: CreatePolicyInput, makerId: string, checkerId: string) {
  const draft = await policyService.createPolicy(input, makerId);
  await policyService.submitPolicyForApproval(draft.policyId, {}, makerId);
  return policyService.approvePolicy(draft.policyId, {}, checkerId);
}

async function main(): Promise<void> {
  // Hard stop in production: this seeder creates accounts with well-known passwords committed to
  // the repo. Running it against a production database would hand out platform-admin credentials.
  if (env.isProduction) {
    console.error(
      "Refusing to run the demo seeder with NODE_ENV=production — it creates accounts with public, well-known passwords.\n" +
        "Use `npm run seed` for the real bootstrap admin instead, or unset NODE_ENV/set it to development for a local demo."
    );
    process.exit(1);
  }

  await connectDb();

  const alreadySeeded = await Client.findOne({ name: "Acme Retail" });
  if (alreadySeeded) {
    console.log("Demo data already present (found client 'Acme Retail') — nothing to do.");
    console.log("If you want to reseed from scratch, drop the database and run this script again.");
    process.exit(0);
  }

  console.log("Seeding demo data...\n");

  const makerId = await createPlatformAdmin(DEMO_USERS.maker.email, DEMO_USERS.maker.password);
  const checkerId = await createPlatformAdmin(DEMO_USERS.checker.email, DEMO_USERS.checker.password);
  console.log("Created 2 platform admins (maker + checker, for the approval workflow)");

  const acme = await Client.create({
    name: "Acme Retail",
    status: "active",
    country: "US",
    enabledStates: ["CA", "TX"],
    calendarFormat: "MM/DD/YYYY",
  });
  const bolt = await Client.create({
    name: "Bolt Logistics",
    status: "active",
    country: "US",
    enabledStates: ["NY", "CA"],
    calendarFormat: "MM/DD/YYYY",
  });
  console.log("Created 2 clients: Acme Retail, Bolt Logistics");

  await userService.createUser(
    { email: DEMO_USERS.acmeAdmin.email, password: DEMO_USERS.acmeAdmin.password, role: "CLIENT_ADMIN", clientId: String(acme._id) },
    makerId
  );
  await userService.createUser(
    { email: DEMO_USERS.boltAdmin.email, password: DEMO_USERS.boltAdmin.password, role: "CLIENT_ADMIN", clientId: String(bolt._id) },
    makerId
  );
  console.log("Created a CLIENT_ADMIN user for each client");

  console.log("\nPublishing one global policy per policy type (via submit-for-approval + approve)...");

  const overtime = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "OVERTIME",
      name: "Federal FLSA Overtime",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: new Date("2024-01-01"),
      rules: {
        workweekStartDay: "Sunday",
        weeklyOTThresholdHours: 40,
        dailyOTThresholdHours: null,
        dailyDTThresholdHours: null,
        seventhConsecutiveDayRule: { enabled: false, otAfterHours: 0, dtAfterHours: null },
      },
    },
    makerId,
    checkerId
  );

  const caMealBreak = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "CA_MEAL_BREAK",
      name: "California Meal Break",
      jurisdiction: { country: "US", state: "CA" },
      effectiveFrom: new Date("2024-01-01"),
      rules: {
        minShiftLengthForFirstMealMinutes: 300,
        mealDurationMinMinutes: 30,
        mealMustStartByHourIntoShift: 5,
        waiverAllowedUnderShiftHours: 6,
        secondMealRequiredOverShiftHours: 10,
        onDutyMealAllowed: false,
        penalty: { type: "premium_pay", hours: 1, rate: "regular" },
      },
    },
    makerId,
    checkerId
  );

  const genericMealBreak = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "MEAL_BREAK",
      name: "Texas Meal Break (generic)",
      jurisdiction: { country: "US", state: "TX" },
      effectiveFrom: new Date("2024-01-01"),
      rules: { minShiftLengthForMealMinutes: 360, mealDurationMinMinutes: 30, paidMeal: false, waiverAllowed: true },
    },
    makerId,
    checkerId
  );

  const restBreak = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "REST_BREAK",
      name: "Standard Rest Break",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: new Date("2024-01-01"),
      rules: {
        paidRestBreak: true,
        restBreakDurationMinutes: 10,
        minutesOfWorkPerRestBreak: 240,
        penalty: { type: "premium_pay", hours: 1, rate: "regular" },
      },
    },
    makerId,
    checkerId
  );

  const shift = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "SHIFT",
      name: "Standard Shift Rules",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: new Date("2024-01-01"),
      rules: { minShiftLengthHours: 2, maxShiftLengthHours: 12, minRestBetweenShiftsHours: 8, splitShiftPremium: { enabled: true, hours: 1 } },
    },
    makerId,
    checkerId
  );

  const shiftDifferential = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "SHIFT_DIFFERENTIAL",
      name: "Evening Shift Differential",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: new Date("2024-01-01"),
      rules: { timeBands: [{ start: "18:00", end: "23:59", differentialType: "percent", value: 10 }] },
    },
    makerId,
    checkerId
  );

  const nightDifferential = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "NIGHT_DIFFERENTIAL",
      name: "Overnight Differential",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: new Date("2024-01-01"),
      rules: { timeBands: [{ start: "00:00", end: "06:00", differentialType: "percent", value: 15 }] },
    },
    makerId,
    checkerId
  );

  const payDifferential = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "PAY_DIFFERENTIAL",
      name: "CDL Certification Premium",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: new Date("2024-01-01"),
      rules: { conditions: [{ type: "certification", code: "CDL", differentialType: "flat", value: 2.5 }] },
    },
    makerId,
    checkerId
  );

  const rate = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "RATE",
      name: "California Minimum Wage",
      jurisdiction: { country: "US", state: "CA" },
      effectiveFrom: new Date("2024-01-01"),
      rules: { rateType: "hourly", minimumWage: 16.5, minimumWageSource: "CA state minimum wage" },
    },
    makerId,
    checkerId
  );

  const paygroup = await publishGlobalPolicy(
    {
      scope: "global",
      policyType: "PAYGROUP",
      name: "Standard Biweekly Paygroup",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: new Date("2024-01-01"),
      rules: { payFrequency: "biweekly", workweekStart: "Sunday", defaultOvertimePolicyId: overtime.policyId },
    },
    makerId,
    checkerId
  );

  console.log("Published 10/10 global policies");

  console.log("\nBundling rule groups and publishing them...");

  const acmeCaRuleGroup = await ruleGroupService.createRuleGroup(
    {
      clientId: String(acme._id),
      name: "Acme CA Hourly Standard",
      effectiveFrom: new Date("2024-01-01"),
      policyRefs: [
        { policyId: overtime.policyId, policyType: "OVERTIME", versionPin: "latest" },
        { policyId: caMealBreak.policyId, policyType: "CA_MEAL_BREAK", versionPin: "latest" },
        { policyId: restBreak.policyId, policyType: "REST_BREAK", versionPin: "latest" },
        { policyId: shiftDifferential.policyId, policyType: "SHIFT_DIFFERENTIAL", versionPin: "latest" },
        { policyId: rate.policyId, policyType: "RATE", versionPin: "latest" },
      ],
    },
    makerId
  );
  await ruleGroupService.publishRuleGroup(acmeCaRuleGroup.ruleGroupId, {}, makerId);

  const acmeTxRuleGroup = await ruleGroupService.createRuleGroup(
    {
      clientId: String(acme._id),
      name: "Acme TX Hourly Standard",
      effectiveFrom: new Date("2024-01-01"),
      policyRefs: [
        { policyId: overtime.policyId, policyType: "OVERTIME", versionPin: "latest" },
        { policyId: genericMealBreak.policyId, policyType: "MEAL_BREAK", versionPin: "latest" },
        { policyId: shift.policyId, policyType: "SHIFT", versionPin: "latest" },
      ],
    },
    makerId
  );
  await ruleGroupService.publishRuleGroup(acmeTxRuleGroup.ruleGroupId, {}, makerId);

  const boltNyRuleGroup = await ruleGroupService.createRuleGroup(
    {
      clientId: String(bolt._id),
      name: "Bolt NY Logistics Standard",
      effectiveFrom: new Date("2024-01-01"),
      policyRefs: [
        { policyId: overtime.policyId, policyType: "OVERTIME", versionPin: "latest" },
        { policyId: nightDifferential.policyId, policyType: "NIGHT_DIFFERENTIAL", versionPin: "latest" },
        { policyId: payDifferential.policyId, policyType: "PAY_DIFFERENTIAL", versionPin: "latest" },
        { policyId: paygroup.policyId, policyType: "PAYGROUP", versionPin: "latest" },
      ],
    },
    makerId
  );
  await ruleGroupService.publishRuleGroup(boltNyRuleGroup.ruleGroupId, {}, makerId);

  console.log("Published 3 rule groups (Acme CA, Acme TX, Bolt NY)");

  console.log("\nCreating assignments (state-wide + one employee-specific override, to show specificity resolution)...");

  await assignmentService.createAssignment(
    { clientId: String(acme._id), ruleGroupId: acmeCaRuleGroup.ruleGroupId, targetType: "STATE", targetIds: ["CA"], priority: 0, effectiveFrom: new Date("2024-01-01") },
    makerId
  );
  await assignmentService.createAssignment(
    { clientId: String(acme._id), ruleGroupId: acmeTxRuleGroup.ruleGroupId, targetType: "STATE", targetIds: ["TX"], priority: 0, effectiveFrom: new Date("2024-01-01") },
    makerId
  );
  // emp-1001 gets their own rule group even though they're in CA — demonstrates EMPLOYEE beating STATE on resolve.
  await assignmentService.createAssignment(
    { clientId: String(acme._id), ruleGroupId: acmeTxRuleGroup.ruleGroupId, targetType: "EMPLOYEE", targetIds: ["emp-1001"], priority: 0, effectiveFrom: new Date("2024-01-01") },
    makerId
  );
  await assignmentService.createAssignment(
    { clientId: String(bolt._id), ruleGroupId: boltNyRuleGroup.ruleGroupId, targetType: "STATE", targetIds: ["NY"], priority: 0, effectiveFrom: new Date("2024-01-01") },
    makerId
  );

  console.log("Created 4 assignments\n");

  console.log("=".repeat(72));
  console.log("Demo data ready. Log in at POST /api/v1/auth/login with any of:\n");
  console.log(`  Platform admin (maker)   ${DEMO_USERS.maker.email} / ${DEMO_USERS.maker.password}`);
  console.log(`  Platform admin (checker) ${DEMO_USERS.checker.email} / ${DEMO_USERS.checker.password}`);
  console.log(`  Acme Retail admin        ${DEMO_USERS.acmeAdmin.email} / ${DEMO_USERS.acmeAdmin.password}`);
  console.log(`  Bolt Logistics admin     ${DEMO_USERS.boltAdmin.email} / ${DEMO_USERS.boltAdmin.password}`);
  console.log(`\n  Acme Retail clientId: ${acme._id}`);
  console.log(`  Bolt Logistics clientId: ${bolt._id}`);
  console.log("\nLog in first to get a bearer token, then call resolve with it, e.g. as the Acme Retail admin:");
  console.log(`  curl -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"email":"${DEMO_USERS.acmeAdmin.email}","password":"${DEMO_USERS.acmeAdmin.password}"}'`);
  console.log("\nThen, with that token, compare the CA state-wide employee vs. the emp-1001 override:");
  console.log(`  GET /api/v1/assignments/resolve?clientId=${acme._id}&employeeId=any-ca-employee&date=2024-06-01&state=CA`);
  console.log(`  GET /api/v1/assignments/resolve?clientId=${acme._id}&employeeId=emp-1001&date=2024-06-01&state=CA`);
  console.log("=".repeat(72));

  process.exit(0);
}

main().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
