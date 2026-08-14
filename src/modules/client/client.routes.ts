import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { asyncHandler } from "../../middleware/errorHandler";
import { NotFoundError } from "../../utils/errors";
import { Client } from "../../models/client.model";
import { CALENDAR_FORMATS, TIME_FORMATS } from "../../types/domain";

const createClientSchema = z.object({
  name: z.string().min(1),
  // ISO 3166-1 alpha-2 country code, or omitted/null for a global client not tied to one country.
  country: z
    .string()
    .length(2)
    .transform((v) => v.toUpperCase())
    .nullable()
    .optional(),
  // ISO 3166-2 subdivision codes (the part after the country prefix) — length varies by country
  // (e.g. US/CA use 2 chars, GB uses up to 3), so this isn't fixed at length(2) like US-only data.
  enabledStates: z.array(z.string().min(1).max(3)).default([]),
  calendarFormat: z.enum(CALENDAR_FORMATS).default("MM/DD/YYYY"),
  timeFormat: z.enum(TIME_FORMATS).default("12h"),
});

const clientIdParamSchema = z.object({
  id: z.string(),
});

// Shape/length validated only — the module key itself and which locales a frontend supports are
// that frontend's own concern, not TLM's (see client.model.ts). Deliberately scoped to just this
// one field rather than a general "update a client" schema, since nothing else is editable yet.
const updateClientModuleLabelsSchema = z.object({
  moduleLabels: z
    .record(
      z.string().min(1).max(64),
      z.record(z.enum(["en", "es", "ar"]), z.object({ singular: z.string().min(1).max(60), plural: z.string().min(1).max(60) }))
    )
    .nullable(),
});

export const clientRouter = Router();
clientRouter.use(authenticate);

// Any authenticated role may read their OWN client — needed so every user under a client (not
// just PLATFORM_ADMIN) can pick up that client's calendarFormat and render dates consistently.
// Registered before the PLATFORM_ADMIN-gated routes below since it's open to every role.
clientRouter.get(
  "/clients/me",
  asyncHandler(async (req, res) => {
    if (!req.auth?.clientId) {
      // PLATFORM_ADMIN spans all clients, so there's no single "my client" context.
      res.json({ client: null });
      return;
    }
    const client = await Client.findById(req.auth.clientId).lean();
    res.json({ client: client ?? null });
  })
);

clientRouter.get(
  "/clients",
  requireRole("PLATFORM_ADMIN"),
  asyncHandler(async (_req, res) => {
    const clients = await Client.find().lean();
    res.json({ items: clients });
  })
);

clientRouter.post(
  "/clients",
  requireRole("PLATFORM_ADMIN"),
  validateRequest({ body: createClientSchema }),
  asyncHandler(async (req, res) => {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  })
);

// Self-service — a CLIENT_ADMIN customizing their OWN org's terminology. The first write path
// this role has ever had over Client data; deliberately narrow (just moduleLabels) rather than
// opening up general client editing.
clientRouter.patch(
  "/clients/me",
  requireRole("CLIENT_ADMIN"),
  validateRequest({ body: updateClientModuleLabelsSchema }),
  asyncHandler(async (req, res) => {
    // requireRole("CLIENT_ADMIN") implies req.auth.clientId is set — enforced by the same
    // pre("validate") invariant on User that requires clientId for every non-PLATFORM_ADMIN role.
    const client = await Client.findByIdAndUpdate(req.auth!.clientId, { $set: req.body }, { new: true }).lean();
    if (!client) throw new NotFoundError("Client not found");
    res.json(client);
  })
);

// PLATFORM_ADMIN has no client of their own, so /clients/me doesn't apply to them — this lets
// them edit any client's labels (e.g. as part of onboarding/support).
clientRouter.patch(
  "/clients/:id",
  requireRole("PLATFORM_ADMIN"),
  validateRequest({ params: clientIdParamSchema, body: updateClientModuleLabelsSchema }),
  asyncHandler(async (req, res) => {
    const client = await Client.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    if (!client) throw new NotFoundError("Client not found");
    res.json(client);
  })
);
