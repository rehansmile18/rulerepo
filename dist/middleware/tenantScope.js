"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReadClientFilter = getReadClientFilter;
exports.assertCanWriteClient = assertCanWriteClient;
exports.assertCanWriteGlobal = assertCanWriteGlobal;
exports.requireClientId = requireClientId;
const mongoose_1 = require("mongoose");
const errors_1 = require("../utils/errors");
/**
 * Returns the Mongo filter clause enforcing tenant isolation for read queries.
 * PLATFORM_ADMIN may optionally narrow by an explicit clientId query param;
 * every other role is hard-scoped to their own token clientId (their own
 * client-owned documents; global documents are matched separately by callers).
 */
function getReadClientFilter(req) {
    if (!req.auth)
        throw new errors_1.ForbiddenError("Not authenticated");
    if (req.auth.role === "PLATFORM_ADMIN") {
        const requested = req.query.clientId;
        return typeof requested === "string" ? { clientId: new mongoose_1.Types.ObjectId(requested) } : {};
    }
    if (!req.auth.clientId)
        throw new errors_1.ForbiddenError("Token missing clientId for non-admin role");
    return { clientId: new mongoose_1.Types.ObjectId(req.auth.clientId) };
}
/** Throws unless the caller may write documents owned by targetClientId. */
function assertCanWriteClient(req, targetClientId) {
    if (!req.auth)
        throw new errors_1.ForbiddenError("Not authenticated");
    if (req.auth.role === "PLATFORM_ADMIN")
        return;
    if (req.auth.role !== "CLIENT_ADMIN")
        throw new errors_1.ForbiddenError("Insufficient role to modify this resource");
    if (req.auth.clientId !== targetClientId) {
        throw new errors_1.ForbiddenError("Cannot modify another client's resources");
    }
}
/** Throws unless the caller may write scope="global" documents (platform-curated templates). */
function assertCanWriteGlobal(req) {
    if (!req.auth || req.auth.role !== "PLATFORM_ADMIN") {
        throw new errors_1.ForbiddenError("Only PLATFORM_ADMIN may modify global policies");
    }
}
function requireClientId(clientId) {
    if (typeof clientId !== "string" || !mongoose_1.Types.ObjectId.isValid(clientId)) {
        throw new errors_1.BadRequestError("A valid clientId is required");
    }
    return clientId;
}
//# sourceMappingURL=tenantScope.js.map