import type { JsonSchema } from "./model-runner"

export const AUDIENCE_HYPOTHESIS_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        segments: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    name: {
                        type: "string",
                    },
                    buyingSituation: {
                        type: "string",
                    },
                    currentNeed: {
                        type: "string",
                    },
                    relevantOffers: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                    mainQuestions: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                    likelyBarriers: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                    decisionStage: {
                        type: "string",
                        enum: [
                            "unaware",
                            "problemAware",
                            "solutionAware",
                            "providerComparison",
                            "decisionReady",
                            "existingCustomer",
                            "returningCustomer",
                        ],
                    },
                    evidenceKeys: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                    rationale: {
                        type: "string",
                    },
                    assumptions: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                    confidenceBand: {
                        type: "string",
                        enum: [
                            "tentative",
                            "reasonable",
                            "strong",
                        ],
                    },
                },
                required: [
                    "name",
                    "buyingSituation",
                    "currentNeed",
                    "relevantOffers",
                    "mainQuestions",
                    "likelyBarriers",
                    "decisionStage",
                    "evidenceKeys",
                    "rationale",
                    "assumptions",
                    "confidenceBand",
                ],
            },
        },
    },
    required: ["segments"],
} as const satisfies JsonSchema

export const AUDIENCE_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        scores: {
            type: "object",
            additionalProperties: false,
            properties: {
                distinctness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
                businessSpecificity: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
                founderImpact: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },
            required: [
                "distinctness",
                "businessSpecificity",
                "evidenceDiscipline",
                "managerialUsefulness",
                "founderImpact",
            ],
        },

        regressions: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    category: {
                        type: "string",
                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },
                    severity: {
                        type: "string",
                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },
                    explanation: {
                        type: "string",
                    },
                },
                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
    ],
} as const satisfies JsonSchema

export const AUDIENCE_COMMUNICATION_PROFILE_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        profiles: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    audienceKey: {
                        type: "string",
                    },

                    communicationGoal: {
                        type: "string",
                    },

                    toneAdjustments: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },

                    preferredFraming: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },

                    usefulContentAngles: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },

                    assumedKnowledge: {
                        type: "string",
                        enum: [
                            "none",
                            "basic",
                            "informed",
                            "expert",
                        ],
                    },

                    explanationDepth: {
                        type: "string",
                        enum: [
                            "light",
                            "balanced",
                            "deep",
                        ],
                    },

                    trustMechanisms: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },

                    ctaStyle: {
                        type: "string",
                        enum: [
                            "informational",
                            "lowPressure",
                            "consultative",
                            "directWhenJustified",
                        ],
                    },

                    avoid: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },

                    rationale: {
                        type: "string",
                    },
                },

                required: [
                    "audienceKey",
                    "communicationGoal",
                    "toneAdjustments",
                    "preferredFraming",
                    "usefulContentAngles",
                    "assumedKnowledge",
                    "explanationDepth",
                    "trustMechanisms",
                    "ctaStyle",
                    "avoid",
                    "rationale",
                ],
            },
        },
    },

    required: ["profiles"],
} as const satisfies JsonSchema

export const COMMUNICATION_PROFILE_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                audienceFit: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                brandPreservation: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                differentiation: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "audienceFit",
                "brandPreservation",
                "differentiation",
                "evidenceDiscipline",
                "managerialUsefulness",
            ],
        },

        regressions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    category: {
                        type: "string",
                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },

                    severity: {
                        type: "string",
                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type: "string",
                    },
                },

                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
    ],
} as const satisfies JsonSchema

