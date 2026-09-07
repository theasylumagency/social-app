import type { JsonSchema } from "../brand-discovery/schemas"

export const WEEKLY_OBJECTIVE_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        weeklyObjective: {
            type: "object",
            additionalProperties: false,

            properties: {
                objective: {
                    type: "string",
                },

                rationale: {
                    type: "string",
                },

                deliberateOmissions: {
                    type: "array",

                    items: {
                        type: "string",
                    },
                },
            },

            required: [
                "objective",
                "rationale",
                "deliberateOmissions",
            ],
        },
    },

    required: [
        "weeklyObjective",
    ],
} as const satisfies JsonSchema

export const WEEKLY_AUDIENCE_FOCUS_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        focus: {
            type: "object",
            additionalProperties: false,

            properties: {
                primaryAudienceKey: {
                    type: "string",
                },

                secondaryAudienceKeys: {
                    type: "array",
                    maxItems: 1,

                    items: {
                        type: "string",
                    },
                },

                rationale: {
                    type: "string",
                },
            },

            required: [
                "primaryAudienceKey",
                "secondaryAudienceKeys",
                "rationale",
            ],
        },
    },

    required: ["focus"],
} as const satisfies JsonSchema

export const CONTENT_DIRECTION_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        directions: {
            type: "array",
            minItems: 3,
            maxItems: 5,

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    direction: {
                        type: "string",
                    },

                    purpose: {
                        type: "string",
                    },

                    rationale: {
                        type: "string",
                    },
                },

                required: [
                    "direction",
                    "purpose",
                    "rationale",
                ],
            },
        },
    },

    required: [
        "directions",
    ],
} as const satisfies JsonSchema

export const CONTENT_AUDIENCE_DIRECTION_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        directions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    contentDirectionKey: {
                        type: "string",
                    },

                    primaryAudienceKey: {
                        type: "string",
                    },

                    secondaryAudienceKeys: {
                        type: "array",
                        maxItems: 1,

                        items: {
                            type: "string",
                        },
                    },

                    bias: {
                        type: "string",
                        enum: [
                            "balanced",
                            "moreExplanatory",
                            "moreDecisionOriented",
                            "moreTrustFocused",
                            "morePractical",
                        ],
                    },
                },

                required: [
                    "contentDirectionKey",
                    "primaryAudienceKey",
                    "secondaryAudienceKeys",
                    "bias",
                ],
            },
        },
    },

    required: [
        "directions",
    ],
} as const satisfies JsonSchema

export const EXPERIMENT_DECISION_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        experimentDecision: {
            type: "object",
            additionalProperties: false,

            properties: {
                decision: {
                    type: "string",
                    enum: [
                        "noExperiment",
                        "experiment",
                    ],
                },

                rationale: {
                    type: "string",
                },

                experiment: {
                    type: "object",
                    additionalProperties: false,

                    properties: {
                        hypothesis: {
                            type: [
                                "string",
                                "null",
                            ],
                        },

                        variable: {
                            type: [
                                "string",
                                "null",
                            ],
                        },

                        comparison: {
                            type: [
                                "string",
                                "null",
                            ],
                        },

                        learningSignal: {
                            type: [
                                "string",
                                "null",
                            ],
                        },

                        guardrails: {
                            type: "array",

                            items: {
                                type: "string",
                            },
                        },
                    },

                    required: [
                        "hypothesis",
                        "variable",
                        "comparison",
                        "learningSignal",
                        "guardrails",
                    ],
                },
            },

            required: [
                "decision",
                "rationale",
                "experiment",
            ],
        },
    },

    required: [
        "experimentDecision",
    ],
} as const satisfies JsonSchema

const string = { type: "string", minLength: 1, maxLength: 1000 } as const
const strings = (minItems = 0, maxItems = 5) => ({ type: "array", minItems, maxItems, items: string })
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) })
export const WEEKLY_PLAN_REVIEW_SCHEMA = object({
  brandGoalKeys: strings(1, 4), progressSignals: strings(2, 4),
  checks: object({ brandSpecificity: string, focusCoherence: string, voiceCompatibility: string, evidenceDiscipline: string, priorityResponse: string }),
  concerns: { type: "array", maxItems: 6, items: object({ severity: { type: "string", enum: ["blocking", "advisory"] }, message: string, directionKeys: strings(0, 5) }) },
}) satisfies JsonSchema
