const assert = require("node:assert/strict")
const test = require("node:test")

const {
    TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
} = require(
    "./total-charm-dent.content-repair.fixture.cjs",
)

const {
    evaluateContentRepairProposal,
} = require(
    "./content-repair-deterministic-evaluator.cjs",
)

function createValidRepairOutput() {
    const previous =
        TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT
            .previousDraft

    return {
        draft: {
            text:
                null,

            caption:
                previous.caption,

            frames:
                previous.frames.map(
                    (frame) => ({
                        heading:
                            frame.heading ?? null,

                        body:
                            frame.body,
                    }),
                ),

            script:
                null,

            onScreenText: [],
        },
    }
}

test("content repair deterministic evaluator accepts a structurally valid local repair", () => {
    const output =
        createValidRepairOutput()

    /**
     * Repair only the intentionally defective frame.
     */
    output.draft.frames[2] = {
        heading:
            "2. რა ცვლის ან ზღუდავს არჩევანს?",

        body:
            "ინდივიდუალურმა კლინიკურმა ფაქტორებმა შეიძლება შეცვალოს, რომელი მკურნალობის ვარიანტები შეიძლება განიხილებოდეს და რა შეზღუდვები ჰქონდეს თითოეულ მათგანს. ამის გარკვევა შეფასებისა და დიაგნოსტიკის ნაწილია.",
    }

    const result =
        evaluateContentRepairProposal(
            output,
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    assert.deepEqual(
        result,
        {
            passed:
                true,

            failures: [],
        },
    )
})

test("content repair deterministic evaluator rejects changed frame count when structure must be preserved", () => {
    const output =
        createValidRepairOutput()

    output.draft.frames =
        output.draft.frames.slice(
            0,
            -1,
        )

    const result =
        evaluateContentRepairProposal(
            output,
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "repair must preserve frame count when structure preservation is required",
        ),
        true,
    )
})

test("content repair deterministic evaluator rejects application authority leakage", () => {
    const output =
        createValidRepairOutput()

    output.draft.version =
        2

    const result =
        evaluateContentRepairProposal(
            output,
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "draft contains authority field: version",
        ),
        true,
    )
})

test("content repair deterministic evaluator rejects frame authority leakage", () => {
    const output =
        createValidRepairOutput()

    output.draft.frames[0].order =
        1

    const result =
        evaluateContentRepairProposal(
            output,
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "draft frame contains authority field: order",
        ),
        true,
    )
})

test("content repair deterministic evaluator rejects wrong transport branch", () => {
    const output =
        createValidRepairOutput()

    output.draft.text =
        "This should not exist for a carousel."

    const result =
        evaluateContentRepairProposal(
            output,
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "carousel text must be null",
        ),
        true,
    )
})

test("content repair deterministic evaluator rejects previous draft with different execution format", () => {
    const input =
        structuredClone(
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    input.previousDraft.format =
        "reel"

    const result =
        evaluateContentRepairProposal(
            createValidRepairOutput(),
            input,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "previousDraft format must match Content Execution Spec format",
        ),
        true,
    )
})

test("content repair deterministic evaluator rejects invalid previous draft version", () => {
    const input =
        structuredClone(
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    input.previousDraft.version =
        0

    const result =
        evaluateContentRepairProposal(
            createValidRepairOutput(),
            input,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "previousDraft version must be a positive integer",
        ),
        true,
    )
})

test("content repair deterministic evaluator rejects empty repair instructions", () => {
    const input =
        structuredClone(
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    input.repairBrief.instructions =
        []

    const result =
        evaluateContentRepairProposal(
            createValidRepairOutput(),
            input,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "repairBrief.instructions must contain at least one instruction",
        ),
        true,
    )
})

test("content repair deterministic evaluator rejects unsupported repair instruction source", () => {
    const input =
        structuredClone(
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    input.repairBrief.instructions = [
        {
            source:
                "strategy",

            instruction:
                "Change the weekly objective.",
        },
    ]

    const result =
        evaluateContentRepairProposal(
            createValidRepairOutput(),
            input,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "unsupported repair instruction source: strategy",
        ),
        true,
    )
})

test("content repair deterministic evaluator rejects unsupported preservation requirement", () => {
    const input =
        structuredClone(
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    input.repairBrief.preserve.push(
        "weeklyStrategy",
    )

    const result =
        evaluateContentRepairProposal(
            createValidRepairOutput(),
            input,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "unsupported preservation requirement: weeklyStrategy",
        ),
        true,
    )
})

test("content repair deterministic evaluator rejects duplicate preservation requirements", () => {
    const input =
        structuredClone(
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    input.repairBrief.preserve.push(
        "tone",
    )

    const result =
        evaluateContentRepairProposal(
            createValidRepairOutput(),
            input,
        )

    assert.equal(
        result.passed,
        false,
    )

    assert.equal(
        result.failures.includes(
            "duplicate preservation requirement: tone",
        ),
        true,
    )
})

test("content repair deterministic evaluator allows frame-count change when structure is not preserved", () => {
    const input =
        structuredClone(
            TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
        )

    input.repairBrief.preserve =
        input.repairBrief.preserve.filter(
            (requirement) =>
                requirement !==
                "structure",
        )

    const output =
        createValidRepairOutput()

    output.draft.frames =
        output.draft.frames.slice(
            0,
            -1,
        )

    const result =
        evaluateContentRepairProposal(
            output,
            input,
        )

    /**
     * The deterministic contract permits this.
     *
     * Whether removing a frame was actually justified
     * is a semantic-review question.
     */
    assert.deepEqual(
        result,
        {
            passed:
                true,

            failures: [],
        },
    )
})