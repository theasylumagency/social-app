export type JsonSchema =
    Readonly<Record<string, unknown>>

export type StructuredOutputSchema = {
    readonly name: string
    readonly schema: JsonSchema
}

export type StructuredModelRequest<Input> = {
    readonly task: string
    readonly systemPrompt: string
    readonly input: Input

    readonly responseSchema: StructuredOutputSchema
}

export type StructuredModelResult<Output> = {
    readonly model: string
    readonly output: Output
}

export interface GoldenModelRunner {
    run<Input, Output>(
        request: StructuredModelRequest<Input>,
    ): Promise<StructuredModelResult<Output>>
}