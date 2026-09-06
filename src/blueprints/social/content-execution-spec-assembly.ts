import type {
    IsoDateTime,
} from "../../core/domain"

import {
    SOCIAL_CHANNEL_POLICIES,
} from "./operations"

import type {
    SocialContentFormat,
} from "./operations"

import type {
    SocialChannel,
    SocialContentMode,
} from "./tokens"

import type {
    ContentBriefId,
} from "./content-brief"

import type {
    ContentExecutionDepth,
    ContentExecutionSpec,
    ContentExecutionSpecId,
    ContentVisualDependency,
} from "./content-execution-spec"

// -----------------------------------------------------------------------------
// Model-owned semantic proposal
// -----------------------------------------------------------------------------

export type ContentExecutionSpecAssemblyProposal = {
    readonly channel:
    SocialChannel

    readonly contentMode:
    SocialContentMode

    readonly format:
    SocialContentFormat

    readonly depth:
    ContentExecutionDepth

    readonly visualDependency:
    ContentVisualDependency

    readonly executionGuidance:
    readonly string[]

    readonly constraints:
    readonly string[]

    readonly rationale:
    string
}

// -----------------------------------------------------------------------------
// Canonical identity + proposal
// -----------------------------------------------------------------------------

export type ContentExecutionSpecAssemblyItem = {
    /**
     * Persistent identity assigned by the application.
     */
    readonly id:
    ContentExecutionSpecId

    readonly proposal:
    ContentExecutionSpecAssemblyProposal
}

// -----------------------------------------------------------------------------
// Assembly input
// -----------------------------------------------------------------------------

