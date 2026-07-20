import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { loginSchema } from "./auth.validators";
import { loginHandler } from "./auth.controller";

export const authRouter = Router();

// Deliberately not behind `authenticate` — this is how a caller gets a token in the first place.
authRouter.post("/auth/login", validateRequest({ body: loginSchema }), loginHandler);
