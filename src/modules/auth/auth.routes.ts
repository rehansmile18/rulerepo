import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validateRequest } from "../../middleware/validateRequest";
import { loginSchema } from "./auth.validators";
import { loginHandler } from "./auth.controller";

// Throttle login attempts per client IP to blunt online password brute-force / credential
// stuffing. Disabled under test so the suite's many logins from one IP don't trip it.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "TooManyRequests", message: "Too many login attempts; try again later" },
});

export const authRouter = Router();

// Deliberately not behind `authenticate` — this is how a caller gets a token in the first place.
authRouter.post("/auth/login", loginRateLimiter, validateRequest({ body: loginSchema }), loginHandler);
