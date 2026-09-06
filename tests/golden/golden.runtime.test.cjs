const {
    TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT,
} = require(
    "./total-charm-dent.communication-profile.fixture.cjs",
)
const {
    TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT,
} = require(
    "./total-charm-dent.weekly-audience-focus.fixture.cjs",
)
const {
    TOTAL_CHARM_DENT_CONTENT_AUDIENCE_DIRECTION_INPUT,
} = require(
    "./total-charm-dent.content-audience-direction.fixture.cjs",
)
const {
    TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT,
} = require(
    "./total-charm-dent.weekly-objective.fixture.cjs",
)
const {
    TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT,
} = require(
    "./total-charm-dent.content-direction.fixture.cjs",
)

const {
    evaluateContentDirectionProposal,
} = require(
    "./content-direction-deterministic-evaluator.cjs",
)
const {
    TOTAL_CHARM_DENT_EXPERIMENT_DECISION_INPUT,
} = require(
    "./total-charm-dent.experiment-decision.fixture.cjs",
)

const {
    evaluateExperimentDecisionProposal,
} = require(
    "./experiment-decision-deterministic-evaluator.cjs",
)



const {
    evaluateWeeklyObjectiveProposal,
} = require(
    "./weekly-objective-deterministic-evaluator.cjs",
)


const {
    evaluateContentAudienceDirectionProposal,
} = require(
    "./content-audience-direction-deterministic-evaluator.cjs",
)
const {
    evaluateWeeklyAudienceFocusProposal,
} = require(
    "./weekly-audience-focus-deterministic-evaluator.cjs",
)
const {
    evaluateCommunicationProfileProposal,
} = require(
    "./communication-profile-deterministic-evaluator.cjs",
)
const {
    TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT,
} = require(
    "./total-charm-dent.communication-envelope.fixture.cjs",
)

const {
    evaluateCommunicationEnvelopeProposal,
} = require(
    "./communication-envelope-deterministic-evaluator.cjs",
)
const assert = require("node:assert/strict")
const test = require("node:test")

const {
    TOTAL_CHARM_DENT_GOLDEN_INPUT,
} = require("./total-charm-dent.fixture.cjs")

const {
    evaluateAudienceProposal,
} = require("./audience-deterministic-evaluator.cjs")

test("Total Charm Dent fixture contains stable audience reasoning context", () => {
    assert.equal(
        TOTAL_CHARM_DENT_GOLDEN_INPUT.caseId,
        "total-charm-dent-v1",
    )

    assert.equal(
        TOTAL_CHARM_DENT_GOLDEN_INPUT.offers.length > 0,
        true,
    )

    assert.equal(
        TOTAL_CHARM_DENT_GOLDEN_INPUT.evidenceSummary.length > 0,
        true,
    )
})

test("audience deterministic evaluator accepts a valid proposal", () => {
    const output = {
        segments: [
            {
                name: "გადაწყვეტილებასთან ახლოს მყოფი მომხმარებელი",
                buyingSituation:
                    "უკვე იცის, რომ მკურნალობა სჭირდება და არჩევს შესაბამის პროვაიდერს.",
                currentNeed:
                    "შეამციროს არჩევანის გაურკვევლობა.",
                relevantOffers: ["Implantology"],
                mainQuestions: [
                    "რა უნდა გავითვალისწინო არჩევისას?",
                ],
                likelyBarriers: [
                    "risk perception",
                    "comparison difficulty",
                ],
                decisionStage: "providerComparison",
                evidenceKeys: ["e1", "e4"],
                rationale:
                    "მაღალი ჩართულობის მკურნალობა ჩვეულებრივ მოითხოვს პროვაიდერის შეფასებას.",
                assumptions: [
                    "პირდაპირი provider-comparison მონაცემი ჯერ არ გვაქვს.",
                ],
                confidenceBand: "reasonable",
            },
        ],
    }

    const result = evaluateAudienceProposal(
        output,
        TOTAL_CHARM_DENT_GOLDEN_INPUT,
    )

    assert.deepEqual(result, {
        passed: true,
        failures: [],
    })
})

