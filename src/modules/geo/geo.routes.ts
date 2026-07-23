import { Router } from "express";
import { Country, State } from "country-state-city";
import { z } from "zod";
import { authenticate } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { asyncHandler } from "../../middleware/errorHandler";

const countryCodeParamSchema = z.object({
  countryCode: z
    .string()
    .length(2)
    .transform((v) => v.toUpperCase()),
});

export const geoRouter = Router();
geoRouter.use(authenticate);

// Read-only reference data (country/state names) for populating dropdowns — no tenant scoping
// needed, just requires being logged in like every other endpoint.
geoRouter.get(
  "/geo/countries",
  asyncHandler(async (_req, res) => {
    const items = Country.getAllCountries()
      .map((c) => ({ isoCode: c.isoCode, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ items });
  })
);

geoRouter.get(
  "/geo/countries/:countryCode/states",
  validateRequest({ params: countryCodeParamSchema }),
  asyncHandler(async (req, res) => {
    const { countryCode } = req.params as unknown as { countryCode: string };
    const items = State.getStatesOfCountry(countryCode)
      .map((s) => ({ isoCode: s.isoCode, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ items });
  })
);
