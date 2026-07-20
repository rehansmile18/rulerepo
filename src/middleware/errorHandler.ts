import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/errors";

// Express identifies error handlers by their 4-arg arity, so `next` must stay in the signature
// even though it's unused (the `_` prefix keeps the lint rule happy).
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "ValidationError", details: err.issues });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.name, message: err.message });
    return;
  }
  if (err instanceof Error && err.name === "MongoServerError" && (err as unknown as { code?: number }).code === 11000) {
    res.status(409).json({ error: "ConflictError", message: "Duplicate resource" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "InternalError", message: "An unexpected error occurred" });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: "NotFoundError", message: `No route for ${req.method} ${req.path}` });
}

// Wraps async route handlers so thrown/rejected errors reach errorHandler.
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
