const AUTHORITY_FIELDS = [
    "id",
    "draftId",
    "socialContentDraftId",
    "contentId",
    "contentBriefId",
    "contentExecutionSpecId",
    "channel",
    "contentMode",
    "format",
    "depth",
    "visualDependency",
    "version",
    "locale",
    "createdAt",
    "updatedAt",
    "state",
    "approvalState",
    "reviewState",
    "schedule",
    "publishAt",
    "accountId",
]

const FRAME_AUTHORITY_FIELDS = [
    "id",
    "frameId",
    "order",
    "createdAt",
    "updatedAt",
]

function isNonEmptyString(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    )
}

function isNullableNonEmptyString(value) {
    return (
        value === null ||
        isNonEmptyString(value)
    )
}

function isStringArray(value) {
    return (
        Array.isArray(value) &&
        value.every(
            (item) =>
                isNonEmptyString(item),
        )
    )
}

function validateFrames(
    frames,
    failures,
) {
    if (!Array.isArray(frames)) {
        failures.push(
            "draft.frames must be an array",
        )

        return
    }

    for (const frame of frames) {
        if (
            frame === null ||
            typeof frame !== "object" ||
            Array.isArray(frame)
        ) {
            failures.push(
                "each draft frame must be an object",
            )

            continue
        }

        for (
            const field
            of FRAME_AUTHORITY_FIELDS
        ) {
            if (
                Object.prototype.hasOwnProperty.call(
                    frame,
                    field,
                )
            ) {
                failures.push(
                    `draft frame contains authority field: ${field}`,
                )
            }
        }

        if (
            !isNullableNonEmptyString(
                frame.heading,
            )
        ) {
            failures.push(
                "draft frame heading must be null or a non-empty string",
            )
        }

        if (
            !isNonEmptyString(
                frame.body,
            )
        ) {
            failures.push(
                "draft frame body must be a non-empty string",
            )
        }
    }
}

function evaluateContentWriterProposal(
    output,
    input,
) {
    const failures = []

    if (
        output === null ||
        typeof output !== "object" ||
        Array.isArray(output)
    ) {
        return {
            passed: false,

            failures: [
                "output must be an object",
            ],
        }
    }

    const draft =
        output.draft

    if (
        draft === null ||
        typeof draft !== "object" ||
        Array.isArray(draft)
    ) {
        return {
            passed: false,

            failures: [
                "draft must be an object",
            ],
        }
    }

    for (
        const field
        of AUTHORITY_FIELDS
    ) {
        if (
            Object.prototype.hasOwnProperty.call(
                draft,
                field,
            )
        ) {
            failures.push(
                `draft contains authority field: ${field}`,
            )
        }
    }

    if (
        !isNullableNonEmptyString(
            draft.text,
        )
    ) {
        failures.push(
            "draft.text must be null or a non-empty string",
        )
    }

    if (
        !isNullableNonEmptyString(
            draft.caption,
        )
    ) {
        failures.push(
            "draft.caption must be null or a non-empty string",
        )
    }

    if (
        !isNullableNonEmptyString(
            draft.script,
        )
    ) {
        failures.push(
            "draft.script must be null or a non-empty string",
        )
    }

    if (
        !isStringArray(
            draft.onScreenText,
        )
    ) {
        failures.push(
            "draft.onScreenText must be a string array",
        )
    }

    validateFrames(
        draft.frames,
        failures,
    )

    const format =
        input?.contentExecutionSpec
            ?.format

    if (format === "staticPost") {
        if (
            !isNonEmptyString(
                draft.text,
            )
        ) {
            failures.push(
                "staticPost requires non-empty text",
            )
        }

        if (draft.caption !== null) {
            failures.push(
                "staticPost caption must be null",
            )
        }

        if (
            !Array.isArray(
                draft.frames,
            ) ||
            draft.frames.length !== 0
        ) {
            failures.push(
                "staticPost frames must be empty",
            )
        }

        if (draft.script !== null) {
            failures.push(
                "staticPost script must be null",
            )
        }

        if (
            !Array.isArray(
                draft.onScreenText,
            ) ||
            draft.onScreenText.length !== 0
        ) {
            failures.push(
                "staticPost onScreenText must be empty",
            )
        }
    } else if (
        format === "carousel"
    ) {
        if (draft.text !== null) {
            failures.push(
                "carousel text must be null",
            )
        }

        if (
            !Array.isArray(
                draft.frames,
            ) ||
            draft.frames.length < 2
        ) {
            failures.push(
                "carousel requires at least two frames",
            )
        }

        if (draft.script !== null) {
            failures.push(
                "carousel script must be null",
            )
        }

        if (
            !Array.isArray(
                draft.onScreenText,
            ) ||
            draft.onScreenText.length !== 0
        ) {
            failures.push(
                "carousel onScreenText must be empty",
            )
        }
    } else if (
        format === "story"
    ) {
        if (draft.text !== null) {
            failures.push(
                "story text must be null",
            )
        }

        if (draft.caption !== null) {
            failures.push(
                "story caption must be null",
            )
        }

        if (
            !Array.isArray(
                draft.frames,
            ) ||
            draft.frames.length < 1
        ) {
            failures.push(
                "story requires at least one frame",
            )
        }

        if (draft.script !== null) {
            failures.push(
                "story script must be null",
            )
        }

        if (
            !Array.isArray(
                draft.onScreenText,
            ) ||
            draft.onScreenText.length !== 0
        ) {
            failures.push(
                "story onScreenText must be empty",
            )
        }
    } else if (
        format === "reel"
    ) {
        if (draft.text !== null) {
            failures.push(
                "reel text must be null",
            )
        }

        if (
            !Array.isArray(
                draft.frames,
            ) ||
            draft.frames.length !== 0
        ) {
            failures.push(
                "reel frames must be empty",
            )
        }

        if (
            !isNonEmptyString(
                draft.script,
            )
        ) {
            failures.push(
                "reel requires non-empty script",
            )
        }
    } else {
        failures.push(
            `unsupported execution format: ${format}`,
        )
    }

    return {
        passed:
            failures.length === 0,

        failures,
    }
}

module.exports = {
    evaluateContentWriterProposal,
}