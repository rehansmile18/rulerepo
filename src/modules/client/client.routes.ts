import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { asyncHandler } from "../../middleware/errorHandler";
import { Client } from "../../models/client.model";

const createClientSchema = z.object({
  name: z.string().min(1),
  enabledStates: z.array(z.string().length(2)).default([]),
});

export const clientRouter = Router();
clientRouter.use(authenticate, requireRole("PLATFORM_ADMIN"));

clientRouter.get(
  "/clients",
  asyncHandler(async (_req, res) => {
    const clients = await Client.find().lean();
    res.json({ items: clients });
  })
);

clientRouter.post(
  "/clients",
  validateRequest({ body: createClientSchema }),
  asyncHandler(async (req, res) => {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  })
);
