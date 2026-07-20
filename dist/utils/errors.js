"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadRequestError = exports.ForbiddenError = exports.NotFoundError = exports.HttpError = void 0;
class HttpError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "HttpError";
    }
}
exports.HttpError = HttpError;
class NotFoundError extends HttpError {
    constructor(message = "Resource not found") {
        super(404, message);
    }
}
exports.NotFoundError = NotFoundError;
class ForbiddenError extends HttpError {
    constructor(message = "Forbidden") {
        super(403, message);
    }
}
exports.ForbiddenError = ForbiddenError;
class BadRequestError extends HttpError {
    constructor(message = "Bad request") {
        super(400, message);
    }
}
exports.BadRequestError = BadRequestError;
//# sourceMappingURL=errors.js.map