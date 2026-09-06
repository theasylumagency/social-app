import type { JsonSchema } from "./model-runner"

export { AUDIENCE_HYPOTHESIS_OUTPUT_SCHEMA } from "../../src/blueprints/social/brand-discovery/schemas"

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

export { AUDIENCE_COMMUNICATION_PROFILE_OUTPUT_SCHEMA } from "../../src/blueprints/social/brand-discovery/schemas"

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

export { COMMUNICATION_ENVELOPE_OUTPUT_SCHEMA } from "../../src/blueprints/social/brand-discovery/schemas"

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
export const CONTENT_WRITER_OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        draft: {
            type: "object",
            additionalProperties: false,

            properties: {
                text: {
                    type: [
                        "string",
                        "null",
                    ],
                },

                caption: {
                    type: [
                        "string",
                        "null",
                    ],
                },

                frames: {
                    type: "array",

                    items: {
                        type: "object",
                        additionalProperties: false,

                        properties: {
                            heading: {
                                type: [
                                    "string",
                                    "null",
                                ],
                            },

                            body: {
                                type: "string",
                            },
                        },

                        required: [
                            "heading",
                            "body",
                        ],
                    },
                },

                script: {
                    type: [
                        "string",
                        "null",
                    ],
                },

                onScreenText: {
                    type: "array",

                    items: {
                        type: "string",
                    },
                },
            },

            required: [
                "text",
                "caption",
                "frames",
                "script",
                "onScreenText",
            ],
        },
    },

    required: [
        "draft",
    ],
} as const satisfies JsonSchema
export const CONTENT_WRITER_GOLDEN_EVALUATION_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        scores: {
            type: "object",
            additionalProperties: false,

            properties: {
                briefFidelity: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                evidenceDiscipline: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                brandVoiceFit: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                executionQuality: {
                    type: "integer",
                    enum: [0, 1, 2],
                },

                editorialQuality: {
                    type: "integer",
                    enum: [0, 1, 2],
                },
            },

            required: [
                "briefFidelity",
                "evidenceDiscipline",
                "brandVoiceFit",
                "executionQuality",
                "editorialQuality",
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
export const CONTENT_REPAIR_GOLDEN_EVALUATION_SCHEMA = {
    type:
        "object",

    additionalProperties:
        false,

    properties: {
        scores: {
            type:
                "object",

            additionalProperties:
                false,

            properties: {
                repairEffectiveness: {
                    type:
                        "integer",

                    enum:
                        [0, 1, 2],
                },

                preservationDiscipline: {
                    type:
                        "integer",

                    enum:
                        [0, 1, 2],
                },

                evidenceDiscipline: {
                    type:
                        "integer",

                    enum:
                        [0, 1, 2],
                },

                strategyFidelity: {
                    type:
                        "integer",

                    enum:
                        [0, 1, 2],
                },

                editorialQuality: {
                    type:
                        "integer",

                    enum:
                        [0, 1, 2],
                },
            },

            required: [
                "repairEffectiveness",
                "preservationDiscipline",
                "evidenceDiscipline",
                "strategyFidelity",
                "editorialQuality",
            ],
        },

        regressions: {
            type:
                "array",

            items: {
                type:
                    "object",

                additionalProperties:
                    false,

                properties: {
                    category: {
                        type:
                            "string",

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
                        type:
                            "string",

                        enum: [
                            "critical",
                            "major",
                            "minor",
                        ],
                    },

                    explanation: {
                        type:
                            "string",
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
            type:
                "string",
        },
    },

    required: [
        "scores",
        "regressions",
        "summary",
    ],
} as const satisfies JsonSchema