test("audience deterministic evaluator rejects invented authority and provenance", () => {
    const output = {
        segments: [
            {
                id: "model-invented-id",
                name: "Audience",
                buyingSituation: "Situation",
                currentNeed: "Need",
                relevantOffers: ["Invented service"],
                mainQuestions: ["Question"],
                likelyBarriers: ["Barrier"],
                decisionStage: "decisionReady",
                evidenceKeys: ["fake-evidence"],
                rationale: "Reason",
                assumptions: [],
                confidenceBand: "strong",
            },
        ],
    }

    const result = evaluateAudienceProposal(
        output,
        TOTAL_CHARM_DENT_GOLDEN_INPUT,
    )

    assert.equal(result.passed, false)
    assert.equal(
        result.failures.some((failure) =>
            failure.includes("unknown offer"),
        ),
        true,
    )
    assert.equal(
        result.failures.some((failure) =>
            failure.includes("unknown evidence"),
        ),
        true,
    )
    assert.equal(
        result.failures.some((failure) =>
            failure.includes("authority field: id"),
        ),
        true,
    )
})

test("audience without evidence must remain tentative and explicit about assumptions", () => {
    const output = {
        segments: [
            {
                name: "ჰიპოთეტური აუდიტორია",
                buyingSituation:
                    "სავარაუდო buying situation პირდაპირი evidence-ის გარეშე.",
                currentNeed: "გაიგოს შესაძლო არჩევანი.",
                relevantOffers: ["Diagnostics"],
                mainQuestions: ["რა არჩევანი არსებობს?"],
                likelyBarriers: ["uncertainty"],
                decisionStage: "problemAware",
                evidenceKeys: [],
                rationale:
                    "ეს არის category-level working hypothesis.",
                assumptions: [],
                confidenceBand: "strong",
            },
        ],
    }

    const result = evaluateAudienceProposal(
        output,
        TOTAL_CHARM_DENT_GOLDEN_INPUT,
    )

    assert.equal(result.passed, false)

    assert.equal(
        result.failures.some((failure) =>
            failure.includes("tentative confidence"),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes("state its assumptions"),
        ),
        true,
    )
})

test("communication profile evaluator accepts one profile per requested audience", () => {
    const profiles =
        TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT.audiences.map(
            (audience) => ({
                audienceKey: audience.audienceKey,

                communicationGoal:
                    "დაეხმაროს აუდიტორიას გადაწყვეტილების უკეთ გაგებაში.",

                toneAdjustments: [
                    "შეინარჩუნოს მშვიდი და პროფესიული ტონი",
                ],

                preferredFraming: [
                    "პრობლემა → ახსნა → შესაძლო შემდეგი ნაბიჯი",
                ],

                usefulContentAngles: [
                    "პროცესის გასაგებად ახსნა",
                ],

                assumedKnowledge: "basic",
                explanationDepth: "balanced",

                trustMechanisms: [
                    "პროცესის სიცხადე",
                    "პროფესიული ახსნა",
                ],

                ctaStyle: "consultative",

                avoid: [
                    "ზედმეტი დაპირებები",
                    "ზეწოლაზე დაფუძნებული მოწოდება",
                ],

                rationale:
                    "პროფილი აუდიტორიის გადაწყვეტილების სიტუაციას ერგება Brand Voice-ის შეცვლის გარეშე.",
            }),
        )

    const result =
        evaluateCommunicationProfileProposal(
            { profiles },
            TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT,
        )

    assert.deepEqual(result, {
        passed: true,
        failures: [],
    })
})

