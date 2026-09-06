import type {
    SocialContentDraft,
    SocialDraftFrame,
} from "./content-draft"

// -----------------------------------------------------------------------------
// Projection segments
// -----------------------------------------------------------------------------

export type SocialContentDraftTextSegment =
    | {
        readonly kind:
        "staticText"

        readonly text:
        string
    }
    | {
        readonly kind:
        "caption"

        readonly text:
        string
    }
    | {
        readonly kind:
        "frameHeading"

        readonly frameOrder:
        number

        readonly text:
        string
    }
    | {
        readonly kind:
        "frameBody"

        readonly frameOrder:
        number

        readonly text:
        string
    }
    | {
        readonly kind:
        "script"

        readonly text:
        string
    }
    | {
        readonly kind:
        "onScreenText"

        readonly itemOrder:
        number

        readonly text:
        string
    }

export type SocialContentDraftTextProjection = {
    /**
     * Plain public copy suitable for the core Claim Scanner /
     * Generation Validator.
     *
     * No internal labels or metadata are injected into this text.
     */
    readonly text:
    string

    /**
     * Structural provenance retained for later review / repair mapping.
     */
    readonly segments:
    readonly SocialContentDraftTextSegment[]
}

// -----------------------------------------------------------------------------
// Canonical frame validation
// -----------------------------------------------------------------------------

function assertCanonicalFrames(
    frames: readonly SocialDraftFrame[],
): void {
    frames.forEach(
        (
            frame,
            index,
        ) => {
            const expectedOrder =
                index + 1

            if (
                frame.order !==
                expectedOrder
            ) {
                throw new Error(
                    `Content draft frames must have contiguous canonical order; expected ${expectedOrder}, received ${frame.order}`,
                )
            }

            if (
                frame.heading !== undefined &&
                frame.heading.trim().length === 0
            ) {
                throw new Error(
                    `Content draft frame ${frame.order} heading must not be blank`,
                )
            }

            if (
                frame.body.trim().length === 0
            ) {
                throw new Error(
                    `Content draft frame ${frame.order} body must not be blank`,
                )
            }
        },
    )
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function pushCaption(
    segments:
        SocialContentDraftTextSegment[],
    caption:
        string | undefined,
): void {
    if (caption === undefined) {
        return
    }

    const text =
        caption.trim()

    if (text.length === 0) {
        throw new Error(
            "Content draft caption must not be blank",
        )
    }

    segments.push({
        kind:
            "caption",

        text,
    })
}

function pushFrames(
    segments:
        SocialContentDraftTextSegment[],
    frames:
        readonly SocialDraftFrame[],
): void {
    assertCanonicalFrames(
        frames,
    )

    for (const frame of frames) {
        if (
            frame.heading !==
            undefined
        ) {
            segments.push({
                kind:
                    "frameHeading",

                frameOrder:
                    frame.order,

                text:
                    frame.heading.trim(),
            })
        }

        segments.push({
            kind:
                "frameBody",

            frameOrder:
                frame.order,

            text:
                frame.body.trim(),
        })
    }
}

function joinSegments(
    segments:
        readonly SocialContentDraftTextSegment[],
): string {
    return segments
        .map(
            (segment) =>
                segment.text,
        )
        .join("\n\n")
}

// -----------------------------------------------------------------------------
// Projection
// -----------------------------------------------------------------------------

export function projectSocialContentDraftText(
    draft: SocialContentDraft,
): SocialContentDraftTextProjection {
    const segments:
        SocialContentDraftTextSegment[] =
        []

    switch (draft.format) {
        case "staticPost": {
            const text =
                draft.text.trim()

            if (text.length === 0) {
                throw new Error(
                    "Static post draft text must not be blank",
                )
            }

            segments.push({
                kind:
                    "staticText",

                text,
            })

            break
        }

        case "carousel": {
            pushCaption(
                segments,
                draft.caption,
            )

            pushFrames(
                segments,
                draft.frames,
            )

            break
        }

        case "story": {
            pushFrames(
                segments,
                draft.frames,
            )

            break
        }

        case "reel": {
            pushCaption(
                segments,
                draft.caption,
            )

            const script =
                draft.script.trim()

            if (script.length === 0) {
                throw new Error(
                    "Reel draft script must not be blank",
                )
            }

            segments.push({
                kind:
                    "script",

                text:
                    script,
            })

            draft.onScreenText.forEach(
                (
                    item,
                    index,
                ) => {
                    const text =
                        item.trim()

                    if (
                        text.length ===
                        0
                    ) {
                        throw new Error(
                            `Reel on-screen text item ${index + 1} must not be blank`,
                        )
                    }

                    segments.push({
                        kind:
                            "onScreenText",

                        itemOrder:
                            index + 1,

                        text,
                    })
                },
            )

            break
        }
    }

    if (segments.length === 0) {
        throw new Error(
            "Content draft text projection must contain public copy",
        )
    }

    return {
        text:
            joinSegments(
                segments,
            ),

        segments,
    }
}