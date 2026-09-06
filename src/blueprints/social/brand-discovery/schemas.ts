export type JsonSchema = Readonly<Record<string, unknown>>

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


const text = (maxLength = 1200) => ({ type: "string", minLength: 1, maxLength })
const list = (items: JsonSchema, minItems = 0, maxItems = 8) => ({ type: "array", items, minItems, maxItems })
const object = (properties: Record<string, JsonSchema>) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) })
const citation = { sourceKey: text(30), exactExcerpt: { type: "string", minLength: 12, maxLength: 700 } }
export const BUSINESS_UNDERSTANDING_SCHEMA = object({
  name: text(120), summary: text(1000), businessModel: text(700), positioning: text(700), valueProposition: text(700),
  offers: list(object({ name: text(140), description: text(600), ...citation }), 1, 30),
  distinctiveSignals: list(object({ statement: text(500), ...citation }), 1, 6),
  audienceSignals: list(object({ statement: text(500), ...citation }), 0, 6),
  voice: object({ traits: list(text(120), 2, 5), principles: list(text(400), 2, 5), examples: list(object(citation), 0, 3) }),
  constraints: list(text(400), 0, 8),
  openQuestions: list(object({ question: text(250), whyItMatters: text(400) }), 0, 3),
})
export const BRAND_GOALS_SCHEMA = object({ goals: list(object({
  title: text(160), desiredChange: text(600), rationale: text(700), audienceKeys: list(text(30), 1, 8), progressSignals: list(text(400), 2, 4),
}), 2, 4) })