test("communication profile evaluator rejects unknown, duplicate, missing, and authority-owned audience data", () => {
    const output = {
        profiles: [
            {
                id: "model-created-id",

                audienceKey: "a1",

                communicationGoal: "Goal",
                toneAdjustments: ["Adjustment"],
                preferredFraming: ["Framing"],
                usefulContentAngles: ["Angle"],

                assumedKnowledge: "basic",
                explanationDepth: "balanced",

                trustMechanisms: ["Trust"],
                ctaStyle: "consultative",

                avoid: ["Avoid"],
                rationale: "Reason",
            },

            {
                audienceKey: "a1",

                communicationGoal: "Goal",
                toneAdjustments: ["Adjustment"],
                preferredFraming: ["Framing"],
                usefulContentAngles: ["Angle"],

                assumedKnowledge: "basic",
                explanationDepth: "balanced",

                trustMechanisms: ["Trust"],
                ctaStyle: "consultative",

                avoid: ["Avoid"],
                rationale: "Reason",
            },

            {
                audienceKey: "unknown-audience",

                communicationGoal: "Goal",
                toneAdjustments: ["Adjustment"],
                preferredFraming: ["Framing"],
                usefulContentAngles: ["Angle"],

                assumedKnowledge: "basic",
                explanationDepth: "balanced",

                trustMechanisms: ["Trust"],
                ctaStyle: "consultative",

                avoid: ["Avoid"],
                rationale: "Reason",
            },
        ],
    }

    const result =
        evaluateCommunicationProfileProposal(
            output,
            TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT,
        )

    assert.equal(result.passed, false)

    assert.equal(
        result.failures.some((failure) =>
            failure.includes("authority field: id"),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes("duplicates audienceKey: a1"),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "unknown audienceKey: unknown-audience",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "missing profile for audienceKey: a2",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "missing profile for audienceKey: a3",
            ),
        ),
        true,
    )
})
test("communication envelope evaluator accepts a valid envelope", () => {
    const output = {
        envelope: {
            complexity:
                "plainWithProfessionalDepth",

            assumedKnowledge: "none",
            explanationDepth: "balanced",

            toneRange: [
                "calm",
                "competent",
                "clear",
                "restrained",
            ],

            framingRules: [
                "Explain why before asking for action.",
                "Connect each step to the larger process.",
            ],

            preferredStructures: [
                "question → explanation → next step",
            ],

            terminologyRules: [
                "Explain professional terminology when used.",
            ],

            proofStyle: [
                "Use specific real proof only when supplied.",
            ],

            ctaStyle: "consultative",
            salesPressure: "low",

            inclusivityRules: [
                "Do not assume specialist knowledge.",
                "Provide enough context for a first-time reader.",
            ],

            trustMechanisms: [
                "process clarity",
                "professional explanation",
                "specificity",
            ],

            avoid: [
                "unsupported superiority claims",
                "guaranteed outcomes",
                "pressure-based language",
            ],

            rationale:
                "The envelope preserves the calm professional brand voice while remaining accessible across audiences with different levels of knowledge.",
        },
    }

    const result =
        evaluateCommunicationEnvelopeProposal(
            output,
            TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT,
        )

    assert.deepEqual(result, {
        passed: true,
        failures: [],
    })
})

test("communication envelope evaluator rejects authority-owned and invalid fields", () => {
    const output = {
        envelope: {
            id: "model-created-id",

            complexity: "super-technical",
            assumedKnowledge: "everyone-knows",
            explanationDepth: "maximum",

            toneRange: ["calm"],
            framingRules: ["Rule"],
            preferredStructures: ["Structure"],
            terminologyRules: ["Terminology"],
            proofStyle: ["Proof"],

            ctaStyle: "aggressive",
            salesPressure: "extreme",

            inclusivityRules: ["Rule"],
            trustMechanisms: ["Trust"],
            avoid: ["Avoid"],

            rationale: "Reason",
        },
    }

    const result =
        evaluateCommunicationEnvelopeProposal(
            output,
            TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT,
        )

    assert.equal(result.passed, false)

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "authority field: id",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "complexity is invalid",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "ctaStyle is invalid",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "salesPressure is invalid",
            ),
        ),
        true,
    )
})

test("weekly audience focus evaluator accepts a valid narrow focus", () => {
    const output = {
        focus: {
            primaryAudienceKey: "a2",
            secondaryAudienceKeys: [
                "a1",
            ],

            rationale:
                "მაღალი ნდობის გადაწყვეტილების წინაშე მყოფი აუდიტორია ყველაზე პირდაპირ უკავშირდება კვირის მიზანს, ხოლო პრობლემის მქონე მაგრამ ჯერ გაურკვეველი პაციენტები იმავე შეფასებისა და დაგეგმვის თემიდან სარგებელს მიიღებენ.",
        },
    }

    const result =
        evaluateWeeklyAudienceFocusProposal(
            output,
            TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT,
        )

    assert.deepEqual(result, {
        passed: true,
        failures: [],
    })
})

test("weekly audience focus evaluator rejects unknown, duplicated, excessive and authority-owned selections", () => {
    const output = {
        focus: {
            id: "model-created-id",

            primaryAudienceKey: "a2",

            secondaryAudienceKeys: [
                "a2",
                "unknown-audience",
            ],

            rationale: "Reason",
        },
    }

    const result =
        evaluateWeeklyAudienceFocusProposal(
            output,
            TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "authority field: id",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "at most one secondary",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "primary audience cannot also be secondary",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "unknown secondary audienceKey",
            ),
        ),
        true,
    )
})

