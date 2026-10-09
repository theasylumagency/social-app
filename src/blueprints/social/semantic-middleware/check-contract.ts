import { SEMANTIC_OBSERVATION_CONTRACT_VERSION } from "../../../core/domain/semantic-observation"
import type { FieldOrigin, InterpretationMethod } from "../../../core/domain/semantic-observation"
import type {
  SemanticContractCheck, SemanticContractContext, SemanticContractIssue, StructurallyCheckedObservation,
} from "./contract"
import { PHASE_7A_PROFILE, type Phase7aField, type SemanticConsumerProfile } from "./profile"

type ObjectValue = Record<string, unknown>
const methods = ["structured", "deterministic", "jevCandidate", "strongerModel", "human"] as const
const decimal = /^(?:0|[1-9]\d*)(?:\.\d+)?$/
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const objectValue = (value: unknown): value is ObjectValue => value !== null && typeof value === "object"
  && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

function fieldValue(value: unknown, path: string): unknown {
  for (const part of path.split(".")) {
    if (value === null || typeof value !== "object" || !own(value, part)) return undefined
    value = (value as ObjectValue)[part]
  }
  return value
}
const knownValue = (value: unknown): unknown => objectValue(value) && value.state === "known" ? value.value : undefined
function decimalGreater(left: string, right: string): boolean {
  const [li = "", lf = ""] = left.split(".")
  const [ri = "", rf = ""] = right.split(".")
  if (li.length !== ri.length) return li.length > ri.length
  if (li !== ri) return li > ri
  const scale = Math.max(lf.length, rf.length)
  return lf.padEnd(scale, "0") > rf.padEnd(scale, "0")
}

