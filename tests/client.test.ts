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

  it("creates a client with a country, states, a calendar format, and a time format", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/clients", {
      name: "Globex India",
      country: "in",
      enabledStates: ["MH", "KA"],
      calendarFormat: "DD/MM/YYYY",
      timeFormat: "24h",
    });
    expect(res.status).toBe(201);
    expect(res.body.country).toBe("IN"); // normalized to uppercase
    expect(res.body.enabledStates).toEqual(["MH", "KA"]);
    expect(res.body.calendarFormat).toBe("DD/MM/YYYY");
    expect(res.body.timeFormat).toBe("24h");
    clientId = res.body._id;
  });

  it("defaults country to null, calendarFormat to MM/DD/YYYY, and timeFormat to 12h when omitted", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Global Co" });
    expect(res.status).toBe(201);
    expect(res.body.country).toBeNull();
    expect(res.body.enabledStates).toEqual([]);
    expect(res.body.calendarFormat).toBe("MM/DD/YYYY");
    expect(res.body.timeFormat).toBe("12h");
  });

  it("rejects an invalid calendarFormat", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/clients", {
      name: "Bad Format Co",
      calendarFormat: "MM-DD-YYYY",
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid timeFormat", async () => {
    const res = await authed(ctx.app, adminToken).post("/api/v1/clients", {
      name: "Bad Time Format Co",
      timeFormat: "36h",
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
    expect(asClientAdmin.body.client.timeFormat).toBe("24h");
    expect(asClientAdmin.body.client._id).toBe(clientId);

    const asViewer = await authed(ctx.app, viewerToken).get("/api/v1/clients/me");
    expect(asViewer.status).toBe(200);
    expect(asViewer.body.client.calendarFormat).toBe("DD/MM/YYYY");
    expect(asViewer.body.client.timeFormat).toBe("24h");

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

describe("clients: module label overrides", () => {
  let ctx: TestContext;
  let adminToken: string;
  let clientId: string;
  let clientAdminToken: string;
  let viewerToken: string;
  const SAMPLE_LABELS = {
    site: {
      en: { singular: "Business Unit", plural: "Business Units" },
      es: { singular: "Unidad de Negocio", plural: "Unidades de Negocio" },
      ar: { singular: "وحدة عمل", plural: "وحدات عمل" },
    },
  };

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("labels-admin@example.com", "admin-password-1");
    adminToken = await login(ctx.app, "labels-admin@example.com", "admin-password-1");

    const client = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Acme Labels Co" });
    clientId = client.body._id;

    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "client-admin@acme-labels.test",
      password: "client-admin-pw-1",
      role: "CLIENT_ADMIN",
      clientId,
    });
    clientAdminToken = await login(ctx.app, "client-admin@acme-labels.test", "client-admin-pw-1");

    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "viewer@acme-labels.test",
      password: "viewer-pw-1",
      role: "VIEWER",
      clientId,
    });
    viewerToken = await login(ctx.app, "viewer@acme-labels.test", "viewer-pw-1");
  });
  afterAll(() => ctx.teardown());

  it("defaults moduleLabels to null on a new client", async () => {
    const res = await authed(ctx.app, clientAdminToken).get("/api/v1/clients/me");
    expect(res.status).toBe(200);
    expect(res.body.client.moduleLabels).toBeNull();
  });

  it("CLIENT_ADMIN can PATCH /clients/me to set moduleLabels, and every user of that client sees it", async () => {
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", { moduleLabels: SAMPLE_LABELS });
    expect(res.status).toBe(200);
    expect(res.body.moduleLabels).toEqual(SAMPLE_LABELS);

    const asViewer = await authed(ctx.app, viewerToken).get("/api/v1/clients/me");
    expect(asViewer.body.client.moduleLabels).toEqual(SAMPLE_LABELS);
  });

  it("rejects PATCH /clients/me from a non-admin role", async () => {
    const res = await authed(ctx.app, viewerToken).patch("/api/v1/clients/me", { moduleLabels: null });
    expect(res.status).toBe(403);
  });

  it("rejects a moduleLabels entry missing the plural form", async () => {
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", {
      moduleLabels: { site: { en: { singular: "Business Unit" } } },
    });
    expect(res.status).toBe(400);
  });

  it("rejects a moduleLabels entry with an unsupported locale key", async () => {
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", {
      moduleLabels: { site: { fr: { singular: "Unité", plural: "Unités" } } },
    });
    expect(res.status).toBe(400);
  });

  it("rejects PATCH /clients/:id from a CLIENT_ADMIN (PLATFORM_ADMIN only)", async () => {
    const res = await authed(ctx.app, clientAdminToken).patch(`/api/v1/clients/${clientId}`, { moduleLabels: null });
    expect(res.status).toBe(403);
  });

  it("PLATFORM_ADMIN can PATCH any client's labels via /clients/:id", async () => {
    const res = await authed(ctx.app, adminToken).patch(`/api/v1/clients/${clientId}`, { moduleLabels: null });
    expect(res.status).toBe(200);
    expect(res.body.moduleLabels).toBeNull();

    const restored = await authed(ctx.app, adminToken).patch(`/api/v1/clients/${clientId}`, { moduleLabels: SAMPLE_LABELS });
    expect(restored.status).toBe(200);
    expect(restored.body.moduleLabels).toEqual(SAMPLE_LABELS);
  });

  it("CLIENT_ADMIN can clear moduleLabels back to null via /clients/me", async () => {
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", { moduleLabels: null });
    expect(res.status).toBe(200);
    expect(res.body.moduleLabels).toBeNull();
  });
});