export const COMMUNICATION_ENVELOPE_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        envelope: {
            type: "object",
            additionalProperties: false,

            properties: {
                complexity: {
                    type: "string",
                    enum: [
                        "plain",
                        "plainWithProfessionalDepth",
                        "technicalWhenExplained",
                        "expert",
                    ],
                },

                assumedKnowledge: {
                    type: "string",
                    enum: [
                        "none",
                        "basic",
                        "informed",
                        "expert",
                    ],
                },

                explanationDepth: {
                    type: "string",
                    enum: [
                        "light",
                        "balanced",
                        "deep",
                    ],
                },

                toneRange: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },

                framingRules: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },

                preferredStructures: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },

                terminologyRules: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },

                proofStyle: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },

                ctaStyle: {
                    type: "string",
                    enum: [
                        "informational",
                        "lowPressure",
                        "consultative",
                        "directWhenJustified",
                    ],
                },

                salesPressure: {
                    type: "string",
                    enum: [
                        "low",
                        "moderate",
                        "high",
                    ],
                },

                inclusivityRules: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },

                trustMechanisms: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },

                avoid: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },

                rationale: {
                    type: "string",
                },
            },

            required: [
                "complexity",
                "assumedKnowledge",
                "explanationDepth",
                "toneRange",
                "framingRules",
                "preferredStructures",
                "terminologyRules",
                "proofStyle",
                "ctaStyle",
                "salesPressure",
                "inclusivityRules",
                "trustMechanisms",
                "avoid",
                "rationale",
            ],
        },
    },

    required: ["envelope"],
} as const satisfies JsonSchema

export const COMMUNICATION_ENVELOPE_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                brandPreservation: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                crossAudienceFit: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                synthesisQuality: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "brandPreservation",
                "crossAudienceFit",
                "synthesisQuality",
                "evidenceDiscipline",
                "managerialUsefulness",
            ],
        },

        regressions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    category: {
                        type: "string",
                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },

                    severity: {
                        type: "string",
                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type: "string",
                    },
                },

                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
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

export const WEEKLY_AUDIENCE_FOCUS_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                objectiveAlignment: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                focusDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                audienceFit: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "objectiveAlignment",
                "focusDiscipline",
                "audienceFit",
                "evidenceDiscipline",
                "managerialUsefulness",
            ],
        },

        regressions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    category: {
                        type: "string",
                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },

                    severity: {
                        type: "string",
                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type: "string",
                    },
                },

                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
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
export const CONTENT_AUDIENCE_DIRECTION_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                directionFit: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                weeklyFocusDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                biasCalibration: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "directionFit",
                "weeklyFocusDiscipline",
                "biasCalibration",
                "evidenceDiscipline",
                "managerialUsefulness",
            ],
        },

        regressions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    category: {
                        type: "string",
                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },

                    severity: {
                        type: "string",
                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type: "string",
                    },
                },

                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
    ],
} as const satisfies JsonSchema
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
export const WEEKLY_OBJECTIVE_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                usefulProgress: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                contextAlignment: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                focusDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "usefulProgress",
                "contextAlignment",
                "focusDiscipline",
                "evidenceDiscipline",
                "managerialUsefulness",
            ],
        },

        regressions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    category: {
                        type: "string",
                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },

                    severity: {
                        type: "string",
                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type: "string",
                    },
                },

                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
    ],
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

export const CONTENT_DIRECTION_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                objectiveAlignment: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                strategicDistinctness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                directionAbstraction: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "objectiveAlignment",
                "strategicDistinctness",
                "directionAbstraction",
                "evidenceDiscipline",
                "managerialUsefulness",
            ],
        },

        regressions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    category: {
                        type: "string",
                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },

                    severity: {
                        type: "string",
                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type: "string",
                    },
                },

                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
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
export const EXPERIMENT_DECISION_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                decisionQuality: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                hypothesisQuality: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                experimentIsolation: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "decisionQuality",
                "hypothesisQuality",
                "experimentIsolation",
                "evidenceDiscipline",
                "managerialUsefulness",
            ],
        },

        regressions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    category: {
                        type: "string",
                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },

                    severity: {
                        type: "string",
                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type: "string",
                    },
                },

                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
    ],
} as const satisfies JsonSchema