test("content audience direction evaluator accepts valid weekly-focus assignments", () => {
    const output = {
        directions: [
            {
                contentDirectionKey: "d1",
                primaryAudienceKey: "a1",
                secondaryAudienceKeys: [],
                bias: "moreExplanatory",
            },

            {
                contentDirectionKey: "d2",
                primaryAudienceKey: "a2",
                secondaryAudienceKeys: [
                    "a1",
                ],
                bias:
                    "moreDecisionOriented",
            },

            {
                contentDirectionKey: "d3",
                primaryAudienceKey: "a2",
                secondaryAudienceKeys: [
                    "a1",
                ],
                bias:
                    "moreTrustFocused",
            },
        ],
    }

    const result =
        evaluateContentAudienceDirectionProposal(
            output,
            TOTAL_CHARM_DENT_CONTENT_AUDIENCE_DIRECTION_INPUT,
        )

    assert.deepEqual(result, {
        passed: true,
        failures: [],
    })
})

test("content audience direction evaluator rejects missing, unknown, duplicated and out-of-focus assignments", () => {
    const output = {
        directions: [
            {
                id: "model-created-id",

                contentDirectionKey: "d1",

                primaryAudienceKey: "a3",

                secondaryAudienceKeys: [
                    "a3",
                    "a1",
                ],

                bias: "maximum-conversion",
            },

            {
                contentDirectionKey: "d1",

                primaryAudienceKey: "a1",
                secondaryAudienceKeys: [],
                bias: "balanced",
            },

            {
                contentDirectionKey:
                    "unknown-direction",

                primaryAudienceKey: "a1",
                secondaryAudienceKeys: [],
                bias: "balanced",
            },
        ],
    }

    const result =
        evaluateContentAudienceDirectionProposal(
            output,
            TOTAL_CHARM_DENT_CONTENT_AUDIENCE_DIRECTION_INPUT,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "authority field: id",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "outside Weekly Audience Focus: a3",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "duplicate contentDirectionKey: d1",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "unknown contentDirectionKey",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "missing contentDirectionKey: d2",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "missing contentDirectionKey: d3",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "invalid content audience bias",
            ),
        ),
        true,
    )
})
test("weekly objective evaluator accepts a useful-progress objective", () => {
    const output = {
        weeklyObjective: {
            objective:
                "შეამციროს რთული მკურნალობის გადაწყვეტილების წინ არსებული გაურკვევლობა დიაგნოსტიკისა და დაგეგმვის როლის უფრო გასაგებად წარმოჩენით.",

            rationale:
                "მომხმარებლის ამ კვირის პრიორიტეტი პირდაპირ ეხება რთული მკურნალობის თემებს, ხოლო არსებული ბრენდული და ბიზნეს კონტექსტი საშუალებას გვაძლევს ყურადღება გადავიტანოთ პროცესის სიცხადესა და პროფესიულ დასაბუთებაზე.",

            deliberateOmissions: [
                "ზოგადი ბრენდული ისტორიები, რომლებიც არ უკავშირდება ამ კვირის გადაწყვეტილების გაურკვევლობის თემას.",
                "მიმდინარე პაციენტების მკურნალობის უწყვეტობის თემა, თუ ის პირდაპირ არ ემსახურება ამ კვირის მიზანს.",
                "პრომოციული ზეწოლა ან ხელოვნური გადაუდებლობა.",
            ],
        },
    }

    const result =
        evaluateWeeklyObjectiveProposal(
            output,
            TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT,
        )

    assert.deepEqual(result, {
        passed: true,
        failures: [],
    })
})

