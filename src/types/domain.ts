export const POLICY_TYPES = [
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
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export const POLICY_STATUSES = [
  "draft",
  "pending_approval",
  "active",
  "superseded",
  "archived",
] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const POLICY_SCOPES = ["global", "client"] as const;
export type PolicyScope = (typeof POLICY_SCOPES)[number];

export const ASSIGNMENT_TARGET_TYPES = [
  "EMPLOYEE",
  "PAYGROUP",
  "LOCATION",
  "DEPARTMENT",
  "STATE",
] as const;
export type AssignmentTargetType = (typeof ASSIGNMENT_TARGET_TYPES)[number];

export const ASSIGNMENT_STATUSES = ["active", "scheduled", "expired"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const RULE_GROUP_STATUSES = ["draft", "active", "superseded", "archived"] as const;
export type RuleGroupStatus = (typeof RULE_GROUP_STATUSES)[number];

export const USER_ROLES = ["PLATFORM_ADMIN", "CLIENT_ADMIN", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Per-client date DISPLAY format (day/month/year order and separator) shown to every user under
// that client, throughout the app. The underlying calendar is always Gregorian — this only
// controls rendering, never date math (workweek/fiscal-year start is modeled separately per
// policy, e.g. OVERTIME.workweekStartDay).
export const CALENDAR_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;
export type CalendarFormat = (typeof CALENDAR_FORMATS)[number];

// Resolution priority when a target population overlaps across assignment scopes.
export const TARGET_TYPE_SPECIFICITY: Record<AssignmentTargetType, number> = {
  EMPLOYEE: 50,
  PAYGROUP: 40,
  LOCATION: 30,
  DEPARTMENT: 20,
  STATE: 10,
};
