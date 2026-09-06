import type {
    GoldenModelRunner,
    StructuredModelRequest,
    StructuredModelResult,
} from "../golden/model-runner"

type OpenAIResponseContent = {
    readonly type?: string
    readonly text?: string
    readonly refusal?: string
}

type OpenAIResponseOutput = {
    readonly type?: string
    readonly content?: readonly OpenAIResponseContent[]
}

type OpenAIResponsePayload = {
    readonly status?: string
    readonly output?: readonly OpenAIResponseOutput[]

    readonly error?: {
        readonly message?: string
    }
}

function extractOutputText(
    payload: OpenAIResponsePayload,
): string {
    for (const item of payload.output ?? []) {
        if (item.type !== "message") {
            continue
        }

        for (const content of item.content ?? []) {
            if (content.type === "refusal") {
                throw new Error(
                    `OpenAI refused the request: ${content.refusal ?? "unknown refusal"
                    }`,
                )
            }

            if (
                content.type === "output_text" &&
                typeof content.text === "string"
            ) {
                return content.text
            }
        }
    }

    throw new Error(
        "OpenAI response did not contain output_text",
    )
}

export type OpenAIGoldenRunnerOptions = {
    readonly apiKey: string
    readonly model: string
}

export class OpenAIGoldenRunner
    implements GoldenModelRunner {
    constructor(
        private readonly options:
            OpenAIGoldenRunnerOptions,
    ) { }

    async run<Input, Output>(
        request: StructuredModelRequest<Input>,
    ): Promise<StructuredModelResult<Output>> {
        const response = await fetch(
            "https://api.openai.com/v1/responses",
            {
                method: "POST",

                headers: {
                    Authorization:
                        `Bearer ${this.options.apiKey}`,
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    model: this.options.model,

                    input: [
                        {
                            role: "system",
                            content: request.systemPrompt,
                        },
                        {
                            role: "user",
                            content: JSON.stringify(
                                request.input,
                            ),
                        },
                    ],

                    text: {
                        format: {
                            type: "json_schema",
                            name:
                                request.responseSchema.name,
                            strict: true,
                            schema:
                                request.responseSchema.schema,
                        },
                    },
                }),
            },
        )

        const payload =
            await response.json() as OpenAIResponsePayload

        if (!response.ok) {
            throw new Error(
                `OpenAI API error ${response.status
                }: ${payload.error?.message ??
                "unknown error"
                }`,
            )
        }

        if (
            payload.status &&
            payload.status !== "completed"
        ) {
            throw new Error(
                `OpenAI response status: ${payload.status}`,
            )
        }

        const text = extractOutputText(payload)

        return {
            model: this.options.model,
            output: JSON.parse(text) as Output,
        }
    }
}