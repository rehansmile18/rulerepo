import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestContext, seedPlatformAdmin, login, authed, publishGlobalPolicy, TestContext } from "./helpers";

describe("assignment resolution", () => {
  let ctx: TestContext;
  let adminToken: string;
  let checkerToken: string;
  let clientId: string;
  let clientAdminToken: string;
  let overtimePolicyId: string;
  let stateRuleGroupId: string;
  let employeeRuleGroupId: string;

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

    // Two rule groups: a broad one for the whole state, and a more specific one for one employee.
    const stateRuleGroup = await authed(ctx.app, clientAdminToken).post("/api/v1/rule-groups", {
      clientId,
      name: "CA Standard",
      effectiveFrom: "2024-01-01",
      policyRefs: [{ policyId: overtimePolicyId, policyType: "OVERTIME", versionPin: "latest" }],
    });
    await authed(ctx.app, clientAdminToken).post(`/api/v1/rule-groups/${stateRuleGroup.body.ruleGroupId}/publish`);
    stateRuleGroupId = stateRuleGroup.body.ruleGroupId;

    const employeeRuleGroup = await authed(ctx.app, clientAdminToken).post("/api/v1/rule-groups", {
      clientId,
      name: "Executive Exception",
      effectiveFrom: "2024-01-01",
      policyRefs: [{ policyId: overtimePolicyId, policyType: "OVERTIME", versionPin: "latest" }],
    });
    await authed(ctx.app, clientAdminToken).post(`/api/v1/rule-groups/${employeeRuleGroup.body.ruleGroupId}/publish`);
    employeeRuleGroupId = employeeRuleGroup.body.ruleGroupId;

    await authed(ctx.app, clientAdminToken).post("/api/v1/assignments", {
      clientId,
      ruleGroupId: stateRuleGroupId,
      targetType: "STATE",
      targetIds: ["CA"],
      effectiveFrom: "2024-01-01",
    });
    await authed(ctx.app, clientAdminToken).post("/api/v1/assignments", {
      clientId,
      ruleGroupId: employeeRuleGroupId,
      targetType: "EMPLOYEE",
      targetIds: ["emp-999"],
      effectiveFrom: "2024-01-01",
    });
  });
  afterAll(() => ctx.teardown());

  it("resolves the employee-specific rule group over the broader state one", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve?clientId=${clientId}&employeeId=emp-999&date=2024-06-01&state=CA`
    );
    expect(res.status).toBe(200);
    expect(res.body.ruleGroup.ruleGroupId).toBe(employeeRuleGroupId);
  });

  it("falls back to the state-wide rule group for an employee with no specific assignment", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve?clientId=${clientId}&employeeId=emp-other&date=2024-06-01&state=CA`
    );
    expect(res.status).toBe(200);
    expect(res.body.ruleGroup.ruleGroupId).toBe(stateRuleGroupId);
  });

  it("returns 404 when nothing resolves", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve?clientId=${clientId}&employeeId=emp-other&date=2024-06-01&state=TX`
    );
    expect(res.status).toBe(404);
  });

  it("resolves the historically-correct policy version for a past date after a new version is approved", async () => {
    const v2Draft = await authed(ctx.app, adminToken).patch(`/api/v1/policies/${overtimePolicyId}`, {
      effectiveFrom: "2024-07-01",
      rules: {
        workweekStartDay: "Sunday",
        weeklyOTThresholdHours: 40,
        dailyOTThresholdHours: 8,
        dailyDTThresholdHours: 12,
        seventhConsecutiveDayRule: { enabled: true, otAfterHours: 0, dtAfterHours: 8 },
      },
    });
    expect(v2Draft.status).toBe(200);
    await authed(ctx.app, adminToken).post(`/api/v1/policies/${overtimePolicyId}/submit-for-approval`);
    await authed(ctx.app, checkerToken).post(`/api/v1/policies/${overtimePolicyId}/approve`);

    const before = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve?clientId=${clientId}&employeeId=emp-999&date=2024-06-01&state=CA`
    );
    const otBefore = before.body.policies.find((p: { policyType: string }) => p.policyType === "OVERTIME");
    expect(otBefore.version).toBe(1);

    const after = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve?clientId=${clientId}&employeeId=emp-999&date=2024-08-01&state=CA`
    );
    const otAfter = after.body.policies.find((p: { policyType: string }) => p.policyType === "OVERTIME");
    expect(otAfter.version).toBe(2);
  });

  it("rejects a client admin trying to resolve for a clientId that isn't their own", async () => {
    const otherClient = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Other Co" });
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve?clientId=${otherClient.body._id}&employeeId=emp-999&date=2024-06-01`
    );
    expect(res.status).toBe(403);
  });
});