describe("clients: regional settings", () => {
  let ctx: TestContext;
  let adminToken: string;
  let clientId: string;
  let clientAdminToken: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    await seedPlatformAdmin("regional-admin@example.com", "admin-password-1");
    adminToken = await login(ctx.app, "regional-admin@example.com", "admin-password-1");
    const client = await authed(ctx.app, adminToken).post("/api/v1/clients", { name: "Regional Co" });
    clientId = client.body._id;
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "regional-ca@acme.test",
      password: "acme-admin-pw-123",
      role: "CLIENT_ADMIN",
      clientId,
    });
    clientAdminToken = await login(ctx.app, "regional-ca@acme.test", "acme-admin-pw-123");
  });
  afterAll(() => ctx.teardown());

  it("defaults a new client to US-shaped regional settings", async () => {
    const res = await authed(ctx.app, adminToken).get("/api/v1/clients");
    const client = res.body.items.find((c: { _id: string }) => c._id === clientId);
    expect(client).toMatchObject({
      currency: "USD",
      numberFormat: "1,234.56",
      displayWeekStartDay: 0,
      defaultTimezone: null,
    });
  });

  it("lets a client admin change their own org's regional defaults after creation", async () => {
    // These were write-once at creation before — an org that picked wrong on day one was stuck.
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", {
      calendarFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      defaultTimezone: "Europe/Madrid",
      currency: "eur",
      numberFormat: "1.234,56",
      displayWeekStartDay: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      calendarFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      defaultTimezone: "Europe/Madrid",
      currency: "EUR", // normalized to upper case
      numberFormat: "1.234,56",
      displayWeekStartDay: 1,
    });
  });

  it("updates one setting without disturbing the others", async () => {
    const before = await authed(ctx.app, clientAdminToken).get("/api/v1/clients/me");
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", { displayWeekStartDay: 6 });
    expect(res.status).toBe(200);
    expect(res.body.displayWeekStartDay).toBe(6);
    expect(res.body.currency).toBe(before.body.client.currency);
    expect(res.body.calendarFormat).toBe(before.body.client.calendarFormat);
  });

  it("rejects a time zone the runtime doesn't recognise", async () => {
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", {
      defaultTimezone: "Mars/Olympus_Mons",
    });
    expect(res.status).toBe(400);
  });

  it("accepts a deprecated-but-resolvable time zone alias", async () => {
    // Intl still resolves these even though supportedValuesOf omits them, and real config data
    // contains them — rejecting would be stricter than the date maths that consumes the value.
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", {
      defaultTimezone: "US/Pacific",
    });
    expect(res.status).toBe(200);
  });

  it("rejects a currency code that isn't ISO 4217", async () => {
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", { currency: "XYZ" });
    expect(res.status).toBe(400);
  });

  it("rejects a week start day outside 0-6", async () => {
    const res = await authed(ctx.app, clientAdminToken).patch("/api/v1/clients/me", { displayWeekStartDay: 7 });
    expect(res.status).toBe(400);
  });

  it("still refuses a non-admin role", async () => {
    await authed(ctx.app, adminToken).post("/api/v1/users", {
      email: "regional-viewer@acme.test",
      password: "viewer-pw-12345",
      role: "VIEWER",
      clientId,
    });
    const viewerToken = await login(ctx.app, "regional-viewer@acme.test", "viewer-pw-12345");
    const res = await authed(ctx.app, viewerToken).patch("/api/v1/clients/me", { currency: "GBP" });
    expect(res.status).toBe(403);
  });
});
