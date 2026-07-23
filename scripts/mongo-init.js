/**
 * Raw MongoDB setup script — creates indexes and seeds the same demo dataset as
 * `npm run seed:demo`, but works directly against MongoDB with no Node/npm involved.
 *
 * ⚠️  LOCAL DEMO / EXPLORATION ONLY. This seeds user accounts whose passwords are PUBLIC — they
 *     are documented in README.md and printed at the end of this script. Never run it against a
 *     production, staging, shared, or network-reachable database: anyone who can reach the API
 *     could then log in as a platform admin. It is intentionally NOT wired into any automatic
 *     Docker init hook, so a plain `docker compose up` never creates these accounts.
 *
 * Use it when you want a local database populated for exploration — e.g. inspecting it with
 * Compass/mongosh, or loading demo data into a local Docker Compose stack on purpose.
 *
 * Run it directly against a local MongoDB:
 *   mongosh "mongodb://localhost:27017/tlm_rule_repository" scripts/mongo-init.js
 *
 * Or load it into the running local Compose stack (which requires auth) on purpose:
 *   docker compose exec -T mongo mongosh \
 *     "mongodb://tlm_root:local-dev-only-change-me@localhost:27017/tlm_rule_repository?authSource=admin" \
 *     < scripts/mongo-init.js
 *
 * Idempotent: checks for the demo client and exits early if this has already been run —
 * safe to run alongside `npm run seed:demo` too (whichever runs first "wins"; the second
 * finds the same marker and skips).
 *
 * The bcrypt password hashes below were pre-generated (cost factor 10) — mongosh has no
 * bcrypt library available, so they can't be computed inline. They correspond to the plaintext
 * passwords documented in README.md and printed at the end of this script.
 */