describe("assignment resolution: resolve-layered", () => {
  let ctx: TestContext;
  let adminToken: string;
  let checkerToken: string;
  let clientId: string;
  let clientAdminToken: string;
  let overtimePolicyId: string;
  let employeeRuleGroupId: string;
  let locationRuleGroupId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("layered-maker@example.com", "maker-password-1");
    adminToken = await login(ctx.app, "layered-maker@example.com", "maker-password-1");
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "layered-checker@example.com",
      password: "checker-password-1",
      role: "PLATFORM_ADMIN",
    });
    checkerToken = await login(ctx.app, "layered-checker@example.com", "checker-password-1");

    const client = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Layered Co" });
    clientId = client.body._id;
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "layered-admin@acme.test",
      password: "acme-admin-pw-123",
      role: "CLIENT_ADMIN",
      clientId,
    });
    clientAdminToken = await login(ctx.app, "layered-admin@acme.test", "acme-admin-pw-123");

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

    const employeeRuleGroup = await authed(ctx.app, clientAdminToken).post("/api/v1/rule-groups", {
      clientId,
      name: "Employee Exception",
      effectiveFrom: "2024-01-01",
      policyRefs: [{ policyId: overtimePolicyId, policyType: "OVERTIME", versionPin: "latest" }],
    });
    await authed(ctx.app, clientAdminToken).post(`/api/v1/rule-groups/${employeeRuleGroup.body.ruleGroupId}/publish`);
    employeeRuleGroupId = employeeRuleGroup.body.ruleGroupId;

    const locationRuleGroup = await authed(ctx.app, clientAdminToken).post("/api/v1/rule-groups", {
      clientId,
      name: "Site Standard",
      effectiveFrom: "2024-01-01",
      policyRefs: [{ policyId: overtimePolicyId, policyType: "OVERTIME", versionPin: "latest" }],
    });
    await authed(ctx.app, clientAdminToken).post(`/api/v1/rule-groups/${locationRuleGroup.body.ruleGroupId}/publish`);
    locationRuleGroupId = locationRuleGroup.body.ruleGroupId;

    await authed(ctx.app, clientAdminToken).post("/api/v1/assignments", {
      clientId,
      ruleGroupId: employeeRuleGroupId,
      targetType: "EMPLOYEE",
      targetIds: ["emp-1"],
      priority: 20,
      effectiveFrom: "2024-01-01",
    });
    await authed(ctx.app, clientAdminToken).post("/api/v1/assignments", {
      clientId,
      ruleGroupId: locationRuleGroupId,
      targetType: "LOCATION",
      targetIds: ["site-1"],
      priority: 10,
      effectiveFrom: "2024-01-01",
    });
  });
  afterAll(() => ctx.teardown());

  it("returns only the employee layer when just an employee assignment matches", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered?clientId=${clientId}&employeeId=emp-1&date=2024-06-01`
    );
    expect(res.status).toBe(200);
    expect(res.body.layers).toHaveLength(1);
    expect(res.body.layers[0].targetType).toBe("EMPLOYEE");
    expect(res.body.layers[0].ruleGroup.ruleGroupId).toBe(employeeRuleGroupId);
  });

  it("returns only the site layer when just a location assignment matches", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered?clientId=${clientId}&employeeId=emp-other&date=2024-06-01&locationId=site-1`
    );
    expect(res.status).toBe(200);
    expect(res.body.layers).toHaveLength(1);
    expect(res.body.layers[0].targetType).toBe("LOCATION");
    expect(res.body.layers[0].ruleGroup.ruleGroupId).toBe(locationRuleGroupId);
  });

  it("returns BOTH layers together when an employee assignment and a site assignment both apply to one punch", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered?clientId=${clientId}&employeeId=emp-1&date=2024-06-01&locationId=site-1`
    );
    expect(res.status).toBe(200);
    expect(res.body.layers).toHaveLength(2);
    const byType = Object.fromEntries(res.body.layers.map((l: { targetType: string; assignment: { priority: number } }) => [l.targetType, l]));
    expect(byType.EMPLOYEE.ruleGroup.ruleGroupId).toBe(employeeRuleGroupId);
    expect(byType.EMPLOYEE.assignment.priority).toBe(20);
    expect(byType.LOCATION.ruleGroup.ruleGroupId).toBe(locationRuleGroupId);
    expect(byType.LOCATION.assignment.priority).toBe(10);
  });

  it("flags a level as unresolved (without failing the whole call) when its rule group has no live version", async () => {
    // A brand-new rule group left in "draft" — never published, so no live version exists for it.
    const draftRuleGroup = await authed(ctx.app, clientAdminToken).post("/api/v1/rule-groups", {
      clientId,
      name: "Never Published",
      effectiveFrom: "2024-01-01",
      policyRefs: [{ policyId: overtimePolicyId, policyType: "OVERTIME", versionPin: "latest" }],
    });
    await authed(ctx.app, clientAdminToken).post("/api/v1/assignments", {
      clientId,
      ruleGroupId: draftRuleGroup.body.ruleGroupId,
      targetType: "DEPARTMENT",
      targetIds: ["dept-x"],
      effectiveFrom: "2024-01-01",
    });

    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered?clientId=${clientId}&employeeId=emp-1&date=2024-06-01&locationId=site-1&departmentId=dept-x`
    );
    expect(res.status).toBe(200);
    expect(res.body.layers).toHaveLength(3);
    const deptLayer = res.body.layers.find((l: { targetType: string }) => l.targetType === "DEPARTMENT");
    expect(deptLayer.unresolved).toBe(true);
    expect(deptLayer.ruleGroup).toBeNull();
  });

  it("returns an empty layer list (200, not 404) when nothing matches at all", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered?clientId=${clientId}&employeeId=emp-nobody&date=2024-06-01&locationId=site-nowhere`
    );
    expect(res.status).toBe(200);
    expect(res.body.layers).toHaveLength(0);
    expect(res.body.consideredAssignments).toBe(0);
  });

  it("rejects a client admin trying to resolve-layered for a clientId that isn't their own", async () => {
    const otherClient = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Other Layered Co" });
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered?clientId=${otherClient.body._id}&employeeId=emp-1&date=2024-06-01`
    );
    expect(res.status).toBe(403);
  });
});

