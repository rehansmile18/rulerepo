import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestContext, seedPlatformAdmin, login, authed, TestContext } from "./helpers";

describe("auth & user management", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("admin@example.com", "correct-horse-battery-staple");
  });
  afterAll(() => ctx.teardown());

  it("rejects login with wrong password", async () => {
    const res = await authed(ctx.app, "").post("/api/v1/auth/login", { email: "admin@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("logs in with correct credentials", async () => {
    const token = await login(ctx.app, "admin@example.com", "correct-horse-battery-staple");
    expect(typeof token).toBe("string");
  });

  it("rejects requests with no token", async () => {
    const res = await authed(ctx.app, "").get("/api/v1/policies");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a garbage token", async () => {
    const res = await authed(ctx.app, "not-a-real-token").get("/api/v1/policies");
    expect(res.status).toBe(401);
  });

  it("platform admin can create a client admin user", async () => {
    const adminToken = await login(ctx.app, "admin@example.com", "correct-horse-battery-staple");
    const client = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Acme Corp" });
    expect(client.status).toBe(201);

    const created = await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "client-admin@acme.test",
      password: "acme-admin-pw-123",
      role: "CLIENT_ADMIN",
      clientId: client.body._id,
    });
    expect(created.status).toBe(201);

    const clientAdminToken = await login(ctx.app, "client-admin@acme.test", "acme-admin-pw-123");

    // A CLIENT_ADMIN cannot create another PLATFORM_ADMIN.
    const escalationAttempt = await authed(ctx.app, clientAdminToken).post("/api/v1/users", {
      email: "sneaky@acme.test",
      password: "whatever-password",
      role: "PLATFORM_ADMIN",
    });
    expect(escalationAttempt.status).toBe(403);

    // A CLIENT_ADMIN cannot create a user for a different client.
    const otherClient = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Other Co" });
    const crossClientAttempt = await authed(ctx.app, clientAdminToken).post("/api/v1/users", {
      email: "sneaky2@acme.test",
      password: "whatever-password",
      role: "VIEWER",
      clientId: otherClient.body._id,
    });
    expect(crossClientAttempt.status).toBe(403);
  });
});
