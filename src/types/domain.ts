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

// SITE_MANAGER is scoped to one or more sites via User.siteIds (see user.model.ts) rather than
// the whole client — a site manager oversees day-to-day operations (employees/schedules/punches)
// at specific locations, consumed by the sibling tlm-site-ops service, not by this repo directly.
export const USER_ROLES = ["PLATFORM_ADMIN", "CLIENT_ADMIN", "VIEWER", "SITE_MANAGER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Date DISPLAY format (day/month/year order and separator), settable per-client (the default for
// everyone under that client) and per-user (an individual's own override — see
// User.preferredDateFormat). The underlying calendar is always Gregorian — this only controls
// rendering, never date math (workweek/fiscal-year start is modeled separately per policy, e.g.
// OVERTIME.workweekStartDay). Covers the major real-world regional conventions: US (MM/DD/YYYY),
// UK/EU/Commonwealth/India (DD/MM/YYYY), ISO 8601 (YYYY-MM-DD), German/Central-Eastern European
// dotted (DD.MM.YYYY), dashed alternate (DD-MM-YYYY), and Japanese slashed (YYYY/MM/DD).
export const CALENDAR_FORMATS = [
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD",
  "DD.MM.YYYY",
  "DD-MM-YYYY",
  "YYYY/MM/DD",
] as const;
export type CalendarFormat = (typeof CALENDAR_FORMATS)[number];

// Clock DISPLAY format, settable per-client (default) and per-user (own override — see
// User.preferredTimeFormat), same posture as CALENDAR_FORMATS above.
export const TIME_FORMATS = ["12h", "24h"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

// A user's own display-language preference (distinct from their client's calendarFormat, which
// is shared by everyone under that client). Null means "no preference set" — the frontend falls
// back to its own browser-local default.
export const PREFERRED_LANGUAGES = ["en", "es", "ar"] as const;
export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number];

// Resolution priority when a target population overlaps across assignment scopes.
export const TARGET_TYPE_SPECIFICITY: Record<AssignmentTargetType, number> = {
  EMPLOYEE: 50,
  PAYGROUP: 40,
  LOCATION: 30,
  DEPARTMENT: 20,
  STATE: 10,
};

// Used by PayPeriodConfig (src/models/payPeriodConfig.model.ts) — mirrors tlm-punch-processor's
// own src/types/domain.ts exactly, since both services read/write the same collection.
export const CADENCES = ["daily", "weekly", "biweekly", "semi_monthly", "monthly", "salaried"] as const;
export type Cadence = (typeof CADENCES)[number];

export const PAY_DATE_WEEKEND_RULES = ["none", "prior_business_day", "next_business_day"] as const;
export type PayDateWeekendRule = (typeof PAY_DATE_WEEKEND_RULES)[number];
