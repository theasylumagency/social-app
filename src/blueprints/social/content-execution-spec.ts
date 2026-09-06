import type {
    DomainId,
    IsoDateTime,
} from "../../core/domain"

import type {
    SocialChannel,
    SocialContentMode,
} from "./tokens"

import type {
    SocialContentFormat,
} from "./operations"

import type {
    ContentBriefId,
} from "./content-brief"

// -----------------------------------------------------------------------------
// IDs
// -----------------------------------------------------------------------------

export type ContentExecutionSpecId =
    DomainId<"SocialContentExecutionSpecId">

// -----------------------------------------------------------------------------
// Execution vocabulary
// -----------------------------------------------------------------------------

export type ContentExecutionDepth =
    | "compact"
    | "standard"
    | "deep"

export type ContentVisualDependency =
    | "none"
    | "supporting"
    | "essential"

// -----------------------------------------------------------------------------
// Content Execution Spec
// -----------------------------------------------------------------------------

export type ContentExecutionSpec = {
    readonly id:
    ContentExecutionSpecId

    /**
     * Every execution spec belongs to exactly one approved
     * Content Brief.
     */
    readonly contentBriefId:
    ContentBriefId

    /**
     * One execution spec represents one destination.
     *
     * Cross-channel publishing should create separate specs,
     * because execution may legitimately differ by channel.
     */
    readonly channel:
    SocialChannel

    /**
     * Canonical Social content mode.
     *
     * Examples:
     * educational
     * trustBuilder
     * serviceExplainer
     * proofLed
     */
    readonly contentMode:
    SocialContentMode

    /**
     * Canonical format supported by the selected channel.
     */
    readonly format:
    SocialContentFormat

    /**
     * How much explanatory room the Writer should use.
     *
     * This is not an exact character count.
     */
    readonly depth:
    ContentExecutionDepth

    /**
     * Whether the communication depends on visual material.
     */
    readonly visualDependency:
    ContentVisualDependency

    /**
     * Short execution-level guidance.
     *
     * Describes how the chosen format should carry the brief,
     * but must not contain final copy.
     */
    readonly executionGuidance:
    readonly string[]

    /**
     * Execution-specific constraints.
     *
     * Example:
     * - carousel must remain understandable frame by frame
     * - reel must not depend on audio alone
     *
     * These supplement, not replace, Content Brief constraints.
     */
    readonly constraints:
    readonly string[]

    /**
     * Why this channel / mode / format combination is appropriate
     * for this particular brief.
     */
    readonly rationale:
    string

    readonly createdAt:
    IsoDateTime
}