import { MODEL, requestBody, RoutingProviderError, operations, scopes, type RoutingInput, type RoutingResult, type ChoiceAnswer, type Operation, type Scope } from "./router.mjs"
export const TRANSPORT = "jev-native-choice-rounded-probabilities-v2"
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const probability = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1
/** Provider serializes Choice values at two decimal places. Preserve them; never renormalize. */
export function validateChoice<T extends string>(raw: unknown, options: readonly T[]): ChoiceAnswer<T> {
 if (!object(raw) || raw.type !== "choice" || typeof raw.choice !== "string" || !options.includes(raw.choice as T) || !object(raw.probabilities) || !probability(raw.confidence)) throw new RoutingProviderError("schema")
 const probs = raw.probabilities, selected = raw.choice
 if (Object.keys(raw).some(k => !["type", "choice", "probabilities", "confidence"].includes(k)) || Object.keys(probs).length !== options.length || options.some(k => !probability(probs[k]))) throw new RoutingProviderError("schema")
 const values = options.map(k => probs[k] as number), sum = values.reduce((n, p) => n + p, 0)
 const twoDecimal = values.every(p => Math.abs(p * 100 - Math.round(p * 100)) < 0.000001)
 const roundingTolerance = twoDecimal ? options.length * 0.005 + 0.000001 : 0.000001
 if (Math.abs(sum - 1) > roundingTolerance || sum <= 0 || options.some(k => (probs[k] as number) > (probs[selected] as number) + 0.000001)) throw new RoutingProviderError("schema")
 return { type: "choice", choice: selected as T, probabilities: probs as Record<T, number>, confidence: raw.confidence }
}
export function validateNoul(raw: unknown) {
 if (!object(raw) || raw.type !== "noul" || !probability(raw.noul) || Object.keys(raw).some(k => !["type", "noul"].includes(k))) throw new RoutingProviderError("schema")
 return { type: "noul" as const, noul: raw.noul }
}
export function validateUsage(raw: unknown) {
 if (!object(raw) || typeof raw.input_tokens !== "number" || typeof raw.output_tokens !== "number" || !Number.isSafeInteger(raw.input_tokens) || !Number.isSafeInteger(raw.output_tokens) || raw.input_tokens < 0 || raw.output_tokens < 0) throw new RoutingProviderError("schema")
 return { input_tokens: raw.input_tokens, output_tokens: raw.output_tokens }
}
export function validateResponseV2(raw: unknown): RoutingResult {
 if (!object(raw) || raw.model !== MODEL || !object(raw.answers) || Object.keys(raw.answers).sort().join() !== ["extraMeaning", "operation", "scope", "standaloneEdit"].join()) throw new RoutingProviderError("schema")
 return { model: MODEL, answers: { operation: validateChoice(raw.answers.operation, Object.keys(operations) as Operation[]), scope: validateChoice(raw.answers.scope, Object.keys(scopes) as Scope[]), standaloneEdit: validateNoul(raw.answers.standaloneEdit), extraMeaning: validateNoul(raw.answers.extraMeaning) }, usage: validateUsage(raw.usage) }
}
export async function nativeRequest(body: unknown, key: string, signal: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<unknown> {
 const response = await fetchImpl("https://api.typesafe.ai/v1/systemone", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal, redirect: "error", cache: "no-store" })
 if (!response.ok) throw new RoutingProviderError("http", response.status)
 try { return await response.json() } catch { throw new RoutingProviderError("schema") }
}
export async function classifyV2(input: RoutingInput, key: string, signal: AbortSignal, reverse = false, fetchImpl: typeof fetch = fetch) { return validateResponseV2(await nativeRequest(requestBody(input, reverse), key, signal, fetchImpl)) }