(function () {
  const database = db.getSiblingDB("tlm_rule_repository");

  const alreadySeeded = database.clients.findOne({ name: "Acme Retail" });
  if (alreadySeeded) {
    print("Demo data already present (found client 'Acme Retail') — nothing to do.");
    return;
  }

  print("Creating indexes...");
  database.policies.createIndex({ policyId: 1, version: -1 }, { unique: true });
  database.policies.createIndex({ clientId: 1, policyType: 1, status: 1 });
  database.policies.createIndex({ scope: 1, status: 1 });
  database.policies.createIndex({ "jurisdiction.state": 1, policyType: 1 });
  database.policies.createIndex({ effectiveFrom: 1, effectiveTo: 1 });

  database.ruleGroups.createIndex({ ruleGroupId: 1, version: -1 }, { unique: true });
  database.ruleGroups.createIndex({ clientId: 1, status: 1 });

  database.assignments.createIndex({ clientId: 1, targetType: 1, targetIds: 1 });
  database.assignments.createIndex({ clientId: 1, ruleGroupId: 1 });

  database.auditLogs.createIndex({ entityType: 1, entityId: 1, timestamp: -1 });

  database.users.createIndex({ email: 1 }, { unique: true });

  print("Seeding demo data...");

  const now = new Date();
  const effectiveFrom = new Date("2024-01-01T00:00:00.000Z");

  // Pre-generated with bcrypt.hashSync(password, 10) — see file header.
  const DEMO_USERS = {
    maker: { email: "demo-admin@tlm.dev", passwordHash: "$2a$10$W/uVT70QgVslLxzeYcyw4OuR5T7rNaw7G43AUwsPzmLm2iZ1QsW.m" },
    checker: { email: "demo-checker@tlm.dev", passwordHash: "$2a$10$H2E/DKCn5zbP6EqACqX88uRXUTaVxB8SzStaQotHoUULJk4cSe4QS" },
    acmeAdmin: { email: "acme-admin@tlm.dev", passwordHash: "$2a$10$8spn1s1gLTIqW4X6eLf2tuK6Cv1yqpcJ9sIXPuMKQqniOTNDEcWIa" },
    boltAdmin: { email: "bolt-admin@tlm.dev", passwordHash: "$2a$10$iGcsElouS8HcYopodCuiXuCX2dOp4veNgQzebtN.XclCvFzX4tC/m" },
  };

  const makerId = new ObjectId();
  const checkerId = new ObjectId();
  const acmeId = new ObjectId();
  const boltId = new ObjectId();

  database.users.insertMany([
    { _id: makerId, email: DEMO_USERS.maker.email, passwordHash: DEMO_USERS.maker.passwordHash, role: "PLATFORM_ADMIN", clientId: null, status: "active", createdAt: now },
    { _id: checkerId, email: DEMO_USERS.checker.email, passwordHash: DEMO_USERS.checker.passwordHash, role: "PLATFORM_ADMIN", clientId: null, status: "active", createdAt: now },
  ]);

  database.clients.insertMany([
    { _id: acmeId, name: "Acme Retail", status: "active", country: "US", enabledStates: ["CA", "TX"], calendarFormat: "MM/DD/YYYY", createdAt: now },
    { _id: boltId, name: "Bolt Logistics", status: "active", country: "US", enabledStates: ["NY", "CA"], calendarFormat: "MM/DD/YYYY", createdAt: now },
  ]);

  database.users.insertMany([
    { email: DEMO_USERS.acmeAdmin.email, passwordHash: DEMO_USERS.acmeAdmin.passwordHash, role: "CLIENT_ADMIN", clientId: acmeId, status: "active", createdAt: now },
    { email: DEMO_USERS.boltAdmin.email, passwordHash: DEMO_USERS.boltAdmin.passwordHash, role: "CLIENT_ADMIN", clientId: boltId, status: "active", createdAt: now },
  ]);

  function metadata() {
    return { createdBy: String(makerId), createdAt: now, updatedBy: String(checkerId), updatedAt: now, tags: [], rejectionReason: null, submittedBy: null };
  }

  const POLICY_IDS = {
    overtime: "a1111111-1111-4111-8111-111111111111",
    caMealBreak: "a2222222-2222-4222-8222-222222222222",
    genericMealBreak: "a3333333-3333-4333-8333-333333333333",
    restBreak: "a4444444-4444-4444-8444-444444444444",
    shift: "a5555555-5555-4555-8555-555555555555",
    shiftDifferential: "a6666666-6666-4666-8666-666666666666",
    nightDifferential: "a7777777-7777-4777-8777-777777777777",
    payDifferential: "a8888888-8888-4888-8888-888888888888",
    rate: "a9999999-9999-4999-8999-999999999999",
    paygroup: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };

  function globalPolicy(policyId, policyType, name, jurisdiction, rules) {
    return {
      policyId,
      version: 1,
      status: "active",
      scope: "global",
      clientId: null,
      clonedFromPolicyId: null,
      policyType,
      jurisdiction,
      name,
      description: null,
      effectiveFrom,
      effectiveTo: null,
      rules,
      metadata: metadata(),
    };
  }

  database.policies.insertMany([
    globalPolicy(POLICY_IDS.overtime, "OVERTIME", "Federal FLSA Overtime", { country: "US", state: null, county: null, city: null }, {
      workweekStartDay: "Sunday",
      weeklyOTThresholdHours: 40,
      dailyOTThresholdHours: null,
      dailyDTThresholdHours: null,
      seventhConsecutiveDayRule: { enabled: false, otAfterHours: 0, dtAfterHours: null },
    }),
    globalPolicy(POLICY_IDS.caMealBreak, "CA_MEAL_BREAK", "California Meal Break", { country: "US", state: "CA", county: null, city: null }, {
      minShiftLengthForFirstMealMinutes: 300,
      mealDurationMinMinutes: 30,
      mealMustStartByHourIntoShift: 5,
      waiverAllowedUnderShiftHours: 6,
      secondMealRequiredOverShiftHours: 10,
      onDutyMealAllowed: false,
      penalty: { type: "premium_pay", hours: 1, rate: "regular" },
    }),
    globalPolicy(POLICY_IDS.genericMealBreak, "MEAL_BREAK", "Texas Meal Break (generic)", { country: "US", state: "TX", county: null, city: null }, {
      minShiftLengthForMealMinutes: 360,
      mealDurationMinMinutes: 30,
      paidMeal: false,
      waiverAllowed: true,
    }),
    globalPolicy(POLICY_IDS.restBreak, "REST_BREAK", "Standard Rest Break", { country: "US", state: null, county: null, city: null }, {
      paidRestBreak: true,
      restBreakDurationMinutes: 10,
      minutesOfWorkPerRestBreak: 240,
      penalty: { type: "premium_pay", hours: 1, rate: "regular" },
    }),
    globalPolicy(POLICY_IDS.shift, "SHIFT", "Standard Shift Rules", { country: "US", state: null, county: null, city: null }, {
      minShiftLengthHours: 2,
      maxShiftLengthHours: 12,
      minRestBetweenShiftsHours: 8,
      splitShiftPremium: { enabled: true, hours: 1 },
    }),
    globalPolicy(POLICY_IDS.shiftDifferential, "SHIFT_DIFFERENTIAL", "Evening Shift Differential", { country: "US", state: null, county: null, city: null }, {
      timeBands: [{ start: "18:00", end: "23:59", differentialType: "percent", value: 10 }],
    }),
    globalPolicy(POLICY_IDS.nightDifferential, "NIGHT_DIFFERENTIAL", "Overnight Differential", { country: "US", state: null, county: null, city: null }, {
      timeBands: [{ start: "00:00", end: "06:00", differentialType: "percent", value: 15 }],
    }),
    globalPolicy(POLICY_IDS.payDifferential, "PAY_DIFFERENTIAL", "CDL Certification Premium", { country: "US", state: null, county: null, city: null }, {
      conditions: [{ type: "certification", code: "CDL", differentialType: "flat", value: 2.5 }],
    }),
    globalPolicy(POLICY_IDS.rate, "RATE", "California Minimum Wage", { country: "US", state: "CA", county: null, city: null }, {
      rateType: "hourly",
      minimumWage: 16.5,
      minimumWageSource: "CA state minimum wage",
    }),
    globalPolicy(POLICY_IDS.paygroup, "PAYGROUP", "Standard Biweekly Paygroup", { country: "US", state: null, county: null, city: null }, {
      payFrequency: "biweekly",
      workweekStart: "Sunday",
      defaultOvertimePolicyId: POLICY_IDS.overtime,
    }),
  ]);

  const RULE_GROUP_IDS = {
    acmeCa: "b1111111-1111-4111-8111-111111111111",
    acmeTx: "b2222222-2222-4222-8222-222222222222",
    boltNy: "b3333333-3333-4333-8333-333333333333",
  };

  function policyRef(policyId, policyType) {
    return { policyId, policyType, versionPin: "latest" };
  }

  function ruleGroupMetadata() {
    return { createdBy: String(makerId), createdAt: now, updatedBy: String(makerId), updatedAt: now };
  }

  database.ruleGroups.insertMany([
    {
      ruleGroupId: RULE_GROUP_IDS.acmeCa,
      clientId: acmeId,
      name: "Acme CA Hourly Standard",
      description: null,
      version: 1,
      status: "active",
      effectiveFrom,
      effectiveTo: null,
      policyRefs: [
        policyRef(POLICY_IDS.overtime, "OVERTIME"),
        policyRef(POLICY_IDS.caMealBreak, "CA_MEAL_BREAK"),
        policyRef(POLICY_IDS.restBreak, "REST_BREAK"),
        policyRef(POLICY_IDS.shiftDifferential, "SHIFT_DIFFERENTIAL"),
        policyRef(POLICY_IDS.rate, "RATE"),
      ],
      metadata: ruleGroupMetadata(),
    },
    {
      ruleGroupId: RULE_GROUP_IDS.acmeTx,
      clientId: acmeId,
      name: "Acme TX Hourly Standard",
      description: null,
      version: 1,
      status: "active",
      effectiveFrom,
      effectiveTo: null,
      policyRefs: [
        policyRef(POLICY_IDS.overtime, "OVERTIME"),
        policyRef(POLICY_IDS.genericMealBreak, "MEAL_BREAK"),
        policyRef(POLICY_IDS.shift, "SHIFT"),
      ],
      metadata: ruleGroupMetadata(),
    },
    {
      ruleGroupId: RULE_GROUP_IDS.boltNy,
      clientId: boltId,
      name: "Bolt NY Logistics Standard",
      description: null,
      version: 1,
      status: "active",
      effectiveFrom,
      effectiveTo: null,
      policyRefs: [
        policyRef(POLICY_IDS.overtime, "OVERTIME"),
        policyRef(POLICY_IDS.nightDifferential, "NIGHT_DIFFERENTIAL"),
        policyRef(POLICY_IDS.payDifferential, "PAY_DIFFERENTIAL"),
        policyRef(POLICY_IDS.paygroup, "PAYGROUP"),
      ],
      metadata: ruleGroupMetadata(),
    },
  ]);

  database.assignments.insertMany([
    { clientId: acmeId, ruleGroupId: RULE_GROUP_IDS.acmeCa, targetType: "STATE", targetIds: ["CA"], priority: 0, effectiveFrom, effectiveTo: null, status: "active" },
    { clientId: acmeId, ruleGroupId: RULE_GROUP_IDS.acmeTx, targetType: "STATE", targetIds: ["TX"], priority: 0, effectiveFrom, effectiveTo: null, status: "active" },
    // emp-1001 gets their own rule group even though they're in CA — demonstrates EMPLOYEE beating STATE on resolve.
    { clientId: acmeId, ruleGroupId: RULE_GROUP_IDS.acmeTx, targetType: "EMPLOYEE", targetIds: ["emp-1001"], priority: 0, effectiveFrom, effectiveTo: null, status: "active" },
    { clientId: boltId, ruleGroupId: RULE_GROUP_IDS.boltNy, targetType: "STATE", targetIds: ["NY"], priority: 0, effectiveFrom, effectiveTo: null, status: "active" },
  ]);

  print("=".repeat(72));
  print("Demo data ready. Log in at POST /api/v1/auth/login with any of:");
  print("");
  print("  Platform admin (maker)   demo-admin@tlm.dev / Demo-Admin-Pass1!");
  print("  Platform admin (checker) demo-checker@tlm.dev / Demo-Checker-Pass1!");
  print("  Acme Retail admin        acme-admin@tlm.dev / Acme-Admin-Pass1!");
  print("  Bolt Logistics admin     bolt-admin@tlm.dev / Bolt-Admin-Pass1!");
  print("");
  print("  Acme Retail clientId: " + acmeId);
  print("  Bolt Logistics clientId: " + boltId);
  print("=".repeat(72));
})();
