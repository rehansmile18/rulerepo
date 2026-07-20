"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const mongoose_1 = require("mongoose");
const clientSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended"], required: true, default: "active" },
    enabledStates: { type: [String], default: [] },
    createdAt: { type: Date, required: true, default: () => new Date() },
}, { collection: "clients" });
exports.Client = (0, mongoose_1.model)("Client", clientSchema);
//# sourceMappingURL=client.model.js.map