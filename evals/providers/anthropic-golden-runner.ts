import type {
    GoldenModelRunner,
    StructuredModelRequest,
    StructuredModelResult,
} from "../golden/model-runner"

type AnthropicContentBlock = {
    readonly type?: string
    readonly name?: string
    readonly input?: unknown
    readonly text?: string
}

type AnthropicResponsePayload = {
    readonly content?: readonly AnthropicContentBlock[]

    readonly error?: {
        readonly message?: string
    }
}

const OUTPUT_TOOL_NAME =
    "submit_structured_output"

export type AnthropicGoldenRunnerOptions = {
    readonly apiKey: string
    readonly model: string
}

export class AnthropicGoldenRunner
    implements GoldenModelRunner {
    constructor(
        private readonly options:
            AnthropicGoldenRunnerOptions,
    ) { }

    async run<Input, Output>(
        request: StructuredModelRequest<Input>,
    ): Promise<StructuredModelResult<Output>> {
        const response = await fetch(
            "https://api.anthropic.com/v1/messages",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-api-key":
                        this.options.apiKey,
                    "anthropic-version":
                        "2023-06-01",
                },

                body: JSON.stringify({
                    model: this.options.model,
                    max_tokens: 4096,

                    system: request.systemPrompt,

                    messages: [
                        {
                            role: "user",
                            content: JSON.stringify(
                                request.input,
                            ),
                        },
                    ],

                    tools: [
                        {
                            name: OUTPUT_TOOL_NAME,

                            description:
                                "Submit the final structured result. " +
                                "Use this tool exactly once with the final answer " +
                                "that follows the supplied JSON schema.",

                            input_schema:
                                request.responseSchema.schema,
                        },
                    ],

                    tool_choice: {
                        type: "tool",
                        name: OUTPUT_TOOL_NAME,
                    },
                }),
            },
        )

        const payload =
            await response.json() as AnthropicResponsePayload

        if (!response.ok) {
            throw new Error(
                `Anthropic API error ${response.status
                }: ${payload.error?.message ??
                "unknown error"
                }`,
            )
        }

        const toolUse = (
            payload.content ?? []
        ).find(
            (block) =>
                block.type === "tool_use" &&
                block.name === OUTPUT_TOOL_NAME,
        )

        if (!toolUse) {
            throw new Error(
                "Anthropic response did not contain the structured output tool call",
            )
        }

        if (
            toolUse.input === null ||
            typeof toolUse.input !== "object"
        ) {
            throw new Error(
                "Anthropic structured output was invalid",
            )
        }

        return {
            model: this.options.model,
            output: toolUse.input as Output,
        }
    }
}