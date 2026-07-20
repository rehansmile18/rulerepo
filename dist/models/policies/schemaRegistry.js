"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyRulesSchemas = void 0;
/**
 * Hand-authored JSON Schema for each policyType's `rules` payload, mirroring the
 * corresponding Mongoose discriminator schema (see the sibling *.model.ts files).
 * Consumed by GET /policy-types so an admin UI can render a dynamic authoring form
 * per policy type without hardcoding one form per type.
 *
 * Kept as a hand-maintained registry rather than derived from Mongoose at runtime —
 * simpler to reason about and to keep in sync with each discriminator's intent
 * (defaults, enums, and field descriptions carry compliance meaning that a mechanical
 * Mongoose-to-JSON-Schema conversion would lose).
 */
exports.policyRulesSchemas = {
    OVERTIME: {
        description: "Daily/weekly overtime and double-time thresholds, including 7th-consecutive-day rules.",
        rulesSchema: {
            type: "object",
            required: ["workweekStartDay", "weeklyOTThresholdHours"],
            properties: {
                workweekStartDay: { type: "string", enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
                dailyOTThresholdHours: { type: ["number", "null"], minimum: 0 },
                dailyDTThresholdHours: { type: ["number", "null"], minimum: 0 },
                weeklyOTThresholdHours: { type: "number", minimum: 0, default: 40 },
                seventhConsecutiveDayRule: {
                    type: "object",
                    properties: {
                        enabled: { type: "boolean" },
                        otAfterHours: { type: "number", minimum: 0 },
                        dtAfterHours: { type: ["number", "null"], minimum: 0 },
                    },
                },
            },
        },
    },
    CA_MEAL_BREAK: {
        description: "California Labor Code meal-break mechanics: timing, waivers, second meal, and premium-pay penalty.",
        rulesSchema: {
            type: "object",
            required: ["minShiftLengthForFirstMealMinutes", "mealDurationMinMinutes"],
            properties: {
                minShiftLengthForFirstMealMinutes: { type: "number", minimum: 0, default: 300 },
                mealDurationMinMinutes: { type: "number", minimum: 0, default: 30 },
                mealMustStartByHourIntoShift: { type: "number", minimum: 0, default: 5 },
                waiverAllowedUnderShiftHours: { type: "number", minimum: 0, default: 6 },
                secondMealRequiredOverShiftHours: { type: "number", minimum: 0, default: 10 },
                onDutyMealAllowed: { type: "boolean", default: false },
                penalty: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["premium_pay"] },
                        hours: { type: "number", minimum: 0 },
                        rate: { type: "string", enum: ["regular", "overtime"] },
                    },
                },
            },
        },
    },
    MEAL_BREAK: {
        description: "Generic (non-CA) meal-break requirement for states without CA-specific mechanics.",
        rulesSchema: {
            type: "object",
            required: ["minShiftLengthForMealMinutes", "mealDurationMinMinutes"],
            properties: {
                minShiftLengthForMealMinutes: { type: "number", minimum: 0, default: 360 },
                mealDurationMinMinutes: { type: "number", minimum: 0, default: 30 },
                paidMeal: { type: "boolean", default: false },
                waiverAllowed: { type: "boolean", default: true },
            },
        },
    },
    REST_BREAK: {
        description: "Paid rest-break entitlement and the premium owed if it's missed.",
        rulesSchema: {
            type: "object",
            required: ["restBreakDurationMinutes", "minutesOfWorkPerRestBreak"],
            properties: {
                paidRestBreak: { type: "boolean", default: true },
                restBreakDurationMinutes: { type: "number", minimum: 0, default: 10 },
                minutesOfWorkPerRestBreak: { type: "number", minimum: 0, default: 240 },
                penalty: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["premium_pay"] },
                        hours: { type: "number", minimum: 0 },
                        rate: { type: "string", enum: ["regular", "overtime"] },
                    },
                },
            },
        },
    },
    SHIFT: {
        description: "Shift-length bounds, minimum rest between shifts, and split-shift premium.",
        rulesSchema: {
            type: "object",
            required: ["minShiftLengthHours", "maxShiftLengthHours", "minRestBetweenShiftsHours"],
            properties: {
                minShiftLengthHours: { type: "number", minimum: 0, default: 2 },
                maxShiftLengthHours: { type: "number", minimum: 0, default: 12 },
                minRestBetweenShiftsHours: { type: "number", minimum: 0, default: 8 },
                splitShiftPremium: {
                    type: "object",
                    properties: {
                        enabled: { type: "boolean" },
                        hours: { type: "number", minimum: 0 },
                    },
                },
            },
        },
    },
    SHIFT_DIFFERENTIAL: {
        description: "Time-of-day pay differential bands (e.g. evening shift premium).",
        rulesSchema: {
            type: "object",
            required: ["timeBands"],
            properties: {
                timeBands: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["start", "end", "differentialType", "value"],
                        properties: {
                            start: { type: "string", pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$" },
                            end: { type: "string", pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$" },
                            differentialType: { type: "string", enum: ["percent", "flat"] },
                            value: { type: "number", minimum: 0 },
                        },
                    },
                },
            },
        },
    },
    NIGHT_DIFFERENTIAL: {
        description: "Night-shift pay differential bands — same mechanics as SHIFT_DIFFERENTIAL, tracked as its own statutory/contractual rule.",
        rulesSchema: {
            type: "object",
            required: ["timeBands"],
            properties: {
                timeBands: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["start", "end", "differentialType", "value"],
                        properties: {
                            start: { type: "string", pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$" },
                            end: { type: "string", pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$" },
                            differentialType: { type: "string", enum: ["percent", "flat"] },
                            value: { type: "number", minimum: 0 },
                        },
                    },
                },
            },
        },
    },
    PAY_DIFFERENTIAL: {
        description: "Conditional pay adjustments — certifications, hazard pay, location premiums.",
        rulesSchema: {
            type: "object",
            required: ["conditions"],
            properties: {
                conditions: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["type", "code", "differentialType", "value"],
                        properties: {
                            type: { type: "string" },
                            code: { type: "string" },
                            differentialType: { type: "string", enum: ["percent", "flat"] },
                            value: { type: "number", minimum: 0 },
                        },
                    },
                },
            },
        },
    },
    RATE: {
        description: "Base rate type and the minimum wage floor that applies.",
        rulesSchema: {
            type: "object",
            required: ["rateType", "minimumWage", "minimumWageSource"],
            properties: {
                rateType: { type: "string", enum: ["hourly", "salary"] },
                minimumWage: { type: "number", minimum: 0 },
                minimumWageSource: { type: "string" },
            },
        },
    },
    PAYGROUP: {
        description: "Pay frequency, workweek anchor, and the default overtime policy for a paygroup.",
        rulesSchema: {
            type: "object",
            required: ["payFrequency", "workweekStart"],
            properties: {
                payFrequency: { type: "string", enum: ["weekly", "biweekly", "semimonthly", "monthly"] },
                workweekStart: { type: "string", enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
                defaultOvertimePolicyId: { type: ["string", "null"] },
            },
        },
    },
};
//# sourceMappingURL=schemaRegistry.js.map