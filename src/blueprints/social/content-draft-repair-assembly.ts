import type {
    IsoDateTime,
} from "../../core/domain"

import type {
    SocialContentDraft,
    SocialContentDraftId,
} from "./content-draft"

import type {
    SocialContentDraftAssemblyProposal,
} from "./content-draft-assembly"

import {
    assembleSocialContentDraft,
} from "./content-draft-assembly"

export type AssembleRepairedSocialContentDraftInput = {
    /**
     * New immutable draft identity.
     *
     * Must differ from the previous draft ID.
     */
    readonly id:
    SocialContentDraftId

    /**
     * The immutable draft being repaired.
     */
    readonly previousDraft:
    SocialContentDraft

    /**
     * New Writer-shaped copy proposal.
     *
     * It cannot change:
     * - ContentId
     * - ContentBriefId
     * - ContentExecutionSpecId
     * - format
     * - locale
     * - version
     */
    readonly proposal:
    SocialContentDraftAssemblyProposal

    readonly createdAt:
    IsoDateTime
}

function assertValidPreviousVersion(
    draft: SocialContentDraft,
): void {
    if (
        !Number.isInteger(
            draft.version,
        ) ||
        draft.version < 1
    ) {
        throw new Error(
            "Previous content draft version must be a positive integer",
        )
    }
}

export function assembleRepairedSocialContentDraft(
    input: AssembleRepairedSocialContentDraftInput,
): SocialContentDraft {
    const {
        previousDraft,
    } = input

    assertValidPreviousVersion(
        previousDraft,
    )

    if (
        input.id ===
        previousDraft.id
    ) {
        throw new Error(
            "Repaired content draft must receive a new draft ID",
        )
    }

    return assembleSocialContentDraft({
        id:
            input.id,

        contentId:
            previousDraft.contentId,

        contentBriefId:
            previousDraft.contentBriefId,

        contentExecutionSpecId:
            previousDraft.contentExecutionSpecId,

        format:
            previousDraft.format,

        version:
            previousDraft.version + 1,

        locale:
            previousDraft.locale,

        proposal:
            input.proposal,

        createdAt:
            input.createdAt,
    })
}