import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestContext, seedPlatformAdmin, login, authed, TestContext } from "./helpers";

describe("tenant isolation", () => {
  let ctx: TestContext;
  let adminToken: string;
  let clientAId: string;
  let clientAAdminToken: string;
  let clientBAdminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("admin@example.com", "admin-password-1");
    adminToken = await login(ctx.app, "admin@example.com", "admin-password-1");

    const clientA = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Client A" });
    clientAId = clientA.body._id;
    const clientB = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Client B" });

    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "a-admin@test.com",
      password: "a-admin-password",
      role: "CLIENT_ADMIN",
      clientId: clientAId,
    });
    clientAAdminToken = await login(ctx.app, "a-admin@test.com", "a-admin-password");

    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "b-admin@test.com",
      password: "b-admin-password",
      role: "CLIENT_ADMIN",
      clientId: clientB.body._id,
    });
    clientBAdminToken = await login(ctx.app, "b-admin@test.com", "b-admin-password");

    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "a-viewer@test.com",
      password: "a-viewer-password",
      role: "VIEWER",
      clientId: clientAId,
    });
    viewerToken = await login(ctx.app, "a-viewer@test.com", "a-viewer-password");
  });
  afterAll(() => ctx.teardown());

  it("blocks Client B's admin from creating a policy under Client A", async () => {
    const res = await authed(ctx.app, clientBAdminToken).post("/api/v1/policies", {
      scope: "client",
      clientId: clientAId,
      policyType: "RATE",
      name: "Hijack attempt",
      effectiveFrom: "2024-01-01",
      rules: { rateType: "hourly", minimumWage: 7.25, minimumWageSource: "hijack" },
    });
    expect(res.status).toBe(403);
  });

  it("blocks Client B's admin from creating a rule group under Client A", async () => {
    const res = await authed(ctx.app, clientBAdminToken).post("/api/v1/rule-groups", {
      clientId: clientAId,
      name: "Hijack attempt",
      effectiveFrom: "2024-01-01",
      policyRefs: [{ policyId: "11111111-1111-4111-8111-111111111111", policyType: "RATE", versionPin: "latest" }],
    });
    expect(res.status).toBe(403);
  });

  it("blocks a VIEWER from writing, but allows reading", async () => {
    const writeAttempt = await authed(ctx.app, viewerToken).post("/api/v1/policies", {
      scope: "client",
      clientId: clientAId,
      policyType: "RATE",
      name: "Viewer shouldn't be able to do this",
      effectiveFrom: "2024-01-01",
      rules: { rateType: "hourly", minimumWage: 7.25, minimumWageSource: "n/a" },
    });
    expect(writeAttempt.status).toBe(403);

    const readAttempt = await authed(ctx.app, viewerToken).get("/api/v1/policies");
    expect(readAttempt.status).toBe(200);
  });

  it("scopes list results to the caller's own client, even if they don't filter by clientId", async () => {
    await authed(ctx.app, clientAAdminToken).post("/api/v1/policies", {
      scope: "client",
      clientId: clientAId,
      policyType: "RATE",
      name: "Client A's own rate policy",
      effectiveFrom: "2024-01-01",
      rules: { rateType: "hourly", minimumWage: 16, minimumWageSource: "Client A" },
    });

    const res = await authed(ctx.app, clientBAdminToken).get("/api/v1/policies?scope=client");
    expect(res.body.items.every((p: { clientId: string }) => p.clientId !== clientAId)).toBe(true);
  });

  it("does NOT leak another client's policies when the effectiveOn filter is applied (regression)", async () => {
    // Client A owns a client-scoped policy; Client B must never see it even with effectiveOn set,
    // which previously clobbered the tenant $or and leaked all clients' policies.
    await authed(ctx.app, clientAAdminToken).post("/api/v1/policies", {
      scope: "client",
      clientId: clientAId,
      policyType: "RATE",
      name: "Client A private rate",
      effectiveFrom: "2024-01-01",
      rules: { rateType: "hourly", minimumWage: 19, minimumWageSource: "Client A" },
    });

    const res = await authed(ctx.app, clientBAdminToken).get("/api/v1/policies?scope=client&effectiveOn=2024-06-01");
    expect(res.status).toBe(200);
    expect(res.body.items.every((p: { clientId: string }) => p.clientId !== clientAId)).toBe(true);
  });
});
