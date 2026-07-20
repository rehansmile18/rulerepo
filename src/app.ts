import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
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
  app.use(cors());
  app.use(express.json());
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

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