describe("assignment resolution: resolve-layered-range", () => {
  let ctx: TestContext;
  let adminToken: string;
  let checkerToken: string;
  let clientId: string;
  let clientAdminToken: string;
  let baselineRuleGroupId: string;
  let takeoverRuleGroupId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("range-maker@example.com", "maker-password-1");
    adminToken = await login(ctx.app, "range-maker@example.com", "maker-password-1");
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "range-checker@example.com",
      password: "checker-password-1",
      role: "PLATFORM_ADMIN",
    });
    checkerToken = await login(ctx.app, "range-checker@example.com", "checker-password-1");

    const client = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Range Co" });
    clientId = client.body._id;
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "range-admin@acme.test",
      password: "acme-admin-pw-123",
      role: "CLIENT_ADMIN",
      clientId,
    });
    clientAdminToken = await login(ctx.app, "range-admin@acme.test", "acme-admin-pw-123");

    const overtime = await publishGlobalPolicy(ctx.app, adminToken, checkerToken, {
      scope: "global",
      policyType: "OVERTIME",
      name: "Range Federal Overtime",
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

    for (const name of ["Range Baseline", "Range Takeover"]) {
      const rg = await authed(ctx.app, clientAdminToken).post("/api/v1/rule-groups", {
        clientId,
        name,
        effectiveFrom: "2024-01-01",
        policyRefs: [{ policyId: overtime.policyId, policyType: "OVERTIME", versionPin: "latest" }],
      });
      await authed(ctx.app, clientAdminToken).post(`/api/v1/rule-groups/${rg.body.ruleGroupId}/publish`);
      if (name === "Range Baseline") baselineRuleGroupId = rg.body.ruleGroupId;
      else takeoverRuleGroupId = rg.body.ruleGroupId;
    }

    // Two EMPLOYEE assignments for the same worker: the higher-priority one only becomes
    // effective partway through June, so resolution is genuinely a step function across the range.
    await authed(ctx.app, clientAdminToken).post("/api/v1/assignments", {
      clientId,
      ruleGroupId: baselineRuleGroupId,
      targetType: "EMPLOYEE",
      targetIds: ["emp-r1"],
      priority: 10,
      effectiveFrom: "2024-01-01",
    });
    await authed(ctx.app, clientAdminToken).post("/api/v1/assignments", {
      clientId,
      ruleGroupId: takeoverRuleGroupId,
      targetType: "EMPLOYEE",
      targetIds: ["emp-r1"],
      priority: 20,
      effectiveFrom: "2024-06-10",
    });
  });
  afterAll(() => ctx.teardown());

  it("collapses a range with no boundary in it into a single segment", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered-range?clientId=${clientId}&employeeId=emp-r1&startDate=2024-06-01&endDate=2024-06-09`
    );
    expect(res.status).toBe(200);
    expect(res.body.segments).toHaveLength(1);
    expect(res.body.segments[0].startDate).toBe("2024-06-01");
    expect(res.body.segments[0].endDate).toBe("2024-06-09");
    expect(res.body.segments[0].layers[0].ruleGroup.ruleGroupId).toBe(baselineRuleGroupId);
  });

  it("splits into segments exactly where the resolution changes", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered-range?clientId=${clientId}&employeeId=emp-r1&startDate=2024-06-01&endDate=2024-06-14`
    );
    expect(res.status).toBe(200);
    expect(res.body.segments).toHaveLength(2);
    expect(res.body.segments[0]).toMatchObject({ startDate: "2024-06-01", endDate: "2024-06-09" });
    expect(res.body.segments[0].layers[0].ruleGroup.ruleGroupId).toBe(baselineRuleGroupId);
    expect(res.body.segments[1]).toMatchObject({ startDate: "2024-06-10", endDate: "2024-06-14" });
    expect(res.body.segments[1].layers[0].ruleGroup.ruleGroupId).toBe(takeoverRuleGroupId);
  });

  // The whole point of segments is that a caller can substitute them for per-day calls. If a
  // segment ever disagreed with the single-date endpoint for a date it covers, callers would
  // silently process payroll against the wrong rules — so assert the equivalence directly.
  it("returns, for every date it covers, exactly what the single-date endpoint returns", async () => {
    const range = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered-range?clientId=${clientId}&employeeId=emp-r1&startDate=2024-06-01&endDate=2024-06-14`
    );
    for (const date of ["2024-06-01", "2024-06-08", "2024-06-09", "2024-06-10", "2024-06-11", "2024-06-14"]) {
      const single = await authed(ctx.app, clientAdminToken).get(
        `/api/v1/assignments/resolve-layered?clientId=${clientId}&employeeId=emp-r1&date=${date}`
      );
      const covering = range.body.segments.find(
        (seg: { startDate: string; endDate: string }) => seg.startDate <= date && date <= seg.endDate
      );
      expect(covering, `no segment covers ${date}`).toBeDefined();
      expect(covering.layers).toEqual(single.body.layers);
    }
  });

  it("collapses a range that matches nothing into one empty segment", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered-range?clientId=${clientId}&employeeId=emp-nobody&startDate=2024-06-01&endDate=2024-06-14`
    );
    expect(res.status).toBe(200);
    expect(res.body.segments).toHaveLength(1);
    expect(res.body.segments[0].layers).toHaveLength(0);
    expect(res.body.segments[0].consideredAssignments).toBe(0);
  });

  it("handles a single-day range", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered-range?clientId=${clientId}&employeeId=emp-r1&startDate=2024-06-11&endDate=2024-06-11`
    );
    expect(res.status).toBe(200);
    expect(res.body.segments).toHaveLength(1);
    expect(res.body.segments[0]).toMatchObject({ startDate: "2024-06-11", endDate: "2024-06-11" });
  });

  it("rejects an endDate before the startDate", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered-range?clientId=${clientId}&employeeId=emp-r1&startDate=2024-06-14&endDate=2024-06-01`
    );
    expect(res.status).toBe(400);
  });

  it("rejects a range longer than the supported span", async () => {
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered-range?clientId=${clientId}&employeeId=emp-r1&startDate=2024-01-01&endDate=2024-12-31`
    );
    expect(res.status).toBe(400);
  });

  it("rejects a client admin resolving a range for a clientId that isn't their own", async () => {
    const otherClient = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Other Range Co" });
    const res = await authed(ctx.app, clientAdminToken).get(
      `/api/v1/assignments/resolve-layered-range?clientId=${otherClient.body._id}&employeeId=emp-r1&startDate=2024-06-01&endDate=2024-06-14`
    );
    expect(res.status).toBe(403);
  });
});
