export type StructuredModelRequest<Input> = {
    readonly task: string
    readonly systemPrompt: string
    readonly input: Input
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