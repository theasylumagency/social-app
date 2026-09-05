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