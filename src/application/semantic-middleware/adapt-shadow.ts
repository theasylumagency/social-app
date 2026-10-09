import type { FieldOrigin, Slot } from "../../core/domain/semantic-observation"
import { SEMANTIC_OBSERVATION_CONTRACT_VERSION } from "../../core/domain/semantic-observation"
import type { Phase7aClaim, Phase7aObservation } from "../../blueprints/social/semantic-middleware/contract"
import { checkSemanticObservationContract } from "../../blueprints/social/semantic-middleware/check-contract"
import { baseTaskObservation, taskContext } from "../../blueprints/social/semantic-middleware/shadow-task"
import { unknownSlot, type BoundedSemanticTask, type ShadowConfiguration, type ShadowDecision, type ShadowObservationRecord, type ShadowTrace } from "../../blueprints/social/semantic-middleware/shadow"

/** Tracks unresolved/unknown interpretation slots without replacing unknown with invented values. */
function missingSlots(value: unknown, path = ""): string[] {
  if (!value || typeof value !== "object") return []
  const object = value as Record<string, unknown>
  if (object.state === "unknown" || object.state === "unresolved") return [path]
  return Object.entries(object).flatMap(([key, v]) => missingSlots(v, path ? path + "." + key : key))
}
export function adaptShadowObservation(task: BoundedSemanticTask, decisions: readonly ShadowDecision[], config: ShadowConfiguration, model: string) {
  const answer = (key: string) => decisions.find(d => d.key === key)?.derived
  const base = baseTaskObservation(task), unresolved: string[] = []
  const claims: Phase7aClaim[] = []
  for (const family of task.families) {
    const a = answer("family_" + family)
    if (a === "yes") {
      const supplied = task.claimCandidates.find(c => c.type === family)
      claims.push(supplied ? structuredClone(supplied) : family === "price" ? { type: "price", amount: unknownSlot(), currency: unknownSlot(), basis: unknownSlot() }
        : family === "discount" ? { type: "discount", reduction: unknownSlot() } : { type: "availability", resource: unknownSlot() })
    } else if (a !== "no") unresolved.push("claims")
  }
  const a = answer("polarity_affirmed"), n = answer("polarity_negated")
  const polarity: Slot<"affirmed" | "negated"> = a === "yes" && n === "no" ? { state: "known", value: "affirmed" }
    : a === "no" && n === "yes" ? { state: "known", value: "negated" } : { state: "unresolved" }
  const limits: ShadowTrace["knownCapabilityLimits"][number][] = []
  const origins: FieldOrigin[] = ["observationId", "propositionId", "sourceSpans"].map(field => ({ field, method: "deterministic" }))
  for (const field of ["normalizedProposition", "presentation", "attribution"]) origins.push({ field, method: task.anchorMethod })
  const bindings = task.bindings.map((set, index) => {
    origins.push({ field: "bindings." + index + ".bindingId", method: "deterministic" })
    if (set.capabilityLimit) limits.push({ code: set.capabilityLimit, bindingId: set.bindingId })
    for (const c of set.candidates) if (c.grounding === "elliptical" || c.grounding === "ambiguous") limits.push({ code: c.grounding === "elliptical" ? "ellipticalBinding" : "ambiguousBinding", bindingId: set.bindingId })
    const positive = set.candidates.filter(c => decisions.some(d => d.kind === "binding" && d.bindingId === set.bindingId && d.candidateId === c.candidateId && d.derived === "yes"))
    const selected = positive.length === 1 ? positive[0] : undefined
    // A model YES is insufficient for carry-over, ambiguous or ungrounded entities.
    const accepted = selected && (selected.grounding === "explicitMention" ? task.spans.some(span => span.excerpt.includes(selected.value.mention))
      : selected.grounding === "applicationEstablished" && !!selected.contextRef && task.contextRefs.includes(selected.contextRef))
    if (!accepted || !selected) return { bindingId: set.bindingId, role: set.role, target: { state: "unresolved" as const } }
    const resolution = task.registryResolutions?.find(r => r.bindingId === set.bindingId && r.mention === selected.value.mention && r.registryId === selected.value.registryId && task.contextRefs.includes(r.sourceRef))
    // Even an input candidate with an ID gets no ID unless the app's resolution registry confirms it.
    if (resolution) origins.push({ field: "bindings." + index + ".target.value.registryId", method: resolution.method, sourceRef: resolution.sourceRef })
    return { bindingId: set.bindingId, role: set.role, target: { state: "known" as const, value: { mention: selected.value.mention, ...(resolution ? { registryId: resolution.registryId } : {}) } } }
  })
  // Resource identity is app-owned; unresolved service targets stay unresolved.
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i]!
    if (claim.type === "availability") {
      const service = bindings.filter(b => b.role === "serviceOrItem" && b.target.state === "known")
      claims[i] = { type: "availability", resource: service.length === 1 ? { state: "known", value: service[0]!.bindingId } : { state: "unresolved" } }
    }
  }
  let time = task.time ? structuredClone(task.time) : undefined
  if (task.timeCandidates?.length) {
    const supported = task.timeCandidates.filter(c => decisions.some(d => d.kind === "time" && d.candidateId === c.candidateId && d.derived === "yes"))
    time = { ...(time ?? { expressions: [], period: unknownSlot() }), relation: supported.length === 1 ? { state: "known", value: supported[0]!.value } : { state: "unresolved" } }
  }
  if (task.amountCandidates?.length) {
    const supported = task.amountCandidates.filter(c => decisions.some(d => d.kind === "amount" && d.candidateId === c.candidateId && d.derived === "yes"))
    // Confirmation can corroborate the caller's normalized value, never replace it with a distractor.
    const confirmed = supported.length === 1 && task.claimCandidates.some(c => JSON.stringify(c) === JSON.stringify(supported[0]!.claim))
    if (!confirmed && claims.length) unresolved.push("claims")
  }
  const suppliedFields = { normalizedProposition: base.normalizedProposition, presentation: base.presentation, attribution: base.attribution, claims, bindings, polarity, ...(time ? { time } : {}) }
  unresolved.push(...missingSlots(suppliedFields))
  const fields = [...new Set(unresolved)]
  const refs = [...new Set([task.source.sourceId + "/" + task.source.revisionId, ...task.contextRefs, config.configurationRef])]
  const interpreter = { provider: "jev", model, configurationRef: config.configurationRef }
  const observation: Phase7aObservation = { ...base, ...suppliedFields,
    interpretation: fields.length ? { status: "partial", unresolvedFields: fields } : { status: "resolved" },
    // Phase 7A's consumer profile excludes confidence. Raw probabilities stay in the trace.
    provenance: { contractVersion: SEMANTIC_OBSERVATION_CONTRACT_VERSION, method: "jevCandidate", inputRefs: [task.source.sourceId + "/" + task.source.revisionId], contextRefs: refs, interpreter, fieldOrigins: origins } }
  const context = { ...taskContext(task), provenance: { method: "jevCandidate" as const, refs, interpreter, fieldOrigins: origins } }
  const result = checkSemanticObservationContract(observation, context)
  const record: ShadowObservationRecord = { purpose: "shadowEvaluationOnly", observation }
  return { record, unresolvedFields: fields, limits: limits.filter((limit, i) => limits.findIndex(l => l.code === limit.code && l.bindingId === limit.bindingId) === i),
    contractValidation: { status: result.status, issues: result.status === "structurallyInvalid" ? result.issues : [] } }
}
