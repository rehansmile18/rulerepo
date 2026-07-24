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
