"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
function validateRequest(schemas) {
    return (req, _res, next) => {
        if (schemas.body)
            req.body = schemas.body.parse(req.body);
        if (schemas.query)
            req.query = schemas.query.parse(req.query);
        if (schemas.params)
            req.params = schemas.params.parse(req.params);
        next();
    };
}
//# sourceMappingURL=validateRequest.js.map