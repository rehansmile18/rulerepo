"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const validateRequest_1 = require("../../middleware/validateRequest");
const errorHandler_1 = require("../../middleware/errorHandler");
const client_model_1 = require("../../models/client.model");
const createClientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    enabledStates: zod_1.z.array(zod_1.z.string().length(2)).default([]),
});
exports.clientRouter = (0, express_1.Router)();
exports.clientRouter.use(auth_1.authenticate, (0, auth_1.requireRole)("PLATFORM_ADMIN"));
exports.clientRouter.get("/clients", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const clients = await client_model_1.Client.find().lean();
    res.json({ items: clients });
}));
exports.clientRouter.post("/clients", (0, validateRequest_1.validateRequest)({ body: createClientSchema }), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const client = await client_model_1.Client.create(req.body);
    res.status(201).json(client);
}));
//# sourceMappingURL=client.routes.js.map