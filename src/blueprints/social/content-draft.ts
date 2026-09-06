import type {
    ClaimContextLocale,
    ContentId,
    DomainId,
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

// -----------------------------------------------------------------------------
// IDs
// -----------------------------------------------------------------------------

export type SocialContentDraftId =
    DomainId<"SocialContentDraftId">

// -----------------------------------------------------------------------------
// Shared structure
// -----------------------------------------------------------------------------

export type SocialDraftFrame = {
    readonly order:
    number

    /**
     * Optional short framing text.
     *
     * This is final copy when present,
     * not execution guidance.
     */
    readonly heading?:
    string

    readonly body:
    string
}

export type SocialContentDraftBase = {
    /**
     * Immutable draft snapshot identity.
     */
    readonly id:
    SocialContentDraftId

    /**
     * Stable identity of the content item across draft revisions.
     */
    readonly contentId:
    ContentId

    /**
     * Strategic provenance.
     */
    readonly contentBriefId:
    ContentBriefId

    /**
     * Execution provenance.
     */
    readonly contentExecutionSpecId:
    ContentExecutionSpecId

    /**
     * Draft revisions increment version.
     *
     * Repair should create a new draft version,
     * not mutate an already evaluated draft.
     */
    readonly version:
    number

    /**
     * Explicit output language / locale.
     */
    readonly locale:
    ClaimContextLocale

    readonly createdAt:
    IsoDateTime
}

// -----------------------------------------------------------------------------
// Static post
// -----------------------------------------------------------------------------

export type SocialStaticPostDraft =
    SocialContentDraftBase & {
        readonly format:
        Extract<
            SocialContentFormat,
            "staticPost"
        >

        /**
         * Final publishable post text.
         */
        readonly text:
        string
    }

// -----------------------------------------------------------------------------
// Carousel
// -----------------------------------------------------------------------------

export type SocialCarouselDraft =
    SocialContentDraftBase & {
        readonly format:
        Extract<
            SocialContentFormat,
            "carousel"
        >

        /**
         * Optional destination caption.
         */
        readonly caption?:
        string

        /**
         * Final slide copy in presentation order.
         */
        readonly frames:
        readonly SocialDraftFrame[]
    }

// -----------------------------------------------------------------------------
// Story
// -----------------------------------------------------------------------------

export type SocialStoryDraft =
    SocialContentDraftBase & {
        readonly format:
        Extract<
            SocialContentFormat,
            "story"
        >

        /**
         * Final story-frame copy.
         */
        readonly frames:
        readonly SocialDraftFrame[]
    }

// -----------------------------------------------------------------------------
// Reel
// -----------------------------------------------------------------------------

export type SocialReelDraft =
    SocialContentDraftBase & {
        readonly format:
        Extract<
            SocialContentFormat,
            "reel"
        >

        /**
         * Optional destination caption.
         */
        readonly caption?:
        string

        /**
         * Final spoken / narration script.
         */
        readonly script:
        string

        /**
         * Final short text intended to appear on screen.
         *
         * This remains copy only.
         * Visual design / shot planning belongs elsewhere.
         */
        readonly onScreenText:
        readonly string[]
    }

// -----------------------------------------------------------------------------
// Canonical Social Writer output
// -----------------------------------------------------------------------------

export type SocialContentDraft =
    | SocialStaticPostDraft
    | SocialCarouselDraft
    | SocialStoryDraft
    | SocialReelDraft