import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestContext, seedPlatformAdmin, login, authed, TestContext } from "./helpers";

describe("self-service profile: preferences & password", () => {
  let ctx: TestContext;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("admin@example.com", "correct-horse-battery-staple");
    adminToken = await login(ctx.app, "admin@example.com", "correct-horse-battery-staple");
  });
  afterAll(() => ctx.teardown());

  it("GET /users/me returns the caller's own profile, never the password hash", async () => {
    const res = await authed(ctx.app, adminToken).get("/api/v1/users/me");
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("admin@example.com");
    expect(res.body.role).toBe("PLATFORM_ADMIN");
    expect(res.body.username).toBeNull();
    expect(res.body.firstName).toBeNull();
    expect(res.body.lastName).toBeNull();
    expect(res.body.mobile).toBeNull();
    expect(res.body.preferredLanguage).toBeNull();
    expect(res.body.preferredDateFormat).toBeNull();
    expect(res.body.preferredTimeFormat).toBeNull();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("PATCH /users/me updates name, username, mobile, language, date-format, and time-format", async () => {
    const res = await authed(ctx.app, adminToken).patch("/api/v1/users/me", {
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada.lovelace",
      mobile: "+1-555-0100",
      preferredLanguage: "es",
      preferredDateFormat: "DD/MM/YYYY",
      preferredTimeFormat: "24h",
    });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe("Ada");
    expect(res.body.lastName).toBe("Lovelace");
    expect(res.body.username).toBe("ada.lovelace");
    expect(res.body.mobile).toBe("+1-555-0100");
    expect(res.body.preferredLanguage).toBe("es");
    expect(res.body.preferredDateFormat).toBe("DD/MM/YYYY");
    expect(res.body.preferredTimeFormat).toBe("24h");

    const fetched = await authed(ctx.app, adminToken).get("/api/v1/users/me");
    expect(fetched.body.firstName).toBe("Ada");
    expect(fetched.body.lastName).toBe("Lovelace");
    expect(fetched.body.username).toBe("ada.lovelace");
    expect(fetched.body.mobile).toBe("+1-555-0100");
    expect(fetched.body.preferredLanguage).toBe("es");
    expect(fetched.body.preferredDateFormat).toBe("DD/MM/YYYY");
    expect(fetched.body.preferredTimeFormat).toBe("24h");
  });

  it("PATCH /users/me rejects an empty firstName", async () => {
    const res = await authed(ctx.app, adminToken).patch("/api/v1/users/me", { firstName: "" });
    expect(res.status).toBe(400);
  });

  it("PATCH /users/me can clear firstName/lastName/username/mobile back to null", async () => {
    const res = await authed(ctx.app, adminToken).patch("/api/v1/users/me", {
      firstName: null,
      lastName: null,
      username: null,
      mobile: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBeNull();
    expect(res.body.lastName).toBeNull();
    expect(res.body.username).toBeNull();
    expect(res.body.mobile).toBeNull();
  });

  it("PATCH /users/me rejects an unsupported time format", async () => {
    const res = await authed(ctx.app, adminToken).patch("/api/v1/users/me", { preferredTimeFormat: "36h" });
    expect(res.status).toBe(400);
  });

  it("PATCH /users/me can clear a preference back to null", async () => {
    const res = await authed(ctx.app, adminToken).patch("/api/v1/users/me", { preferredLanguage: null });
    expect(res.status).toBe(200);
    expect(res.body.preferredLanguage).toBeNull();
  });

  it("PATCH /users/me rejects an unsupported language", async () => {
    const res = await authed(ctx.app, adminToken).patch("/api/v1/users/me", { preferredLanguage: "fr" });
    expect(res.status).toBe(400);
  });

  it("login response carries the caller's saved preferences", async () => {
    await authed(ctx.app, adminToken).patch("/api/v1/users/me", { preferredLanguage: "ar" });
    const loginRes = await authed(ctx.app, "").post("/api/v1/auth/login", {
      email: "admin@example.com",
      password: "correct-horse-battery-staple",
    });
    expect(loginRes.body.user.preferredLanguage).toBe("ar");
    // Reset for the tests below, which assume no date-format preference was set yet.
    await authed(ctx.app, adminToken).patch("/api/v1/users/me", { preferredLanguage: null });
  });

  it("changes the password given the correct current password, and the old password stops working", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/users/me/change-password", {
      currentPassword: "correct-horse-battery-staple",
      newPassword: "new-correct-horse-battery",
    });
    expect(res.status).toBe(204);

    const oldLogin = await authed(ctx.app, "").post("/api/v1/auth/login", {
      email: "admin@example.com",
      password: "correct-horse-battery-staple",
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await authed(ctx.app, "").post("/api/v1/auth/login", {
      email: "admin@example.com",
      password: "new-correct-horse-battery",
    });
    expect(newLogin.status).toBe(200);
  });

  it("rejects a password change with the wrong current password, leaving the real password intact", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/users/me/change-password", {
      currentPassword: "totally-wrong",
      newPassword: "whatever-new-password",
    });
    expect(res.status).toBe(401);

    const stillWorks = await authed(ctx.app, "").post("/api/v1/auth/login", {
      email: "admin@example.com",
      password: "new-correct-horse-battery",
    });
    expect(stillWorks.status).toBe(200);
  });

  it("rejects a new password shorter than 8 characters", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/users/me/change-password", {
      currentPassword: "new-correct-horse-battery",
      newPassword: "short",
    });
    expect(res.status).toBe(400);
  });
});

describe("self-service profile: avatar", () => {
  let ctx: TestContext;
  let adminToken: string;
  // A real (tiny, 1x1 transparent) PNG — exercises the actual format regex, not just a fake string.
  const TINY_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("avatar-admin@example.com", "correct-horse-battery-staple");
    adminToken = await login(ctx.app, "avatar-admin@example.com", "correct-horse-battery-staple");
  });
  afterAll(() => ctx.teardown());

  it("uploads and then clears a profile picture", async () => {
    const uploaded = await authed(ctx.app, adminToken).patch("/api/v1/users/me/avatar", { avatarUrl: TINY_PNG });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.avatarUrl).toBe(TINY_PNG);

    const fetched = await authed(ctx.app, adminToken).get("/api/v1/users/me");
    expect(fetched.body.avatarUrl).toBe(TINY_PNG);

    const cleared = await authed(ctx.app, adminToken).patch("/api/v1/users/me/avatar", { avatarUrl: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.avatarUrl).toBeNull();
  });

  it("rejects a non-data-URL value", async () => {
    const res = await authed(ctx.app, adminToken).patch("/api/v1/users/me/avatar", {
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(res.status).toBe(400);
  });

  it("rejects an image over the decoded size limit", async () => {
    const oversized = `data:image/png;base64,${"A".repeat(1_400_000)}`;
    const res = await authed(ctx.app, adminToken).patch("/api/v1/users/me/avatar", { avatarUrl: oversized });
    expect(res.status).toBe(400);
  });
});
