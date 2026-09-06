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