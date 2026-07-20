"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
exports.asyncHandler = asyncHandler;
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorHandler(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({ error: "ValidationError", details: err.issues });
        return;
    }
    if (err instanceof errors_1.HttpError) {
        res.status(err.statusCode).json({ error: err.name, message: err.message });
        return;
    }
    if (err instanceof Error && err.name === "MongoServerError" && err.code === 11000) {
        res.status(409).json({ error: "ConflictError", message: "Duplicate resource" });
        return;
    }
    console.error(err);
    res.status(500).json({ error: "InternalError", message: "An unexpected error occurred" });
}
function notFoundHandler(req, res) {
    res.status(404).json({ error: "NotFoundError", message: `No route for ${req.method} ${req.path}` });
}
// Wraps async route handlers so thrown/rejected errors reach errorHandler.
function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
//# sourceMappingURL=errorHandler.js.map