/** Pure shape/lineage check. Never assesses linguistic truth, support or publication. */
export function checkSemanticObservationContract(
  input: unknown,
  context: SemanticContractContext,
  profile: SemanticConsumerProfile = PHASE_7A_PROFILE,
): SemanticContractCheck {
  const issues: SemanticContractIssue[] = []
  const issue = (path: string, code: SemanticContractIssue["code"]) => { issues.push({ path, code }) }
  const refs = new Set(context.provenance.refs)
  const missingInterpretation = new Set<string>()

  function shape(value: unknown, path: string, required: readonly string[], optional: readonly string[] = []): value is ObjectValue {
    if (!objectValue(value)) { issue(path, "shape"); return false }
    for (const key of required) if (!own(value, key)) issue(`${path}.${key}`, "shape")
    for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) issue(`${path}.${key}`, "fieldNotRequested")
    return true
  }
  function text(value: unknown, path: string): value is string {
    if (typeof value !== "string" || !value.trim()) { issue(path, "shape"); return false }
    return true
  }
  function choice(value: unknown, path: string, choices: readonly string[]): boolean {
    if (typeof value !== "string" || !choices.includes(value)) { issue(path, "shape"); return false }
    return true
  }
  function list(value: unknown, path: string, check: (item: unknown, path: string) => void, nonempty = false): value is unknown[] {
    if (!Array.isArray(value) || (nonempty && value.length === 0)) { issue(path, "shape"); return false }
    value.forEach((item, i) => check(item, `${path}.${i}`))
    return true
  }
  function reference(value: unknown, path: string): void {
    if (text(value, path) && !refs.has(value)) issue(path, "reference")
  }
  function uniqueStrings(value: unknown, path: string, check: (value: unknown, path: string) => void = text, nonempty = false): void {
    if (!list(value, path, (v, p) => { check(v, p) }, nonempty)) return
    if (new Set(value).size !== value.length) issue(path, "shape")
  }
  function slot(value: unknown, path: string, check: (value: unknown, path: string) => void): void {
    if (!objectValue(value)) { issue(path, "shape"); return }
    switch (value.state) {
      case "known":
        if (shape(value, path, ["state", "value"])) check(value.value, `${path}.value`)
        break
      case "unknown":
        if (shape(value, path, ["state", "reason"])) choice(value.reason, `${path}.reason`, ["notStated", "notSupplied", "notEvaluated"])
        if (value.reason === "notEvaluated") missingInterpretation.add(path)
        break
      case "notApplicable": shape(value, path, ["state"]); break
      case "unresolved":
        shape(value, path, ["state"], ["alternatives"])
        missingInterpretation.add(path)
        if (own(value, "alternatives")) list(value.alternatives, `${path}.alternatives`, check, true)
        break
      default: issue(`${path}.state`, "shape")
    }
  }
  function numeric(value: unknown, path: string): void {
    if (typeof value !== "string" || !decimal.test(value)) issue(path, "numeric")
  }
  function quantity(value: unknown, path: string): void {
    if (!shape(value, path, ["value", "unit"])) return
    numeric(value.value, `${path}.value`)
    slot(value.unit, `${path}.unit`, text)
  }
  function existingField(value: unknown, path: string): boolean {
    if (!text(value, path)) return false
    if (!/^[A-Za-z]\w*(?:\.(?:[A-Za-z]\w*|\d+))*$/.test(value) || fieldValue(input, value) === undefined
      || value.startsWith("provenance") || value.startsWith("interpretation")) issue(path, "reference")
    return true
  }
  function originFor(path: string): InterpretationMethod {
    return context.provenance.fieldOrigins?.find(o => o.field === path)?.method ?? context.provenance.method
  }

  if (!shape(input, "observation", [
    "observationId", "propositionId", "sourceSpans", "normalizedProposition", "presentation",
    "claims", "polarity", "attribution", "interpretation", "provenance",
  ], ["bindings", "time", "qualifiers", "reasons", "parentPropositionId", "modality", "confidence"])) {
    return { status: "structurallyInvalid", issues }
  }
  for (const key of Object.keys(input)) if (!PHASE_7A_PROFILE.fields.includes(key as Phase7aField) || !profile.fields.includes(key as Phase7aField)) issue(key, "profile")
  if (!text(input.observationId, "observationId") || input.observationId !== context.observationId) issue("observationId", "identity")
  if (!text(input.propositionId, "propositionId") || input.propositionId !== context.anchor.propositionId) issue("propositionId", "identity")
  if (!context.anchor.sourceSpans.length) issue("context.anchor.sourceSpans", "span")
  if (new Set(context.sources.map(s => s.sourceId)).size !== context.sources.length) issue("context.sources", "identity")
  list(input.sourceSpans, "sourceSpans", (span, path) => {
    if (!shape(span, path, ["sourceId", "revisionId", "start", "end", "excerpt"])) return
    text(span.sourceId, `${path}.sourceId`)
    text(span.revisionId, `${path}.revisionId`)
    const source = context.sources.find(s => s.sourceId === span.sourceId)
    if (!source || source.revisionId !== span.revisionId) { issue(path, "span"); return }
    const points = Array.from(source.text)
    if (typeof span.start !== "number" || typeof span.end !== "number" || !Number.isSafeInteger(span.start)
      || !Number.isSafeInteger(span.end) || span.start < 0 || span.end <= span.start || span.end > points.length
      || span.excerpt !== points.slice(span.start, span.end).join("")) issue(path, "span")
  }, true)
  if (!Array.isArray(input.sourceSpans) || input.sourceSpans.length !== context.anchor.sourceSpans.length) issue("sourceSpans", "identity")
  else input.sourceSpans.forEach((span, index) => {
    const anchor = context.anchor.sourceSpans[index]
    if (!objectValue(span) || !anchor || Object.keys(anchor).some(key => span[key] !== anchor[key as keyof typeof anchor])) issue(`sourceSpans.${index}`, "identity")
  })
  slot(input.normalizedProposition, "normalizedProposition", text)
  slot(input.presentation, "presentation", (v, p) => { choice(v, p, ["assertion", "question", "hypothetical", "example", "instruction"]) })
  slot(input.polarity, "polarity", (v, p) => { choice(v, p, ["affirmed", "negated"]) })
  if (shape(input.attribution, "attribution", ["mode", "adoption"], ["chain"])) {
    slot(input.attribution.mode, "attribution.mode", (v, p) => { choice(v, p, ["firstParty", "reported", "quoted"]) })
    slot(input.attribution.adoption, "attribution.adoption", (v, p) => { choice(v, p, ["adopted", "notAdopted"]) })
    if (own(input.attribution, "chain")) list(input.attribution.chain, "attribution.chain", (value, path) => {
      if (!shape(value, path, ["mode", "speaker"])) return
      choice(value.mode, `${path}.mode`, ["reported", "quoted"])
      slot(value.speaker, `${path}.speaker`, text)
    }, true)
    const mode = knownValue(input.attribution.mode)
    if ((mode === "reported" || mode === "quoted") && (!Array.isArray(input.attribution.chain) || !input.attribution.chain.length)) issue("attribution.chain", "shape")
  }

  const bindings = new Map<string, ObjectValue>()
  if (own(input, "bindings")) list(input.bindings, "bindings", (binding, path) => {
    if (!shape(binding, path, ["bindingId", "role", "target"])) return
    if (text(binding.bindingId, `${path}.bindingId`)) {
      if (!context.bindingIds.includes(binding.bindingId) || bindings.has(binding.bindingId)) issue(`${path}.bindingId`, "identity")
      bindings.set(binding.bindingId, binding)
    }
    if (!choice(binding.role, `${path}.role`, profile.bindingRoles)) issue(`${path}.role`, "profile")
    slot(binding.target, `${path}.target`, (entity, entityPath) => {
      if (!shape(entity, entityPath, ["mention"], ["registryId"])) return
      text(entity.mention, `${entityPath}.mention`)
      if (!own(entity, "registryId")) return
      text(entity.registryId, `${entityPath}.registryId`)
      const resolution = context.registryResolutions?.find(r => r.bindingId === binding.bindingId
        && r.mention === entity.mention && r.registryId === entity.registryId)
      const origin = originFor(`${entityPath}.registryId`)
      if (!resolution || !refs.has(resolution.sourceRef) || (origin !== "structured" && origin !== "deterministic")
        || origin !== resolution.method) issue(`${entityPath}.registryId`, "provenance")
      if (resolution && context.provenance.method !== "structured" && context.provenance.method !== "deterministic") {
        const recorded = context.provenance.fieldOrigins?.find(o => o.field === `${entityPath}.registryId`)
        if (recorded?.sourceRef !== resolution.sourceRef) issue(`${entityPath}.registryId`, "provenance")
      }
    })
  })

  const families = new Set<string>()
  list(input.claims, "claims", (claim, path) => {
    if (!objectValue(claim) || typeof claim.type !== "string") { issue(path, "shape"); return }
    if (families.has(claim.type)) issue(`${path}.type`, "shape")
    families.add(claim.type)
    if (!profile.families.includes(claim.type as "price" | "discount" | "availability")) { issue(`${path}.type`, "profile"); return }
    switch (claim.type) {
      case "price": {
        shape(claim, path, ["type", "amount", "currency", "basis"], ["upperAmount"])
        slot(claim.amount, `${path}.amount`, numeric)
        slot(claim.currency, `${path}.currency`, (v, p) => {
          if (typeof v !== "string" || !/^[A-Z]{3}$/.test(v)) issue(p, "shape")
        })
        slot(claim.basis, `${path}.basis`, (v, p) => { choice(v, p, ["exact", "starting", "range"]) })
        if (own(claim, "upperAmount")) slot(claim.upperAmount, `${path}.upperAmount`, numeric)
        const basis = knownValue(claim.basis)
        if (basis === "range" && (!own(claim, "upperAmount") || (objectValue(claim.upperAmount) && claim.upperAmount.state === "notApplicable"))) issue(`${path}.upperAmount`, "range")
        if ((basis === "starting" || basis === "exact") && own(claim, "upperAmount")) issue(`${path}.upperAmount`, "range")
        const lower = knownValue(claim.amount), upper = knownValue(claim.upperAmount)
        if (typeof lower === "string" && typeof upper === "string" && decimal.test(lower) && decimal.test(upper) && decimalGreater(lower, upper)) issue(`${path}.upperAmount`, "range")
        break
      }
      case "discount":
        shape(claim, path, ["type", "reduction"])
        slot(claim.reduction, `${path}.reduction`, quantity)
        break
      case "availability":
        shape(claim, path, ["type", "resource"])
        slot(claim.resource, `${path}.resource`, (v, p) => {
          if (text(v, p) && bindings.get(v)?.role !== "serviceOrItem") issue(p, "reference")
        })
        break
    }
    for (const role of profile.requiredBindings[claim.type as "price" | "discount" | "availability"]) {
      if (![...bindings.values()].some(b => b.role === role)) issue("bindings", "profile")
    }
  })

  if (own(input, "time") && shape(input.time, "time", ["relation", "expressions", "period"], ["relativeReferenceId"])) {
    slot(input.time.relation, "time.relation", (v, p) => { choice(v, p, ["past", "current", "future"]) })
    list(input.time.expressions, "time.expressions", text)
    slot(input.time.period, "time.period", (period, path) => {
      if (!shape(period, path, ["start", "end", "timeZone", "endInclusive"])) return
      for (const key of ["start", "end"] as const) slot(period[key], `${path}.${key}`, (v, p) => {
        // ISO container shape only: no date resolution, inference or clock access.
        if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(v)) issue(p, "shape")
      })
      slot(period.timeZone, `${path}.timeZone`, text)
      slot(period.endInclusive, `${path}.endInclusive`, (v, p) => { if (typeof v !== "boolean") issue(p, "shape") })
    })
    if (own(input.time, "relativeReferenceId")) slot(input.time.relativeReferenceId, "time.relativeReferenceId", reference)
  }
  if (own(input, "qualifiers")) list(input.qualifiers, "qualifiers", (qualifier, path) => {
    if (!shape(qualifier, path, ["kind", "text"])) return
    if (!choice(qualifier.kind, `${path}.kind`, profile.qualifierKinds)) issue(`${path}.kind`, "profile")
    text(qualifier.text, `${path}.text`)
  })
  if (own(input, "reasons")) list(input.reasons, "reasons", (reason, path) => {
    if (!shape(reason, path, ["code", "fields"])) return
    choice(reason.code, `${path}.code`, ["unclearScope"])
    uniqueStrings(reason.fields, `${path}.fields`, existingField, true)
  })

  if (shape(input.interpretation, "interpretation", ["status"], ["unresolvedFields", "abstentionReason"])) {
    choice(input.interpretation.status, "interpretation.status", ["resolved", "partial", "abstained"])
    if (own(input.interpretation, "unresolvedFields")) uniqueStrings(input.interpretation.unresolvedFields, "interpretation.unresolvedFields", existingField, true)
    if (own(input.interpretation, "abstentionReason")) choice(input.interpretation.abstentionReason, "interpretation.abstentionReason", ["insufficientContext", "semanticAmbiguity", "capabilityLimit"])
    if (input.interpretation.status === "resolved" && (own(input.interpretation, "unresolvedFields") || own(input.interpretation, "abstentionReason") || missingInterpretation.size)) issue("interpretation", "interpretation")
    if (input.interpretation.status === "partial" && (!Array.isArray(input.interpretation.unresolvedFields) || !input.interpretation.unresolvedFields.length || own(input.interpretation, "abstentionReason"))) issue("interpretation", "interpretation")
    if (input.interpretation.status === "abstained" && !own(input.interpretation, "abstentionReason")) issue("interpretation.abstentionReason", "interpretation")
    if (input.interpretation.status !== "resolved") {
      const paths = Array.isArray(input.interpretation.unresolvedFields) ? input.interpretation.unresolvedFields : []
      for (const field of missingInterpretation) if (!paths.some(p => typeof p === "string" && (field === p || field.startsWith(`${p}.`)))) issue(field, "interpretation")
    }
  }

  if (shape(input.provenance, "provenance", ["contractVersion", "method"], ["inputRefs", "contextRefs", "interpreter", "fieldOrigins"])) {
    if (input.provenance.contractVersion !== SEMANTIC_OBSERVATION_CONTRACT_VERSION) issue("provenance.contractVersion", "provenance")
    choice(input.provenance.method, "provenance.method", methods)
    if (input.provenance.method !== context.provenance.method) issue("provenance.method", "provenance")
    for (const key of ["inputRefs", "contextRefs"] as const) if (own(input.provenance, key)) uniqueStrings(input.provenance[key], `provenance.${key}`, reference, true)
    if ((input.provenance.method === "structured" || input.provenance.method === "human") && (!Array.isArray(input.provenance.inputRefs) || !input.provenance.inputRefs.length)) issue("provenance.inputRefs", "provenance")
    const modelMethod = input.provenance.method === "jevCandidate" || input.provenance.method === "strongerModel"
    if (modelMethod) {
      if (shape(input.provenance.interpreter, "provenance.interpreter", ["provider", "model", "configurationRef"])) {
        text(input.provenance.interpreter.provider, "provenance.interpreter.provider")
        text(input.provenance.interpreter.model, "provenance.interpreter.model")
        reference(input.provenance.interpreter.configurationRef, "provenance.interpreter.configurationRef")
        const expected = context.provenance.interpreter
        if (!expected || input.provenance.interpreter.provider !== expected.provider || input.provenance.interpreter.model !== expected.model
          || input.provenance.interpreter.configurationRef !== expected.configurationRef) issue("provenance.interpreter", "provenance")
      }
    } else if (own(input.provenance, "interpreter")) issue("provenance.interpreter", "provenance")
    const actualOrigins: FieldOrigin[] = []
    if (own(input.provenance, "fieldOrigins")) list(input.provenance.fieldOrigins, "provenance.fieldOrigins", (origin, path) => {
      if (!shape(origin, path, ["field", "method"], ["sourceRef"])) return
      existingField(origin.field, `${path}.field`)
      choice(origin.method, `${path}.method`, methods)
      if (own(origin, "sourceRef")) reference(origin.sourceRef, `${path}.sourceRef`)
      if (typeof origin.field === "string" && typeof origin.method === "string") actualOrigins.push({
        field: origin.field, method: origin.method as InterpretationMethod,
        ...(typeof origin.sourceRef === "string" ? { sourceRef: origin.sourceRef } : {}),
      })
    }, true)
    const expectedOrigins = context.provenance.fieldOrigins ?? []
    if (new Set(actualOrigins.map(o => o.field)).size !== actualOrigins.length || actualOrigins.length !== expectedOrigins.length
      || expectedOrigins.some(expected => !actualOrigins.some(actual => actual.field === expected.field && actual.method === expected.method && actual.sourceRef === expected.sourceRef))) issue("provenance.fieldOrigins", "provenance")
    for (const origin of actualOrigins) {
      if ((origin.field === "observationId" || origin.field === "propositionId" || origin.field.startsWith("sourceSpans")
        || /^bindings\.\d+\.bindingId$/.test(origin.field)) && origin.method !== "structured" && origin.method !== "deterministic") issue("provenance.fieldOrigins", "provenance")
    }
  }

  return issues.length ? { status: "structurallyInvalid", issues }
    : { status: "structurallyValid", observation: input as unknown as StructurallyCheckedObservation }
}