test("weekly objective evaluator rejects authority-owned and activity-based output", () => {
    const output = {
        weeklyObjective: {
            id: "model-created-id",

            objective:
                "Publish more posts and increase posting frequency.",

            rationale:
                "Reason",

            deliberateOmissions: [
                "Something",
            ],
        },
    }

    const result =
        evaluateWeeklyObjectiveProposal(
            output,
            TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "authority field: id",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "activity-based",
            ),
        ),
        true,
    )
})
test("content direction evaluator accepts strategic non-execution directions", () => {
    const output = {
        directions: [
            {
                direction:
                    "აჩვენოს, რას არკვევს პროფესიული შეფასება მკურნალობის არჩევამდე.",

                purpose:
                    "შეამციროს გაურკვევლობა დიაგნოსტიკისა და შეფასების როლის უკეთ გაგებით.",

                rationale:
                    "ეს პირდაპირ ემსახურება კვირის მიზანს და ეხმარება მკითხველს გადაწყვეტილების პროცესის საწყისი ეტაპის გაგებაში.",
            },

            {
                direction:
                    "ახსნას, რატომ შეიძლება არსებობდეს ერთი პრობლემის რამდენიმე შესაძლო მკურნალობის გზა.",

                purpose:
                    "გააუმჯობესოს მკურნალობის ვარიანტებისა და ინდივიდუალური რეკომენდაციის ლოგიკის გაგება.",

                rationale:
                    "რთული გადაწყვეტილების დროს არჩევანის ლოგიკის გაგება ამცირებს გაურკვევლობას და ზრდის პროფესიული პროცესის მიმართ ნდობას.",
            },

            {
                direction:
                    "აჩვენოს, როგორ ერთიანდება სხვადასხვა სპეციალისტის შეფასება ერთ საერთო მკურნალობის გეგმაში.",

                purpose:
                    "გააძლიეროს მრავალპროფილური დაგეგმვისა და კოორდინაციის მიმართ ნდობა.",

                rationale:
                    "კლინიკის მრავალპროფილური მიდგომა ამ კვირის objective-სთან პირდაპირ კავშირშია და რთული მკურნალობის დაგეგმვას უფრო გასაგებს ხდის.",
            },
        ],
    }

    const result =
        evaluateContentDirectionProposal(
            output,
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT,
        )

    assert.deepEqual(result, {
        passed: true,
        failures: [],
    })
})

test("content direction evaluator rejects execution-specific, duplicated and authority-owned output", () => {
    const output = {
        directions: [
            {
                id: "model-created-id",

                direction:
                    "Create an Instagram carousel with 5 slides about diagnostics.",

                purpose:
                    "Explain diagnostics.",

                rationale:
                    "Reason",
            },

            {
                direction:
                    "Explain treatment planning.",

                purpose:
                    "Improve understanding.",

                rationale:
                    "Reason",
            },

            {
                direction:
                    "Explain treatment planning.",

                purpose:
                    "Improve understanding.",

                rationale:
                    "Reason",
            },
        ],
    }

    const result =
        evaluateContentDirectionProposal(
            output,
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "authority or execution field: id",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "execution-specific",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "duplicate direction",
            ),
        ),
        true,
    )
})
test("experiment decision evaluator accepts a valid no-experiment decision", () => {
    const output = {
        experimentDecision: {
            decision: "noExperiment",

            rationale:
                "ამ კვირაში მთავარი გაურკვევლობა თავად მკურნალობის გადაწყვეტილების პროცესის გაგებას ეხება და არსებული კონტექსტი არ გვაძლევს საკმარის საფუძველს ცალკე ექსპერიმენტის დასამატებლად.",

            experiment: {
                hypothesis: null,
                variable: null,
                comparison: null,
                learningSignal: null,
                guardrails: [],
            },
        },
    }

    const result =
        evaluateExperimentDecisionProposal(
            output,
            TOTAL_CHARM_DENT_EXPERIMENT_DECISION_INPUT,
        )

    assert.deepEqual(result, {
        passed: true,
        failures: [],
    })
})

test("experiment decision evaluator rejects invalid authority-owned and incomplete experiment output", () => {
    const output = {
        experimentDecision: {
            id: "model-created-id",

            decision: "experiment",

            rationale:
                "Try something new.",

            experiment: {
                experimentId:
                    "model-created-experiment-id",

                hypothesis: "",

                variable:
                    "everything",

                comparison:
                    "",

                learningSignal:
                    "",

                guardrails:
                    "stay safe",
            },
        },
    }

    const result =
        evaluateExperimentDecisionProposal(
            output,
            TOTAL_CHARM_DENT_EXPERIMENT_DECISION_INPUT,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "authority field: id",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "authority field: experimentId",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "experiment.hypothesis",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "experiment.comparison",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "experiment.learningSignal",
            ),
        ),
        true,
    )

    assert.equal(
        result.failures.some((failure) =>
            failure.includes(
                "experiment.guardrails",
            ),
        ),
        true,
    )
})