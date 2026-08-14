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

  it("logs in with a username or mobile number in place of email", async () => {
    const adminToken = await login(ctx.app, "admin@example.com", "correct-horse-battery-staple");
    await authed(ctx.app, adminToken).patch("/api/v1/users/me", { username: "the-admin", mobile: "+1-555-0199" });

    const byUsername = await authed(ctx.app, "").post("/api/v1/auth/login", {
      email: "the-admin",
      password: "correct-horse-battery-staple",
    });
    expect(byUsername.status).toBe(200);
    expect(typeof byUsername.body.token).toBe("string");
    expect(byUsername.body.user.username).toBe("the-admin");

    const byMobile = await authed(ctx.app, "").post("/api/v1/auth/login", {
      email: "+1-555-0199",
      password: "correct-horse-battery-staple",
    });
    expect(byMobile.status).toBe(200);

    // Username is matched case-insensitively, same as email.
    const byUsernameUpper = await authed(ctx.app, "").post("/api/v1/auth/login", {
      email: "THE-ADMIN",
      password: "correct-horse-battery-staple",
    });
    expect(byUsernameUpper.status).toBe(200);
  });

  it("rejects a second user claiming a username or mobile already in use", async () => {
    const adminToken = await login(ctx.app, "admin@example.com", "correct-horse-battery-staple");
    const client = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Username Conflict Co" });
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "first-user@example.test",
      password: "first-user-pw-1",
      role: "VIEWER",
      clientId: client.body._id,
    });
    const firstToken = await login(ctx.app, "first-user@example.test", "first-user-pw-1");
    const claimed = await authed(ctx.app, firstToken).patch("/api/v1/users/me", { username: "shared-name", mobile: "+1-555-0200" });
    expect(claimed.status).toBe(200);

    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "second-user@example.test",
      password: "second-user-pw-1",
      role: "VIEWER",
      clientId: client.body._id,
    });
    const secondToken = await login(ctx.app, "second-user@example.test", "second-user-pw-1");

    const usernameConflict = await authed(ctx.app, secondToken).patch("/api/v1/users/me", { username: "shared-name" });
    expect(usernameConflict.status).toBe(409);

    const mobileConflict = await authed(ctx.app, secondToken).patch("/api/v1/users/me", { mobile: "+1-555-0200" });
    expect(mobileConflict.status).toBe(409);
  });

  it("rejects a malformed username", async () => {
    const adminToken = await login(ctx.app, "admin@example.com", "correct-horse-battery-staple");
    const res = await authed(ctx.app, adminToken).patch("/api/v1/users/me", { username: "no spaces allowed" });
    expect(res.status).toBe(400);
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

  it("rejects a SITE_MANAGER created with no siteIds, accepts one with at least one", async () => {
    const adminToken = await login(ctx.app, "admin@example.com", "correct-horse-battery-staple");
    const client = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Site Manager Test Co" });
    expect(client.status).toBe(201);

    const missingSiteIds = await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "no-sites@example.test",
      password: "site-manager-pw-1",
      role: "SITE_MANAGER",
      clientId: client.body._id,
    });
    expect(missingSiteIds.status).toBe(400);

    const withSiteIds = await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "site-manager@example.test",
      password: "site-manager-pw-1",
      role: "SITE_MANAGER",
      clientId: client.body._id,
      siteIds: ["site-1", "site-2"],
    });
    expect(withSiteIds.status).toBe(201);
    expect(withSiteIds.body.siteIds).toEqual(["site-1", "site-2"]);

    const siteManagerToken = await login(ctx.app, "site-manager@example.test", "site-manager-pw-1");
    const me = await authed(ctx.app, siteManagerToken).get("/api/v1/users/me");
    expect(me.status).toBe(200);
    expect(me.body.role).toBe("SITE_MANAGER");
    expect(me.body.siteIds).toEqual(["site-1", "site-2"]);
  });

  it("permissions round-trip through create, /users/me, GET/PATCH /users/:id", async () => {
    const adminToken = await login(ctx.app, "admin@example.com", "correct-horse-battery-staple");
    const client = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Permissions Test Co" });
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "perm-client-admin@example.test",
      password: "perm-admin-pw-1",
      role: "CLIENT_ADMIN",
      clientId: client.body._id,
    });
    const clientAdminToken = await login(ctx.app, "perm-client-admin@example.test", "perm-admin-pw-1");

    const created = await authed(ctx.app, clientAdminToken).post("/api/v1/users", {
      email: "perm-viewer@example.test",
      password: "perm-viewer-pw-1",
      role: "VIEWER",
      clientId: client.body._id,
      permissions: ["employee:read", "punch:read"],
    });
    expect(created.status).toBe(201);
    expect(created.body.permissions).toEqual(["employee:read", "punch:read"]);
    const userId = created.body.userId;

    const viewerToken = await login(ctx.app, "perm-viewer@example.test", "perm-viewer-pw-1");
    const me = await authed(ctx.app, viewerToken).get("/api/v1/users/me");
    expect(me.body.permissions).toEqual(["employee:read", "punch:read"]);

    const fetched = await authed(ctx.app, clientAdminToken).get(`/api/v1/users/${userId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.permissions).toEqual(["employee:read", "punch:read"]);

    // CLIENT_ADMIN can freely edit another user's permissions to an arbitrary subset — TLM stores
    // these opaquely and doesn't validate them against any catalog.
    const updated = await authed(ctx.app, clientAdminToken).patch(`/api/v1/users/${userId}`, {
      permissions: ["employee:read", "employee:write", "schedule:write"],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.permissions).toEqual(["employee:read", "employee:write", "schedule:write"]);

    // Cross-client PATCH is rejected the same way cross-client creation already is.
    const otherClient = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Other Perm Co" });
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "other-perm-admin@example.test",
      password: "other-admin-pw-1",
      role: "CLIENT_ADMIN",
      clientId: otherClient.body._id,
    });
    const otherClientAdminToken = await login(ctx.app, "other-perm-admin@example.test", "other-admin-pw-1");
    const crossClientPatch = await authed(ctx.app, otherClientAdminToken).patch(`/api/v1/users/${userId}`, {
      permissions: ["employee:write"],
    });
    expect(crossClientPatch.status).toBe(404);
  });
});
