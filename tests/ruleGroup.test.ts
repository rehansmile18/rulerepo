import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestContext, seedPlatformAdmin, login, authed, publishGlobalPolicy, TestContext } from "./helpers";

describe("rule groups", () => {
  let ctx: TestContext;
  let adminToken: string;
  let checkerToken: string;
  let clientId: string;
  let clientAdminToken: string;
  let overtimePolicyId: string;
  let mealPolicyId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("maker@example.com", "maker-password-1");
    adminToken = await login(ctx.app, "maker@example.com", "maker-password-1");
    await authed(ctx.app, adminToken).post("/api/v1/users", { email: "checker@example.com", password: "checker-password-1", role: "PLATFORM_ADMIN" });
    checkerToken = await login(ctx.app, "checker@example.com", "checker-password-1");

    const client = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Acme Corp" });
    clientId = client.body._id;
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "client-admin@acme.test",
      password: "acme-admin-pw-123",
      role: "CLIENT_ADMIN",
      clientId,
    });
    clientAdminToken = await login(ctx.app, "client-admin@acme.test", "acme-admin-pw-123");

    const overtime = await publishGlobalPolicy(ctx.app, adminToken, checkerToken, {
      scope: "global",
      policyType: "OVERTIME",
      name: "Federal FLSA Overtime",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: "2024-01-01",
      rules: {
        workweekStartDay: "Sunday",
        weeklyOTThresholdHours: 40,
        dailyOTThresholdHours: null,
        dailyDTThresholdHours: null,
        seventhConsecutiveDayRule: { enabled: false, otAfterHours: 0, dtAfterHours: null },
      },
    });
    overtimePolicyId = overtime.policyId;

    const meal = await publishGlobalPolicy(ctx.app, adminToken, checkerToken, {
      scope: "global",
      policyType: "CA_MEAL_BREAK",
      name: "California Meal Break",
      jurisdiction: { country: "US", state: "CA" },
      effectiveFrom: "2024-01-01",
      rules: {
        minShiftLengthForFirstMealMinutes: 300,
        mealDurationMinMinutes: 30,
        mealMustStartByHourIntoShift: 5,
        waiverAllowedUnderShiftHours: 6,
        secondMealRequiredOverShiftHours: 10,
        onDutyMealAllowed: false,
        penalty: { type: "premium_pay", hours: 1, rate: "regular" },
      },
    });
    mealPolicyId = meal.policyId;
  });
  afterAll(() => ctx.teardown());

  it("bundles two policy types into a rule group and publishes it", async () => {
    const draft = await authed(ctx.app, clientAdminToken).post("/api/v1/rule-groups", {
      clientId,
      name: "RuleGroup1",
      effectiveFrom: "2024-01-01",
      policyRefs: [
        { policyId: overtimePolicyId, policyType: "OVERTIME", versionPin: "latest" },
        { policyId: mealPolicyId, policyType: "CA_MEAL_BREAK", versionPin: "latest" },
      ],
    });
    expect(draft.status).toBe(201);

    const published = await authed(ctx.app, clientAdminToken).post(`/api/v1/rule-groups/${draft.body.ruleGroupId}/publish`);
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("active");
  });

  it("rejects a policyRef the client can't see (wrong client, not global)", async () => {
    const otherClient = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Other Co" });
    const otherClientPolicy = await authed(ctx.app, adminToken).post("/api/v1/policies", {
      scope: "client",
      clientId: otherClient.body._id,
      policyType: "RATE",
      name: "Other Co rate",
      effectiveFrom: "2024-01-01",
      rules: { rateType: "hourly", minimumWage: 20, minimumWageSource: "Other Co policy" },
    });
    await authed(ctx.app, adminToken).post(`/api/v1/policies/${otherClientPolicy.body.policyId}/publish`);
    // Published, but owned by a different client — Acme's rule group still can't reference it.

    const attempt = await authed(ctx.app, clientAdminToken).post("/api/v1/rule-groups", {
      clientId,
      name: "Invalid bundle",
      effectiveFrom: "2024-01-01",
      policyRefs: [{ policyId: otherClientPolicy.body.policyId, policyType: "RATE", versionPin: "latest" }],
    });
    expect(attempt.status).toBe(400);
  });

  it("lets ANY client build a rule group entirely from global policies (no own policies needed)", async () => {
    // A brand-new client with zero client-scoped policies of its own must still be able to
    // reference the shared global (clientId: null) library — the core global-policy model.
    const freshClient = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Fresh Co" });
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "fresh-admin@test.com",
      password: "fresh-admin-pw-1",
      role: "CLIENT_ADMIN",
      clientId: freshClient.body._id,
    });
    const freshToken = await login(ctx.app, "fresh-admin@test.com", "fresh-admin-pw-1");

    const rg = await authed(ctx.app, freshToken).post("/api/v1/rule-groups", {
      clientId: freshClient.body._id,
      name: "Fresh Co from globals",
      effectiveFrom: "2024-01-01",
      policyRefs: [
        { policyId: overtimePolicyId, policyType: "OVERTIME", versionPin: "latest" },
        { policyId: mealPolicyId, policyType: "CA_MEAL_BREAK", versionPin: "latest" },
      ],
    });
    expect(rg.status).toBe(201);

    const published = await authed(ctx.app, freshToken).post(`/api/v1/rule-groups/${rg.body.ruleGroupId}/publish`);
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("active");

    // And it resolves through assignment to the fully-expanded global policies.
    await authed(ctx.app, freshToken).post("/api/v1/assignments", {
      clientId: freshClient.body._id,
      ruleGroupId: rg.body.ruleGroupId,
      targetType: "STATE",
      targetIds: ["CA"],
      effectiveFrom: "2024-01-01",
    });
    const resolved = await authed(ctx.app, freshToken).get(
      `/api/v1/assignments/resolve?clientId=${freshClient.body._id}&employeeId=emp-1&date=2024-06-01&state=CA`
    );
    expect(resolved.status).toBe(200);
    expect(resolved.body.policies).toHaveLength(2);
    expect(resolved.body.unresolvedRefs).toHaveLength(0);
  });
});