export const CONTENT_BRIEF_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        contentBrief: {
            type: "object",
            additionalProperties: false,

            properties: {
                communicationJob: {
                    type: "string",
                },

                keyTakeaway: {
                    type: "string",
                },

                supportingPoints: {
                    type: "array",
                    minItems: 2,
                    maxItems: 5,

                    items: {
                        type: "string",
                    },
                },

                evidenceMode: {
                    type: "string",
                    enum: [
                        "noProofNeeded",
                        "evidenceSupported",
                        "proofRequired",
                    ],
                },

                evidenceKeys: {
                    type: "array",

                    items: {
                        type: "string",
                    },
                },

                ctaIntent: {
                    type: "string",
                    enum: [
                        "none",
                        "inform",
                        "encourageReflection",
                        "inviteQuestion",
                        "inviteConsultation",
                        "directAction",
                    ],
                },

                constraints: {
                    type: "array",

                    items: {
                        type: "string",
                    },
                },

                mustNotSay: {
                    type: "array",

                    items: {
                        type: "string",
                    },
                },

                rationale: {
                    type: "string",
                },
            },

            required: [
                "communicationJob",
                "keyTakeaway",
                "supportingPoints",
                "evidenceMode",
                "evidenceKeys",
                "ctaIntent",
                "constraints",
                "mustNotSay",
                "rationale",
            ],
        },
    },

    required: [
        "contentBrief",
    ],
} as const satisfies JsonSchema

export const CONTENT_BRIEF_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                directionFit: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                briefSpecificity: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                boundaryDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "directionFit",
                "briefSpecificity",
                "evidenceDiscipline",
                "boundaryDiscipline",
                "managerialUsefulness",
            ],
        },

        regressions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    category: {
                        type: "string",
                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },

                    severity: {
                        type: "string",
                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type: "string",
                    },
                },

                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
    ],
} as const satisfies JsonSchema
export const CONTENT_EXECUTION_SPEC_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        executionSpecs: {
            type: "array",
            minItems: 1,
            maxItems: 2,

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    channel: {
                        type: "string",
                        enum: [
                            "facebook",
                            "instagram",
                        ],
                    },

                    contentMode: {
                        type: "string",
                        enum: [
                            "social.brandStory",
                            "social.educational",
                            "social.serviceExplainer",
                            "social.trustBuilder",
                            "social.proofLed",
                            "social.directOffer",
                        ],
                    },

                    format: {
                        type: "string",
                        enum: [
                            "staticPost",
                            "carousel",
                            "story",
                            "reel",
                        ],
                    },

                    depth: {
                        type: "string",
                        enum: [
                            "compact",
                            "standard",
                            "deep",
                        ],
                    },

                    visualDependency: {
                        type: "string",
                        enum: [
                            "none",
                            "supporting",
                            "essential",
                        ],
                    },

                    executionGuidance: {
                        type: "array",

                        items: {
                            type: "string",
                        },
                    },

                    constraints: {
                        type: "array",

                        items: {
                            type: "string",
                        },
                    },

                    rationale: {
                        type: "string",
                    },
                },

                required: [
                    "channel",
                    "contentMode",
                    "format",
                    "depth",
                    "visualDependency",
                    "executionGuidance",
                    "constraints",
                    "rationale",
                ],
            },
        },
    },

    required: [
        "executionSpecs",
    ],
} as const satisfies JsonSchema
export const CONTENT_EXECUTION_SPEC_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                briefFit: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                formatFit: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                channelDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                boundaryDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                managerialUsefulness: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "briefFit",
                "formatFit",
                "channelDiscipline",
                "boundaryDiscipline",
                "managerialUsefulness",
            ],
        },

        regressions: {
            type: "array",

            items: {
                type: "object",
                additionalProperties: false,

                properties: {
                    category: {
                        type: "string",

                        enum: [
                            "STRUCTURAL",
                            "EVIDENCE",
                            "SEGMENTATION",
                            "BUSINESS_SPECIFICITY",
                            "AUTHORITY",
                            "BRAND_PRESERVATION",
                            "CROSS_AUDIENCE_SYNTHESIS",
                            "MANAGERIAL_USEFULNESS",
                            "GENERIC_AI_OUTPUT",
                        ],
                    },

                    severity: {
                        type: "string",

                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type: "string",
                    },
                },

                required: [
                    "category",
                    "severity",
                    "explanation",
                ],
            },
        },

        summary: {
            type: "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
    ],
} as const satisfies JsonSchema