import type { Phase7aObservation, SemanticContractContext } from "./contract"
import { checkSemanticObservationContract } from "./check-contract"
import { unknownSlot, type BoundedSemanticTask, type SemanticDecisionRequest, type ShadowTarget } from "./shadow"
import type { SemanticSourceRevision, SourceSpan } from "../../../core/domain/semantic-observation"

export function taskContext(task: BoundedSemanticTask): SemanticContractContext {
  return { observationId: task.observationId, anchor: { propositionId: task.propositionId, sourceSpans: task.spans }, sources: [task.source],
    bindingIds: task.bindings.map(b => b.bindingId), ...(task.registryResolutions ? { registryResolutions: task.registryResolutions } : {}),
    provenance: { method: "deterministic", refs: [task.source.sourceId + "/" + task.source.revisionId, ...task.contextRefs] } }
}
export function baseTaskObservation(task: BoundedSemanticTask): Phase7aObservation {
  return { observationId: task.observationId, propositionId: task.propositionId, sourceSpans: structuredClone(task.spans),
    normalizedProposition: structuredClone(task.normalizedProposition), presentation: structuredClone(task.presentation), attribution: structuredClone(task.attribution),
    claims: structuredClone(task.claimCandidates), polarity: unknownSlot(), bindings: task.bindings.map(b => ({ bindingId: b.bindingId, role: b.role, target: unknownSlot() })),
    ...(task.time ? { time: structuredClone(task.time) } : {}), ...(task.qualifiers ? { qualifiers: structuredClone(task.qualifiers) } : {}),
    interpretation: { status: "partial", unresolvedFields: ["polarity", ...task.bindings.map((_, i) => "bindings." + i + ".target"), ...(task.normalizedProposition.state === "unresolved" ? ["normalizedProposition"] : [])] },
    provenance: { contractVersion: "unda-semantic-observation-v1", method: "deterministic", contextRefs: taskContext(task).provenance.refs } }
}
export function validateBoundedTask(task: BoundedSemanticTask): boolean {
  try {
    if (!["structured", "deterministic", "human"].includes(task.anchorMethod) || !["controlledSingleRelation:v1", "structuredFixture:v1", "callerEstablished:v1"].includes(task.anchorRule)
      || task.source.text.length > 8000 || task.spans.length !== 1 || task.families.length < 1 || task.families.length > 3
      || task.families.some(f => !["price", "discount", "availability"].includes(f)) || new Set(task.families).size !== task.families.length
      || task.bindings.length > 2 || task.bindings.some(b => b.candidates.length > 2 || !["serviceOrItem", "branchOrPlace"].includes(b.role))
      || (task.timeCandidates?.length ?? 0) > 2 || (task.amountCandidates?.length ?? 0) > 2) return false
    const dimensions = task.bindings.filter(b => b.candidates.length).length + (task.timeCandidates?.length ? 1 : 0) + (task.amountCandidates?.length ? 1 : 0)
    if (dimensions > 2) return false
    const ids = task.bindings.flatMap(b => b.candidates.map(c => c.candidateId)).concat(task.timeCandidates?.map(c => c.candidateId) ?? [], task.amountCandidates?.map(c => c.candidateId) ?? [])
    if (new Set(ids).size !== ids.length || ids.some(id => !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) return false
    if (task.bindings.some(b => b.candidates.some(c => !c.value.mention.trim() || !["explicitMention", "applicationEstablished", "elliptical", "ambiguous"].includes(c.grounding)
      || (c.grounding === "applicationEstablished" && (!c.contextRef || !task.contextRefs.includes(c.contextRef)))))) return false
    if (task.timeCandidates?.some(c => !["past", "current", "future"].includes(c.value))) return false
    const base = baseTaskObservation(task), context = taskContext(task)
    if (checkSemanticObservationContract(base, context).status !== "structurallyValid") return false
    for (const candidate of task.amountCandidates ?? []) if (checkSemanticObservationContract({ ...base, claims: [candidate.claim] }, context).status !== "structurallyValid") return false
    return true
  } catch { return false }
}

export function boundedDecisionRequest(task: BoundedSemanticTask): SemanticDecisionRequest {
  const targets: ShadowTarget[] = task.families.map(family => ({ key: "family_" + family, kind: "family", family }))
  targets.push({ key: "polarity_affirmed", kind: "polarity", value: "affirmed" }, { key: "polarity_negated", kind: "polarity", value: "negated" })
  task.bindings.forEach((binding, index) => binding.candidates.forEach((candidate, i) => targets.push({ key: "binding_" + index + "_" + i, kind: "binding", bindingId: binding.bindingId, candidateId: candidate.candidateId })))
  task.timeCandidates?.forEach((candidate, i) => targets.push({ key: "time_" + i, kind: "time", candidateId: candidate.candidateId }))
  task.amountCandidates?.forEach((candidate, i) => targets.push({ key: "amount_" + i, kind: "amount", candidateId: candidate.candidateId }))
  return { fullText: task.source.text, anchorText: task.spans[0]!.excerpt, targets,
    bindingCandidates: task.bindings.flatMap(b => b.candidates.map(c => ({ bindingId: b.bindingId, candidateId: c.candidateId, role: b.role, mention: c.value.mention }))),
    timeCandidates: task.timeCandidates?.map(({ candidateId, value }) => ({ candidateId, value })),
    amountCandidates: task.amountCandidates?.map(({ candidateId, claim }) => ({ candidateId, claim: structuredClone(claim) })) }
}

const known = <T>(value: T) => ({ state: "known" as const, value })
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** Whole-field, single-relation grammar over a caller-supplied service catalogue.
 * It is intentionally narrow: arbitrary prose, quotations, compounds and lexical hits are ineligible.
 * The grammar supplies arguments from literal text, never from business tariffs/authority. */
export function controlledSentenceTask(source: SemanticSourceRevision, observationId: string, serviceMentions: readonly string[]): BoundedSemanticTask | null {
  const text = source.text.trim()
  if (!text || text.length > 8000 || new Set(serviceMentions).size > 32) return null
  for (const service of [...new Set(serviceMentions)]) {
    if (!service.trim() || service.length > 120 || /[\r\n]/.test(service)) continue
    const name = escaped(service), number = "(0|[1-9]\\d*(?:\\.\\d+)?)"
    const price = new RegExp("^" + name + " " + number + " ლარი (?:არ )?ღირს[.!]?$", "u").exec(text)
    const starting = new RegExp("^" + name + ": ფასი " + number + " ლარიდან იწყება[.!]?$", "u").exec(text)
    const discount = new RegExp("^(?:(დღეს|ახლა|გასულ კვირას|მომავალ კვირას) )?" + name + "ზე " + number + "%-იანი ფასდაკლება (?:მოქმედებს|მოქმედებდა|იმოქმედებს|აღარ მოქმედებს|დასრულდა)[.!]?$", "u").exec(text)
    const availability = new RegExp("^(?:(დღეს|ახლა|მომავალ კვირას) )?" + name + "ზე თავისუფალი ადგილები (?:არის|არ არის|აღარ არის|იქნება)[.!]?$", "u").exec(text)
    if (!price && !starting && !discount && !availability) continue
    const start16 = source.text.indexOf(text), start = Array.from(source.text.slice(0, start16)).length
    const span: SourceSpan = { sourceId: source.sourceId, revisionId: source.revisionId, start, end: start + Array.from(text).length, excerpt: text }
    const base: BoundedSemanticTask = { observationId, propositionId: source.sourceId + "/" + source.revisionId + "/p1", source, spans: [span],
      anchorMethod: "deterministic", anchorRule: "controlledSingleRelation:v1", contextRefs: [], families: ["price", "discount", "availability"],
      normalizedProposition: known(price ? service + " " + price[1] + " ლარი ღირს." : starting ? text : discount ? service + "ზე ფასდაკლება მოქმედებს." : service + "ზე თავისუფალი ადგილები არის."),
      presentation: known("assertion"), attribution: { mode: known("firstParty"), adoption: known("adopted") },
      claimCandidates: price || starting ? [{ type: "price", amount: known((price ?? starting)![1]!), currency: known("GEL"), basis: known(starting ? "starting" : "exact") }]
        : discount ? [{ type: "discount", reduction: known({ value: discount[2]!, unit: known("percent") }) }]
        : [{ type: "availability", resource: known("service1") }],
      bindings: [{ bindingId: "service1", role: "serviceOrItem", candidates: [{ candidateId: "service1", value: { mention: service }, grounding: "explicitMention" }] }],
      ...((discount?.[1] ?? availability?.[1]) ? { time: { relation: unknownSlot(), expressions: [(discount?.[1] ?? availability?.[1])!], period: unknownSlot(), relativeReferenceId: unknownSlot() }, timeCandidates: [{ candidateId: "current", value: "current" }, { candidateId: "future", value: "future" }] } : {}) }
    return validateBoundedTask(base) ? base : null
  }
  return null
}
