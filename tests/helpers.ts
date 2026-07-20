import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../src/app";
import { User } from "../src/models/user.model";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

export interface TestContext {
  app: ReturnType<typeof createApp>;
  mongod: MongoMemoryServer;
  teardown: () => Promise<void>;
}

export async function setupTestContext(): Promise<TestContext> {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const app = createApp();
  return {
    app,
    mongod,
    teardown: async () => {
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}

/** Bootstraps a PLATFORM_ADMIN directly (mirrors src/utils/seed.ts) — there's no existing admin to authorize the first user via the API. */
export async function seedPlatformAdmin(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 4); // low cost factor — speed over security in tests
  return User.create({ email: email.toLowerCase(), passwordHash, role: "PLATFORM_ADMIN", clientId: null });
}

export async function login(app: TestContext["app"], email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

export function authed(app: TestContext["app"], token: string) {
  return {
    get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string, body?: object) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body),
    patch: (url: string, body?: object) => request(app).patch(url).set("Authorization", `Bearer ${token}`).send(body),
  };
}

/** Creates a global policy and pushes it through the full submit/approve workflow, returning the now-active policy. */
export async function publishGlobalPolicy(app: TestContext["app"], adminToken: string, checkerToken: string, body: object) {
  const draft = await authed(app, adminToken).post("/api/v1/policies", body);
  if (draft.status !== 201) throw new Error(`create failed: ${draft.status} ${JSON.stringify(draft.body)}`);
  await authed(app, adminToken).post(`/api/v1/policies/${draft.body.policyId}/submit-for-approval`);
  const approved = await authed(app, checkerToken).post(`/api/v1/policies/${draft.body.policyId}/approve`);
  if (approved.status !== 200) throw new Error(`approve failed: ${approved.status} ${JSON.stringify(approved.body)}`);
  return approved.body;
}