export type AssembleContentExecutionSpecsInput = {
    readonly contentBriefId:
    ContentBriefId

    /**
     * Destinations currently eligible for this generation step.
     *
     * Eligibility is application-owned and may reflect account state,
     * product configuration, user choice, or other deterministic rules.
     */
    readonly eligibleChannels:
    readonly SocialChannel[]

    /**
     * Modes already pre-qualified by the application for this brief.
     *
     * Capability checks such as eligibleProof / publicOfferFacts belong
     * upstream when this list is produced.
     */
    readonly eligibleContentModes:
    readonly SocialContentMode[]

    readonly specs:
    readonly ContentExecutionSpecAssemblyItem[]

    readonly createdAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------------
const VALID_EXECUTION_DEPTHS =
    new Set<ContentExecutionDepth>([
        "compact",
        "standard",
        "deep",
    ])

const VALID_VISUAL_DEPENDENCIES =
    new Set<ContentVisualDependency>([
        "none",
        "supporting",
        "essential",
    ])

function assertValidExecutionDepth(
    depth: ContentExecutionDepth,
): void {
    if (
        !VALID_EXECUTION_DEPTHS.has(depth)
    ) {
        throw new Error(
            `Invalid Content Execution depth: ${depth}`,
        )
    }
}

function assertValidVisualDependency(
    dependency: ContentVisualDependency,
): void {
    if (
        !VALID_VISUAL_DEPENDENCIES.has(
            dependency,
        )
    ) {
        throw new Error(
            `Invalid Content Execution visual dependency: ${dependency}`,
        )
    }
}
function assertNonEmptyString(
    value: string,
    field: string,
): void {
    if (value.trim().length === 0) {
        throw new Error(
            `${field} must be a non-empty string`,
        )
    }
}

function assertStringArray(
    values: readonly string[],
    field: string,
): void {
    for (const value of values) {
        assertNonEmptyString(
            value,
            field,
        )
    }
}

function assertUniqueEligibleChannels(
    channels: readonly SocialChannel[],
): void {
    const seen =
        new Set<SocialChannel>()

    for (const channel of channels) {
        if (seen.has(channel)) {
            throw new Error(
                `Duplicate eligible channel: ${channel}`,
            )
        }

        seen.add(channel)
    }
}

function assertUniqueEligibleModes(
    modes: readonly SocialContentMode[],
): void {
    const seen =
        new Set<SocialContentMode>()

    for (const mode of modes) {
        if (seen.has(mode)) {
            throw new Error(
                `Duplicate eligible content mode: ${mode}`,
            )
        }

        seen.add(mode)
    }
}

// -----------------------------------------------------------------------------
// Assembly
// -----------------------------------------------------------------------------

export function assembleContentExecutionSpecs(
    input: AssembleContentExecutionSpecsInput,
): readonly ContentExecutionSpec[] {
    if (input.specs.length === 0) {
        throw new Error(
            "At least one Content Execution Spec is required",
        )
    }

    if (input.eligibleChannels.length === 0) {
        throw new Error(
            "At least one eligible execution channel is required",
        )
    }

    if (
        input.eligibleContentModes.length === 0
    ) {
        throw new Error(
            "At least one eligible content mode is required",
        )
    }

    assertUniqueEligibleChannels(
        input.eligibleChannels,
    )

    assertUniqueEligibleModes(
        input.eligibleContentModes,
    )

    const seenIds =
        new Set<ContentExecutionSpecId>()

    const seenChannels =
        new Set<SocialChannel>()

    const assembled:
        ContentExecutionSpec[] = []

    for (const item of input.specs) {
        const proposal =
            item.proposal

        if (seenIds.has(item.id)) {
            throw new Error(
                `Duplicate ContentExecutionSpecId: ${item.id}`,
            )
        }

        seenIds.add(item.id)

        if (
            seenChannels.has(
                proposal.channel,
            )
        ) {
            throw new Error(
                `Duplicate execution channel: ${proposal.channel}`,
            )
        }

        seenChannels.add(
            proposal.channel,
        )

        const channelEligible =
            input.eligibleChannels.some(
                (channel) =>
                    channel ===
                    proposal.channel,
            )

        if (!channelEligible) {
            throw new Error(
                `Execution channel is not eligible: ${proposal.channel}`,
            )
        }

        const modeEligible =
            input.eligibleContentModes.some(
                (mode) =>
                    mode ===
                    proposal.contentMode,
            )

        if (!modeEligible) {
            throw new Error(
                `Content mode is not eligible: ${proposal.contentMode}`,
            )
        }

        const channelPolicy =
            SOCIAL_CHANNEL_POLICIES.find(
                (policy) =>
                    policy.channel ===
                    proposal.channel,
            )

        if (!channelPolicy) {
            throw new Error(
                `No channel policy found for: ${proposal.channel}`,
            )
        }

        const formatSupported =
            channelPolicy.supportedFormats.some(
                (format) =>
                    format ===
                    proposal.format,
            )

        if (!formatSupported) {
            throw new Error(
                `Format ${proposal.format} is not supported by channel ${proposal.channel}`,
            )
        }

        const modeSupported =
            channelPolicy.supportedModes.some(
                (mode) =>
                    mode ===
                    proposal.contentMode,
            )

        if (!modeSupported) {
            throw new Error(
                `Content mode ${proposal.contentMode} is not supported by channel ${proposal.channel}`,
            )
        }
        assertValidExecutionDepth(
            proposal.depth,
        )

        assertValidVisualDependency(
            proposal.visualDependency,
        )
        if (
            proposal.executionGuidance.length ===
            0
        ) {
            throw new Error(
                "Content Execution Spec must contain execution guidance",
            )
        }

        assertStringArray(
            proposal.executionGuidance,
            "executionGuidance",
        )

        assertStringArray(
            proposal.constraints,
            "constraints",
        )

        assertNonEmptyString(
            proposal.rationale,
            "rationale",
        )

        assembled.push({
            id:
                item.id,

            contentBriefId:
                input.contentBriefId,

            channel:
                proposal.channel,

            contentMode:
                proposal.contentMode,

            format:
                proposal.format,

            depth:
                proposal.depth,

            visualDependency:
                proposal.visualDependency,

            executionGuidance:
                proposal.executionGuidance,

            constraints:
                proposal.constraints,

            rationale:
                proposal.rationale,

            createdAt:
                input.createdAt,
        })
    }

    return assembled
}