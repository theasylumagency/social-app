import { randomUUID } from "node:crypto"
import { adaptShadowObservation } from "./adapt-shadow"
import { boundedDecisionRequest, validateBoundedTask } from "../../blueprints/social/semantic-middleware/shadow-task"
import type { SemanticSourceRevision } from "../../core/domain/semantic-observation"
import type { BoundedSemanticTask, SemanticDecisionResult, ShadowConfiguration, ShadowDecision, ShadowInterpreter, ShadowLinkage, ShadowTrace, ShadowTraceSink } from "../../blueprints/social/semantic-middleware/shadow"

export type ShadowCollectionInput = { readonly source: SemanticSourceRevision; readonly task: BoundedSemanticTask | null; readonly linkage: ShadowLinkage }
export type ShadowCollection = { readonly enabled: boolean; readonly configuration: ShadowConfiguration; readonly interpreter: ShadowInterpreter; readonly sink: ShadowTraceSink
  readonly inputUsdPerMillion?: number | null; readonly outputUsdPerMillion?: number | null }

export function deriveShadowDecision(probability: number | null, config: ShadowConfiguration): ShadowDecision["derived"] {
  if (probability === null) return "technicalMissing"
  if (config.policy.mode === "rawOnly") return "notDerived"
  return probability >= config.policy.high ? "yes" : probability <= config.policy.low ? "no" : "applicationDeadZone"
}
function validResult(value: SemanticDecisionResult, keys: readonly string[], model: string): boolean {
  return value?.provider === "jev" && value.model === model && !!value.probabilities && Object.keys(value.probabilities).length === keys.length
    && keys.every(key => typeof value.probabilities[key] === "number" && Number.isFinite(value.probabilities[key]) && value.probabilities[key]! >= 0 && value.probabilities[key]! <= 1)
    && [value.inputTokens, value.outputTokens].every(n => n === null || (Number.isSafeInteger(n) && n >= 0))
}
/** Deadline race covers even a misbehaving injected port that ignores AbortSignal. */
export async function withinShadowDeadline<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  const failed = new Promise<never>((_, reject) => {
    abort = () => { controller.abort(); reject(new DOMException("Shadow timeout", "TimeoutError")) }
    timer = setTimeout(abort, Math.max(1, timeoutMs))
    if (parent?.aborted) abort()
    else parent?.addEventListener("abort", abort, { once: true })
  })
  try { return await Promise.race([Promise.resolve().then(() => {
    if (controller.signal.aborted) throw new DOMException("Shadow timeout", "TimeoutError")
    return work(controller.signal)
  }), failed]) }
  finally { clearTimeout(timer); if (abort) parent?.removeEventListener("abort", abort) }
}
function providerError(error: unknown): ShadowTrace["technicalErrors"][number] {
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) return { code: "timeout" }
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "providerSchema") return { code: "providerSchema" }
    if (error.code === "http") return { code: "http", ...("httpStatus" in error && typeof error.httpStatus === "number" && error.httpStatus >= 100 && error.httpStatus < 600 ? { httpStatus: error.httpStatus } : {}) }
  }
  return { code: "providerException" } // Never persist exception text/stack/response bodies.
}
export async function evaluateSemanticShadow(input: ShadowCollectionInput, collection: ShadowCollection, signal?: AbortSignal, notInvokedReason?: ShadowTrace["notInvokedReason"]): Promise<ShadowTrace> {
  const { source, linkage } = input, task = input.task ? structuredClone(input.task) : null
  const valid = task !== null && task.source.sourceId === source.sourceId && task.source.revisionId === source.revisionId && task.source.text === source.text && validateBoundedTask(task)
  const request = valid && task ? boundedDecisionRequest(task) : null
  const applicationTask = valid && task ? Object.fromEntries(Object.entries(task).filter(([key]) => key !== "source")) as Omit<BoundedSemanticTask, "source"> : undefined
  const base: ShadowTrace = { traceVersion: "unda-semantic-shadow-trace-v1", purpose: "evaluationOnly", runId: randomUUID(), timestamp: new Date().toISOString(),
    linkage: structuredClone(linkage), source: structuredClone(source), eligibility: valid ? "eligible" : "ineligible", invocation: "notInvoked",
    requestedTargets: request?.targets ?? [], candidates: { bindings: valid ? task!.bindings : [], time: valid ? task!.timeCandidates : undefined, amount: valid ? task!.amountCandidates : undefined },
    decisions: [], unresolvedFields: [], contractValidation: { status: "notChecked", issues: [] }, knownCapabilityLimits: [], technicalErrors: [],
    latencyMs: null, providerRequests: 0, semanticDecisions: 0, tokens: { input: null, output: null }, costUsd: null, configuration: structuredClone(collection.configuration), actualModel: null,
    costEstimateRates: { inputUsdPerMillion: collection.inputUsdPerMillion ?? null, outputUsdPerMillion: collection.outputUsdPerMillion ?? null },
    ...(valid && task && applicationTask ? { anchor: { propositionId: task.propositionId, spans: task.spans, method: task.anchorMethod, rule: task.anchorRule }, applicationTask } : {}) }
  if (!collection.enabled || !valid || notInvokedReason || !request || !task || signal?.aborted) return { ...base,
    notInvokedReason: !collection.enabled ? "disabled" : notInvokedReason ?? (signal?.aborted ? "budgetExhausted" : task ? "invalidTask" : "noBoundedAnchor"),
    technicalErrors: task && !valid ? [{ code: "invalidTask" }] : [] }
  const started = performance.now()
  let result: SemanticDecisionResult | null = null, failure: ShadowTrace["technicalErrors"][number] | null = null
  try {
    const received = await withinShadowDeadline(s => collection.interpreter.interpret(request, s), collection.configuration.timeoutMs, signal)
    if (!validResult(received, request.targets.map(t => t.key), collection.configuration.model)) failure = { code: "providerSchema" }
    else result = received
  } catch (error) { failure = providerError(error) }
  const decisions: ShadowDecision[] = request.targets.map(target => {
    const probabilityYes = result?.probabilities[target.key] ?? null
    return { ...target, probabilityYes, derived: deriveShadowDecision(probabilityYes, collection.configuration) }
  })
  const adapted = adaptShadowObservation(task, decisions, collection.configuration, result?.model ?? collection.configuration.model)
  const inputRate = collection.inputUsdPerMillion, outputRate = collection.outputUsdPerMillion
  return { ...base, invocation: failure?.code === "timeout" ? "timeout" : failure ? "technicalFailure" : "returned", decisions,
    observation: adapted.record, unresolvedFields: adapted.unresolvedFields, contractValidation: adapted.contractValidation, knownCapabilityLimits: adapted.limits,
    latencyMs: performance.now() - started, providerRequests: 1, semanticDecisions: request.targets.length,
    technicalErrors: failure ? [failure] : [], actualModel: result?.model ?? null, tokens: { input: result?.inputTokens ?? null, output: result?.outputTokens ?? null },
    costUsd: result?.inputTokens !== null && result?.inputTokens !== undefined && result.outputTokens !== null && inputRate !== null && inputRate !== undefined && outputRate !== null && outputRate !== undefined
      ? (result.inputTokens * inputRate + result.outputTokens * outputRate) / 1e6 : null }
}

/** No return value is available to approval/repair/publishing. Sink failure is also isolated. */
export async function collectSemanticShadow(inputs: readonly ShadowCollectionInput[], collection: ShadowCollection, budgetMs: number): Promise<void> {
  if (!collection.enabled) return
  let providerRequests = 0
  const deadline = Date.now() + budgetMs
  try {
    await withinShadowDeadline(async signal => {
      for (const input of inputs) {
        if (signal.aborted) return
        const reason = input.task && validateBoundedTask(input.task) ? providerRequests >= collection.configuration.maxTasks ? "taskLimit"
          : Date.now() + collection.configuration.timeoutMs + 100 > deadline ? "budgetExhausted" : undefined : undefined
        const trace = await evaluateSemanticShadow(input, collection, signal, reason)
        providerRequests += trace.providerRequests
        if (!signal.aborted) { try { await collection.sink.append(trace, signal) } catch { /* Evaluation storage cannot fail production. */ } }
      }
    }, budgetMs)
  } catch { /* Total collection deadline/provider/storage failure is non-authoritative. */ }
}
