import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import * as authService from "./auth.service";
import { LoginInput } from "./auth.validators";

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginInput);
  res.json(result);
});
