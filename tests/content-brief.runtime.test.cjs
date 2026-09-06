const assert = require("node:assert/strict")
const test = require("node:test")

const {
    assembleContentBrief,
} = require("../dist/blueprints/social/index.js")

function createValidInput() {
    return {
        id: "content-brief-1",

        weeklyPlanId:
            "weekly-plan-1",

        weeklyContentDirectionId:
            "direction-1",

        audienceDirection: {
            primaryAudience: {
                source: "operator",
                id: "audience-1",
            },

            secondaryAudiences: [
                {
                    source: "operator",
                    id: "audience-2",
                },
            ],

            bias:
                "moreExplanatory",
        },

        proposal: {
            communicationJob:
                "Explain what diagnostics should clarify before a complex treatment decision.",

            keyTakeaway:
                "Diagnostics should clarify the decision before an individual recommendation is made.",

            supportingPoints: [
                "Clarify the clinical problem.",
                "Clarify the available treatment paths.",
                "Keep individual recommendation dependent on assessment.",
            ],

            evidenceMode:
                "noProofNeeded",

            evidenceKeys: [],

            ctaIntent:
                "encourageReflection",

            constraints: [
                "Explain technical terms.",
                "Keep general guidance separate from individual diagnosis.",
            ],

            mustNotSay: [
                "Diagnostics guarantees the outcome.",
            ],

            rationale:
                "This narrows the approved weekly direction into one executable communication job.",
        },

        evidenceReferences: [],

        createdAt:
            "2026-09-06T22:00:00+04:00",
    }
}

test("content brief assembly creates a canonical brief", () => {
    const brief =
        assembleContentBrief(
            createValidInput(),
        )

    assert.equal(
        brief.id,
        "content-brief-1",
    )

    assert.equal(
        brief.weeklyPlanId,
        "weekly-plan-1",
    )

    assert.equal(
        brief.weeklyContentDirectionId,
        "direction-1",
    )

    assert.equal(
        brief.evidenceMode,
        "noProofNeeded",
    )

    assert.deepEqual(
        brief.evidenceIds,
        [],
    )

    assert.equal(
        brief.audienceDirection.bias,
        "moreExplanatory",
    )

    assert.equal(
        "evidenceKeys" in brief,
        false,
    )
})

test("content brief assembly resolves evidence keys to canonical EvidenceIds", () => {
    const input =
        createValidInput()

    input.proposal = {
        ...input.proposal,

        evidenceMode:
            "evidenceSupported",

        evidenceKeys: [
            "ev-diagnostics",
        ],
    }

    input.evidenceReferences = [
        {
            evidenceKey:
                "ev-diagnostics",

            evidenceId:
                "evidence-123",
        },
    ]

    const brief =
        assembleContentBrief(
            input,
        )

    assert.deepEqual(
        brief.evidenceIds,
        [
            "evidence-123",
        ],
    )

    assert.equal(
        "evidenceKeys" in brief,
        false,
    )
})

test("content brief assembly rejects unknown evidence keys", () => {
    const input =
        createValidInput()

    input.proposal = {
        ...input.proposal,

        evidenceMode:
            "evidenceSupported",

        evidenceKeys: [
            "unknown-evidence",
        ],
    }

    assert.throws(
        () =>
            assembleContentBrief(input),

        /Unknown Content Brief evidence key/,
    )
})

test("content brief assembly enforces evidence-mode consistency", () => {
    const noProofInput =
        createValidInput()

    noProofInput.proposal = {
        ...noProofInput.proposal,

        evidenceMode:
            "noProofNeeded",

        evidenceKeys: [
            "ev-1",
        ],
    }

    noProofInput.evidenceReferences = [
        {
            evidenceKey:
                "ev-1",

            evidenceId:
                "evidence-1",
        },
    ]

    assert.throws(
        () =>
            assembleContentBrief(
                noProofInput,
            ),

        /noProofNeeded must not contain evidence/,
    )

    const proofInput =
        createValidInput()

    proofInput.proposal = {
        ...proofInput.proposal,

        evidenceMode:
            "proofRequired",

        evidenceKeys: [],
    }

    assert.throws(
        () =>
            assembleContentBrief(
                proofInput,
            ),

        /proofRequired ContentBrief must contain evidence/,
    )
})

test("content brief assembly rejects duplicate evidence references and duplicate selected keys", () => {
    const duplicateReferenceInput =
        createValidInput()

    duplicateReferenceInput.proposal = {
        ...duplicateReferenceInput.proposal,

        evidenceMode:
            "evidenceSupported",

        evidenceKeys: [
            "ev-1",
        ],
    }

    duplicateReferenceInput.evidenceReferences = [
        {
            evidenceKey:
                "ev-1",

            evidenceId:
                "evidence-1",
        },

        {
            evidenceKey:
                "ev-1",

            evidenceId:
                "evidence-2",
        },
    ]

    assert.throws(
        () =>
            assembleContentBrief(
                duplicateReferenceInput,
            ),

        /Duplicate evidence reference key/,
    )

    const duplicateSelectionInput =
        createValidInput()

    duplicateSelectionInput.proposal = {
        ...duplicateSelectionInput.proposal,

        evidenceMode:
            "evidenceSupported",

        evidenceKeys: [
            "ev-1",
            "ev-1",
        ],
    }

    duplicateSelectionInput.evidenceReferences = [
        {
            evidenceKey:
                "ev-1",

            evidenceId:
                "evidence-1",
        },
    ]

    assert.throws(
        () =>
            assembleContentBrief(
                duplicateSelectionInput,
            ),

        /Duplicate evidence key selected by Content Brief/,
    )
})