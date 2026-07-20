"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsersQuerySchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
const domain_1 = require("../../types/domain");
exports.createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    role: zod_1.z.enum(domain_1.USER_ROLES),
    clientId: zod_1.z.string().optional(),
});
exports.listUsersQuerySchema = zod_1.z.object({
    clientId: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
//# sourceMappingURL=user.validators.js.map