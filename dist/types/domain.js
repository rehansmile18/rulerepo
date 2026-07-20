"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TARGET_TYPE_SPECIFICITY = exports.USER_ROLES = exports.RULE_GROUP_STATUSES = exports.ASSIGNMENT_STATUSES = exports.ASSIGNMENT_TARGET_TYPES = exports.POLICY_SCOPES = exports.POLICY_STATUSES = exports.POLICY_TYPES = void 0;
exports.POLICY_TYPES = [
    "OVERTIME",
    "MEAL_BREAK",
    "REST_BREAK",
    "SHIFT",
    "SHIFT_DIFFERENTIAL",
    "PAY_DIFFERENTIAL",
    "NIGHT_DIFFERENTIAL",
    "PAYGROUP",
    "RATE",
    "CA_MEAL_BREAK",
];
exports.POLICY_STATUSES = [
    "draft",
    "pending_approval",
    "active",
    "superseded",
    "archived",
];
exports.POLICY_SCOPES = ["global", "client"];
exports.ASSIGNMENT_TARGET_TYPES = [
    "EMPLOYEE",
    "PAYGROUP",
    "LOCATION",
    "DEPARTMENT",
    "STATE",
];
exports.ASSIGNMENT_STATUSES = ["active", "scheduled", "expired"];
exports.RULE_GROUP_STATUSES = ["draft", "active", "superseded", "archived"];
exports.USER_ROLES = ["PLATFORM_ADMIN", "CLIENT_ADMIN", "VIEWER"];
// Resolution priority when a target population overlaps across assignment scopes.
exports.TARGET_TYPE_SPECIFICITY = {
    EMPLOYEE: 50,
    PAYGROUP: 40,
    LOCATION: 30,
    DEPARTMENT: 20,
    STATE: 10,
};
//# sourceMappingURL=domain.js.map