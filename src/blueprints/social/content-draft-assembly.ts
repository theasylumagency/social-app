import type {
    ClaimContextLocale,
    ContentId,
    IsoDateTime,
} from "../../core/domain"

import type {
    SocialContentFormat,
} from "./operations"

import type {
    ContentBriefId,
} from "./content-brief"

import type {
    ContentExecutionSpecId,
} from "./content-execution-spec"

import type {
    SocialContentDraft,
    SocialContentDraftId,
    SocialDraftFrame,
} from "./content-draft"

// -----------------------------------------------------------------------------
// Model-boundary proposal
//
// Intentionally duplicated structurally from the eval transport contract.
//
// Production code must never import from evals/.
// -----------------------------------------------------------------------------

export type SocialContentDraftAssemblyFrameProposal = {
    readonly heading:
    string | null

    readonly body:
    string
}

export type SocialContentDraftAssemblyProposal = {
    readonly text:
    string | null

    readonly caption:
    string | null

    readonly frames:
    readonly SocialContentDraftAssemblyFrameProposal[]

    readonly script:
    string | null

    readonly onScreenText:
    readonly string[]
}

// -----------------------------------------------------------------------------
// Assembly input
// -----------------------------------------------------------------------------

export type AssembleSocialContentDraftInput = {
    readonly id:
    SocialContentDraftId

    readonly contentId:
    ContentId

    readonly contentBriefId:
    ContentBriefId

    readonly contentExecutionSpecId:
    ContentExecutionSpecId

    /**
     * Authoritative format from the canonical
     * Content Execution Spec.
     *
     * The Writer does not choose this.
     */
    readonly format:
    SocialContentFormat

    readonly version:
    number

    readonly locale:
    ClaimContextLocale

    readonly proposal:
    SocialContentDraftAssemblyProposal

    readonly createdAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Runtime validation
// -----------------------------------------------------------------------------

const PROPOSAL_FIELDS =
    new Set([
        "text",
        "caption",
        "frames",
        "script",
        "onScreenText",
    ])

const FRAME_FIELDS =
    new Set([
        "heading",
        "body",
    ])

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    )
}

function assertExactFields(
    value: unknown,
    allowedFields: ReadonlySet<string>,
    label: string,
): asserts value is Record<string, unknown> {
    if (!isRecord(value)) {
        throw new Error(
            `${label} must be an object`,
        )
    }

    for (const key of Object.keys(value)) {
        if (!allowedFields.has(key)) {
            throw new Error(
                `${label} contains unsupported field: ${key}`,
            )
        }
    }
}

function assertNonEmptyString(
    value: unknown,
    label: string,
): asserts value is string {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        throw new Error(
            `${label} must be a non-empty string`,
        )
    }
}

function assertNullableNonEmptyString(
    value: unknown,
    label: string,
): asserts value is string | null {
    if (value === null) {
        return
    }

    assertNonEmptyString(
        value,
        label,
    )
}

function assertStringArray(
    value: unknown,
    label: string,
): asserts value is readonly string[] {
    if (!Array.isArray(value)) {
        throw new Error(
            `${label} must be an array`,
        )
    }

    for (const item of value) {
        assertNonEmptyString(
            item,
            `${label} item`,
        )
    }
}

function assertValidVersion(
    version: number,
): void {
    if (
        !Number.isInteger(version) ||
        version < 1
    ) {
        throw new Error(
            "Content draft version must be a positive integer",
        )
    }
}

function validateProposalShape(
    proposal: SocialContentDraftAssemblyProposal,
): void {
    assertExactFields(
        proposal,
        PROPOSAL_FIELDS,
        "Content draft proposal",
    )

    assertNullableNonEmptyString(
        proposal.text,
        "Content draft text",
    )

    assertNullableNonEmptyString(
        proposal.caption,
        "Content draft caption",
    )

    assertNullableNonEmptyString(
        proposal.script,
        "Content draft script",
    )

    assertStringArray(
        proposal.onScreenText,
        "Content draft onScreenText",
    )

    if (!Array.isArray(proposal.frames)) {
        throw new Error(
            "Content draft frames must be an array",
        )
    }

    for (const frame of proposal.frames) {
        assertExactFields(
            frame,
            FRAME_FIELDS,
            "Content draft frame",
        )

        assertNullableNonEmptyString(
            frame.heading,
            "Content draft frame heading",
        )

        assertNonEmptyString(
            frame.body,
            "Content draft frame body",
        )
    }
}

// -----------------------------------------------------------------------------
// Canonical mapping
// -----------------------------------------------------------------------------

function assembleFrames(
    frames:
        readonly SocialContentDraftAssemblyFrameProposal[],
): readonly SocialDraftFrame[] {
    return frames.map(
        (
            frame,
            index,
        ): SocialDraftFrame => ({
            order:
                index + 1,

            ...(frame.heading === null
                ? {}
                : {
                    heading:
                        frame.heading.trim(),
                }),

            body:
                frame.body.trim(),
        }),
    )
}

