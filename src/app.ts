import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import "./models/policies"; // registers all policyType discriminators
import { authRouter } from "./modules/auth/auth.routes";
import { userRouter } from "./modules/user/user.routes";
import { policyRouter } from "./modules/policy/policy.routes";
import { ruleGroupRouter } from "./modules/ruleGroup/ruleGroup.routes";
import { assignmentRouter } from "./modules/assignment/assignment.routes";
import { clientRouter } from "./modules/client/client.routes";
import { auditLogRouter } from "./modules/auditLog/auditLog.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp(): Express {
  const app = express();
  app.use(helmet());
  // Restrict CORS to an explicit allowlist when CORS_ORIGIN is set (comma-separated); otherwise
  // allow all (fine for local/dev — requests still require a bearer token). Set it in production.
  const corsOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
  app.use(cors(corsOrigins && corsOrigins.length > 0 ? { origin: corsOrigins } : undefined));
  app.use(express.json());
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  // Deep health check: reports unhealthy (503) unless the Mongo connection is actually up, so
  // orchestrator probes don't stay green while every real request fails on a dead DB.
  app.get("/health", (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down" });
  });

  const v1 = express.Router();
  v1.use(authRouter);
  v1.use(userRouter);
  v1.use(policyRouter);
  v1.use(ruleGroupRouter);
  v1.use(assignmentRouter);
  v1.use(clientRouter);
  v1.use(auditLogRouter);
  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
