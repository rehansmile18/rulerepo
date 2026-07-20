import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestContext, seedPlatformAdmin, login, authed, TestContext } from "./helpers";

describe("policy lifecycle", () => {
  let ctx: TestContext;
  let adminAToken: string;
  let adminBToken: string;
  let clientId: string;
  let clientAdminToken: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("maker@example.com", "maker-password-1");
    adminAToken = await login(ctx.app, "maker@example.com", "maker-password-1");

    // A second platform admin, created via the API so the maker-checker separation test has
    // someone other than the submitter to approve with.
    const createSecondAdmin = await authed(ctx.app, adminAToken).post("/api/v1/users", {
      email: "checker@example.com",
      password: "checker-password-1",
      role: "PLATFORM_ADMIN",
    });
    expect(createSecondAdmin.status).toBe(201);
    adminBToken = await login(ctx.app, "checker@example.com", "checker-password-1");

    const client = await authed(ctx.app, adminAToken).post("/api/v1/clients", { name: "Acme Corp" });
    clientId = client.body._id;
    const clientAdmin = await authed(ctx.app, adminAToken).post("/api/v1/users", {
      email: "client-admin@acme.test",
      password: "acme-admin-pw-123",
      role: "CLIENT_ADMIN",
      clientId,
    });
    expect(clientAdmin.status).toBe(201);
    clientAdminToken = await login(ctx.app, "client-admin@acme.test", "acme-admin-pw-123");
  });
  afterAll(() => ctx.teardown());

  it("lists all 10 policy types with a rules schema", async () => {
    const res = await authed(ctx.app, adminAToken).get("/api/v1/policy-types");
    expect(res.status).toBe(200);
    expect(res.body.policyTypes).toHaveLength(10);
    expect(res.body.policyTypes.every((t: { rulesSchema: unknown }) => t.rulesSchema)).toBe(true);
  });

  it("requires the maker-checker workflow for global policies (cannot publish directly)", async () => {
    const draft = await authed(ctx.app, adminAToken).post("/api/v1/policies", {
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
    expect(draft.status).toBe(201);

    const directPublish = await authed(ctx.app, adminAToken).post(`/api/v1/policies/${draft.body.policyId}/publish`);
    expect(directPublish.status).toBe(400);
  });

  it("blocks self-approval and requires a different approver (separation of duties)", async () => {
    const draft = await authed(ctx.app, adminAToken).post("/api/v1/policies", {
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

    const submitted = await authed(ctx.app, adminAToken).post(`/api/v1/policies/${draft.body.policyId}/submit-for-approval`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe("pending_approval");

    const selfApprove = await authed(ctx.app, adminAToken).post(`/api/v1/policies/${draft.body.policyId}/approve`);
    expect(selfApprove.status).toBe(403);

    const approvedByOther = await authed(ctx.app, adminBToken).post(`/api/v1/policies/${draft.body.policyId}/approve`);
    expect(approvedByOther.status).toBe(200);
    expect(approvedByOther.body.status).toBe("active");
  });

  it("blocks the AUTHOR from self-approving even when a different user submitted it (regression)", async () => {
    // A third admin, so approver can be someone who is neither author nor submitter.
    await authed(ctx.app, adminAToken).post("/api/v1/users", { email: "admin-c@example.com", password: "adminc-password-1", role: "PLATFORM_ADMIN" });
    const adminCToken = await login(ctx.app, "admin-c@example.com", "adminc-password-1");

    // Author = A, submitter = B.
    const draft = await authed(ctx.app, adminAToken).post("/api/v1/policies", {
      scope: "global",
      policyType: "REST_BREAK",
      name: "Rest break for author-gap test",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: "2024-01-01",
      rules: { paidRestBreak: true, restBreakDurationMinutes: 10, minutesOfWorkPerRestBreak: 240, penalty: { type: "premium_pay", hours: 1, rate: "regular" } },
    });
    const policyId = draft.body.policyId;
    await authed(ctx.app, adminBToken).post(`/api/v1/policies/${policyId}/submit-for-approval`);

    // The author (A) must NOT be able to approve, despite B being the submitter.
    const authorApprove = await authed(ctx.app, adminAToken).post(`/api/v1/policies/${policyId}/approve`);
    expect(authorApprove.status).toBe(403);
    // The submitter (B) also cannot approve.
    const submitterApprove = await authed(ctx.app, adminBToken).post(`/api/v1/policies/${policyId}/approve`);
    expect(submitterApprove.status).toBe(403);
    // A genuinely independent third party (C) can.
    const thirdPartyApprove = await authed(ctx.app, adminCToken).post(`/api/v1/policies/${policyId}/approve`);
    expect(thirdPartyApprove.status).toBe(200);
    expect(thirdPartyApprove.body.status).toBe("active");
  });

  it("supports reject-and-resubmit, and versions/supersedes correctly on the next publish", async () => {
    const draft = await authed(ctx.app, adminAToken).post("/api/v1/policies", {
      scope: "global",
      policyType: "SHIFT_DIFFERENTIAL",
      name: "Evening Shift Differential",
      jurisdiction: { country: "US", state: null },
      effectiveFrom: "2024-01-01",
      rules: { timeBands: [{ start: "18:00", end: "23:59", differentialType: "percent", value: 10 }] },
    });
    const policyId = draft.body.policyId;

    await authed(ctx.app, adminAToken).post(`/api/v1/policies/${policyId}/submit-for-approval`);
    const rejected = await authed(ctx.app, adminBToken).post(`/api/v1/policies/${policyId}/reject`, { reason: "Needs a night band too" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe("draft");
    expect(rejected.body.metadata.rejectionReason).toBe("Needs a night band too");

    await authed(ctx.app, adminAToken).post(`/api/v1/policies/${policyId}/submit-for-approval`);
    const approved = await authed(ctx.app, adminBToken).post(`/api/v1/policies/${policyId}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("active");
    expect(approved.body.version).toBe(1);

    // Now version it: v2 must go through the same workflow and correctly supersede v1.
    const v2Draft = await authed(ctx.app, adminAToken).patch(`/api/v1/policies/${policyId}`, {
      effectiveFrom: "2024-07-01",
      rules: {
        timeBands: [
          { start: "18:00", end: "23:59", differentialType: "percent", value: 10 },
          { start: "00:00", end: "06:00", differentialType: "percent", value: 15 },
        ],
      },
    });
    expect(v2Draft.status).toBe(200);
    expect(v2Draft.body.version).toBe(2);

    await authed(ctx.app, adminAToken).post(`/api/v1/policies/${policyId}/submit-for-approval`);
    const v2Approved = await authed(ctx.app, adminBToken).post(`/api/v1/policies/${policyId}/approve`);
    expect(v2Approved.status).toBe(200);

    const versions = await authed(ctx.app, adminAToken).get(`/api/v1/policies/${policyId}/versions`);
    expect(versions.body.items).toHaveLength(2);
    const v1 = versions.body.items.find((v: { version: number }) => v.version === 1);
    const v2 = versions.body.items.find((v: { version: number }) => v.version === 2);
    expect(v1.status).toBe("superseded");
    expect(v1.effectiveTo).toBe("2024-07-01T00:00:00.000Z");
    expect(v2.status).toBe("active");
  });

  it("lets a client publish its own policy directly, without the approval workflow", async () => {
    const draft = await authed(ctx.app, clientAdminToken).post("/api/v1/policies", {
      scope: "client",
      clientId,
      policyType: "RATE",
      name: "Acme custom rate floor",
      effectiveFrom: "2024-01-01",
      rules: { rateType: "hourly", minimumWage: 18, minimumWageSource: "Acme internal policy" },
    });
    expect(draft.status).toBe(201);

    const published = await authed(ctx.app, clientAdminToken).post(`/api/v1/policies/${draft.body.policyId}/publish`);
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("active");
  });

  it("clones a global policy into a client-owned draft", async () => {
    const globalPolicies = await authed(ctx.app, adminAToken).get("/api/v1/policies?scope=global&status=active");
    const source = globalPolicies.body.items[0];

    const cloned = await authed(ctx.app, clientAdminToken).post(`/api/v1/policies/${source.policyId}/clone`, { clientId });
    expect(cloned.status).toBe(201);
    expect(cloned.body.scope).toBe("client");
    expect(cloned.body.clonedFromPolicyId).toBe(source.policyId);
    expect(cloned.body.status).toBe("draft");
  });

  it("archives a policy", async () => {
    const draft = await authed(ctx.app, clientAdminToken).post("/api/v1/policies", {
      scope: "client",
      clientId,
      policyType: "PAYGROUP",
      name: "Acme biweekly paygroup",
      effectiveFrom: "2024-01-01",
      rules: { payFrequency: "biweekly", workweekStart: "Sunday", defaultOvertimePolicyId: null },
    });
    const archived = await authed(ctx.app, clientAdminToken).post(`/api/v1/policies/${draft.body.policyId}/archive`);
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe("archived");
  });
});
