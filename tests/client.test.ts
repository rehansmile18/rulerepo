import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestContext, seedPlatformAdmin, login, authed, TestContext } from "./helpers";

describe("clients: country, states, calendar format", () => {
  let ctx: TestContext;
  let adminToken: string;
  let clientId: string;
  let clientAdminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("admin@example.com", "admin-password-1");
    adminToken = await login(ctx.app, "admin@example.com", "admin-password-1");
  });
  afterAll(() => ctx.teardown());

  it("lists countries and a country's states via the geo endpoints", async () => {
    const countries = await authed(ctx.app, adminToken).get("/api/v1/geo/countries");
    expect(countries.status).toBe(200);
    expect(countries.body.items.length).toBeGreaterThan(100);
    expect(countries.body.items.find((c: { isoCode: string }) => c.isoCode === "US")).toBeTruthy();

    const states = await authed(ctx.app, adminToken).get("/api/v1/geo/countries/US/states");
    expect(states.status).toBe(200);
    expect(states.body.items.length).toBeGreaterThan(40);
    expect(states.body.items.find((s: { isoCode: string }) => s.isoCode === "CA")).toBeTruthy();

    // Case-insensitive and a country with few/no subdivisions still returns 200 with an array.
    const lowerCase = await authed(ctx.app, adminToken).get("/api/v1/geo/countries/us/states");
    expect(lowerCase.status).toBe(200);
    expect(lowerCase.body.items.length).toBeGreaterThan(40);
  });

  it("creates a client with a country, states, and a calendar format", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/clients", {
      name: "Globex India",
      country: "in",
      enabledStates: ["MH", "KA"],
      calendarFormat: "DD/MM/YYYY",
    });
    expect(res.status).toBe(201);
    expect(res.body.country).toBe("IN"); // normalized to uppercase
    expect(res.body.enabledStates).toEqual(["MH", "KA"]);
    expect(res.body.calendarFormat).toBe("DD/MM/YYYY");
    clientId = res.body._id;
  });

  it("defaults country to null and calendarFormat to MM/DD/YYYY when omitted", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Global Co" });
    expect(res.status).toBe(201);
    expect(res.body.country).toBeNull();
    expect(res.body.enabledStates).toEqual([]);
    expect(res.body.calendarFormat).toBe("MM/DD/YYYY");
  });

  it("rejects an invalid calendarFormat", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/clients", {
      name: "Bad Format Co",
      calendarFormat: "MM-DD-YYYY",
    });
    expect(res.status).toBe(400);
  });

  it("lets any authenticated role read their own client via /clients/me, but not others' via /clients", async () => {
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "client-admin@globex.test",
      password: "client-admin-pw-1",
      role: "CLIENT_ADMIN",
      clientId,
    });
    clientAdminToken = await login(ctx.app, "client-admin@globex.test", "client-admin-pw-1");

    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "viewer@globex.test",
      password: "viewer-pw-1",
      role: "VIEWER",
      clientId,
    });
    viewerToken = await login(ctx.app, "viewer@globex.test", "viewer-pw-1");

    const asClientAdmin = await authed(ctx.app, clientAdminToken).get("/api/v1/clients/me");
    expect(asClientAdmin.status).toBe(200);
    expect(asClientAdmin.body.client.calendarFormat).toBe("DD/MM/YYYY");
    expect(asClientAdmin.body.client._id).toBe(clientId);

    const asViewer = await authed(ctx.app, viewerToken).get("/api/v1/clients/me");
    expect(asViewer.status).toBe(200);
    expect(asViewer.body.client.calendarFormat).toBe("DD/MM/YYYY");

    // A non-platform-admin still can't list ALL clients.
    const forbiddenList = await authed(ctx.app, viewerToken).get("/api/v1/clients");
    expect(forbiddenList.status).toBe(403);
  });

  it("returns a null client for /clients/me when called by a PLATFORM_ADMIN (no single client)", async () => {
    const res = await authed(ctx.app, adminToken).get("/api/v1/clients/me");
    expect(res.status).toBe(200);
    expect(res.body.client).toBeNull();
  });
});