function optionalTrimmedString(
    value: string | null,
): string | undefined {
    return value === null
        ? undefined
        : value.trim()
}

// -----------------------------------------------------------------------------
// Assembly
// -----------------------------------------------------------------------------

export function assembleSocialContentDraft(
    input: AssembleSocialContentDraftInput,
): SocialContentDraft {
    assertValidVersion(
        input.version,
    )

    assertNonEmptyString(
        input.locale,
        "Content draft locale",
    )

    validateProposalShape(
        input.proposal,
    )

    const {
        proposal,
    } = input

    switch (input.format) {
        case "staticPost": {
            if (proposal.text === null) {
                throw new Error(
                    "staticPost requires non-empty text",
                )
            }

            if (proposal.caption !== null) {
                throw new Error(
                    "staticPost caption must be null",
                )
            }

            if (proposal.frames.length !== 0) {
                throw new Error(
                    "staticPost frames must be empty",
                )
            }

            if (proposal.script !== null) {
                throw new Error(
                    "staticPost script must be null",
                )
            }

            if (
                proposal.onScreenText.length !== 0
            ) {
                throw new Error(
                    "staticPost onScreenText must be empty",
                )
            }

            return {
                id:
                    input.id,

                contentId:
                    input.contentId,

                contentBriefId:
                    input.contentBriefId,

                contentExecutionSpecId:
                    input.contentExecutionSpecId,

                version:
                    input.version,

                locale:
                    input.locale,

                format:
                    "staticPost",

                text:
                    proposal.text.trim(),

                createdAt:
                    input.createdAt,
            }
        }

        case "carousel": {
            if (proposal.text !== null) {
                throw new Error(
                    "carousel text must be null",
                )
            }

            if (proposal.frames.length < 2) {
                throw new Error(
                    "carousel requires at least two frames",
                )
            }

            if (proposal.script !== null) {
                throw new Error(
                    "carousel script must be null",
                )
            }

            if (
                proposal.onScreenText.length !== 0
            ) {
                throw new Error(
                    "carousel onScreenText must be empty",
                )
            }

            const caption =
                optionalTrimmedString(
                    proposal.caption,
                )

            return {
                id:
                    input.id,

                contentId:
                    input.contentId,

                contentBriefId:
                    input.contentBriefId,

                contentExecutionSpecId:
                    input.contentExecutionSpecId,

                version:
                    input.version,

                locale:
                    input.locale,

                format:
                    "carousel",

                ...(caption === undefined
                    ? {}
                    : {
                        caption,
                    }),

                frames:
                    assembleFrames(
                        proposal.frames,
                    ),

                createdAt:
                    input.createdAt,
            }
        }

        case "story": {
            if (proposal.text !== null) {
                throw new Error(
                    "story text must be null",
                )
            }

            if (proposal.caption !== null) {
                throw new Error(
                    "story caption must be null",
                )
            }

            if (proposal.frames.length < 1) {
                throw new Error(
                    "story requires at least one frame",
                )
            }

            if (proposal.script !== null) {
                throw new Error(
                    "story script must be null",
                )
            }

            if (
                proposal.onScreenText.length !== 0
            ) {
                throw new Error(
                    "story onScreenText must be empty",
                )
            }

            return {
                id:
                    input.id,

                contentId:
                    input.contentId,

                contentBriefId:
                    input.contentBriefId,

                contentExecutionSpecId:
                    input.contentExecutionSpecId,

                version:
                    input.version,

                locale:
                    input.locale,

                format:
                    "story",

                frames:
                    assembleFrames(
                        proposal.frames,
                    ),

                createdAt:
                    input.createdAt,
            }
        }

        case "reel": {
            if (proposal.text !== null) {
                throw new Error(
                    "reel text must be null",
                )
            }

            if (proposal.frames.length !== 0) {
                throw new Error(
                    "reel frames must be empty",
                )
            }

            if (proposal.script === null) {
                throw new Error(
                    "reel requires non-empty script",
                )
            }

            const caption =
                optionalTrimmedString(
                    proposal.caption,
                )

            return {
                id:
                    input.id,

                contentId:
                    input.contentId,

                contentBriefId:
                    input.contentBriefId,

                contentExecutionSpecId:
                    input.contentExecutionSpecId,

                version:
                    input.version,

                locale:
                    input.locale,

                format:
                    "reel",

                ...(caption === undefined
                    ? {}
                    : {
                        caption,
                    }),

                script:
                    proposal.script.trim(),

                onScreenText:
                    proposal.onScreenText.map(
                        (text) =>
                            text.trim(),
                    ),

                createdAt:
                    input.createdAt,
            }
        }
    }
}