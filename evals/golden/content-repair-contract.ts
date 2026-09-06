import type {
    ConsolidatedRepairBrief,
    WriterContext,
} from "../../src/core/domain"

import type {
    ContentBrief,
} from "../../src/blueprints/social/content-brief"

import type {
    ContentExecutionSpec,
} from "../../src/blueprints/social/content-execution-spec"

import type {
    SocialContentDraft,
} from "../../src/blueprints/social/content-draft"

import type {
    CommunicationEnvelope,
} from "../../src/blueprints/social/audience"

import type {
    SocialWriterDraftProposal,
} from "./content-writer-contract"

// -----------------------------------------------------------------------------
// Repair Writer model contract
//
// Repair is NOT fresh generation.
//
// The model receives:
// - the immutable previous draft,
// - the exact consolidated repair brief,
// - the original approved communication authority,
// - the same bounded Writer Context used for supported specificity.
//
// The model owns revised copy only.
// -----------------------------------------------------------------------------

export type SocialContentRepairInput = {
    /**
     * Immutable draft snapshot being repaired.
     *
     * The Repair Writer edits this semantically,
     * but never mutates its application-owned identity.
     */
    readonly previousDraft:
    SocialContentDraft

    /**
     * Authoritative delta.
     *
     * Repair only what these instructions require.
     * Preservation requirements constrain everything else.
     */
    readonly repairBrief:
    ConsolidatedRepairBrief

    /**
     * Original approved communication authority.
     *
     * Repair must not rewrite strategy.
     */
    readonly contentBrief:
    ContentBrief

    /**
     * Original approved execution authority.
     *
     * Channel / mode / format / depth remain fixed.
     */
    readonly contentExecutionSpec:
    ContentExecutionSpec

    /**
     * Original Communication Envelope remains authoritative.
     */
    readonly communicationEnvelope:
    CommunicationEnvelope

    /**
     * Same bounded generation context available to the Writer.
     *
     * Public facts may support public specificity.
     * Internal guidance remains non-public.
     */
    readonly writerContext:
    WriterContext
}

export type SocialContentRepairModelOutput = {
    /**
     * Same copy-only transport used by the original Writer.
     *
     * The model still does NOT own:
     * - ID
     * - ContentId
     * - ContentBriefId
     * - ContentExecutionSpecId
     * - format
     * - locale
     * - version
     * - frame order
     * - createdAt
     */
    readonly draft:
    SocialWriterDraftProposal
}