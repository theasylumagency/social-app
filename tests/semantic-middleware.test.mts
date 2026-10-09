import assert from "node:assert/strict"
import test from "node:test"
import { checkSemanticObservationContract } from "../src/blueprints/social/semantic-middleware/check-contract"
import { PHASE_7A_PROFILE } from "../src/blueprints/social/semantic-middleware/profile"
import { projectSemanticFactMatches, projectSemanticSafetyReview } from "../src/blueprints/social/semantic-middleware/projections"
import type { SemanticContractContext } from "../src/blueprints/social/semantic-middleware/contract"
import { exactPrice, known, semanticFixtures, unavailable, unknown, type AnchoredFixtureObservation } from "./fixtures/semantic-middleware"

const remove = Symbol("remove")
function changed(base: AnchoredFixtureObservation, field: string, value: unknown): unknown {
  const clone = structuredClone(base.observation) as unknown as Record<string, unknown>
  const parts = field.split(".")
  let target = clone
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>
  const leaf = parts.at(-1)!
  if (value === remove) delete target[leaf]
  else target[leaf] = value
  return clone
}
function checked(base = exactPrice, input: unknown = base.observation, context = base.context) {
  const result = checkSemanticObservationContract(input, context)
  assert.equal(result.status, "structurallyValid", JSON.stringify(result))
  if (result.status !== "structurallyValid") throw Error("Unexpected invalid fixture")
  return result.observation
}
function invalid(base: AnchoredFixtureObservation, input: unknown, code?: string, context = base.context) {
  const result = checkSemanticObservationContract(input, context)
  assert.equal(result.status, "structurallyInvalid", JSON.stringify(input))
  if (result.status !== "structurallyInvalid") throw Error("Expected structural rejection")
  if (code) assert.ok(result.issues.some(i => i.code === code), JSON.stringify(result))
}

test("all supplied Georgian anchors pass structural checks; fixtures contain no model provenance", () => {
  for (const fixture of semanticFixtures) for (const item of fixture.observations) {
    const result = checked(item)
    assert.ok(["structured", "deterministic", "human"].includes(result.provenance.method))
    assert.equal(result.provenance.interpreter, undefined)
  }
})

test("known, unknown, N/A and unresolved remain distinct; null and mixed slot fields fail", () => {
  for (const slot of [known("150"), unknown, { state: "notApplicable" }]) {
    const result = checked(exactPrice, changed(exactPrice, "claims.0.amount", slot))
    assert.deepEqual(projectSemanticFactMatches(result)[0]!.claim, { ...exactPrice.observation.claims[0], amount: slot })
  }
  const partial = { ...exactPrice.observation, claims: [{ type: "price", amount: { state: "unresolved", alternatives: ["150", "180"] }, currency: known("GEL"), basis: known("exact") }], interpretation: { status: "partial", unresolvedFields: ["claims.0.amount"] } }
  assert.deepEqual(projectSemanticFactMatches(checked(exactPrice, partial))[0]!.claim, partial.claims[0])
  for (const slot of [null, false, "", {}, { state: "known", value: null }, { state: "unknown" }, { state: "unknown", reason: "notStated", value: "150" }, { state: "notApplicable", value: "150" }, { state: "unresolved", value: "150" }, { state: "unresolved", alternatives: [] }]) invalid(exactPrice, changed(exactPrice, "claims.0.amount", slot))
})

test("optional omission is preserved and differs from explicit empty, unknown and undefined", () => {
  const base = checked()
  assert.equal(Object.hasOwn(projectSemanticSafetyReview(base), "time"), false)
  assert.equal(Object.hasOwn(projectSemanticFactMatches(base)[0]!, "qualifiers"), false)
  const empty = checked(exactPrice, { ...exactPrice.observation, qualifiers: [] })
  assert.deepEqual(projectSemanticSafetyReview(empty).qualifiers, [])
  const temporal = checked(exactPrice, { ...exactPrice.observation, time: { relation: unknown, expressions: [], period: { state: "notApplicable" } } })
  assert.deepEqual(projectSemanticFactMatches(temporal)[0]!.time?.relation, unknown)
  invalid(exactPrice, { ...exactPrice.observation, time: undefined }, "shape")
  invalid(exactPrice, { ...exactPrice.observation, qualifiers: null }, "shape")
})

test("source identity, current revision, bounds and exact Unicode code-point excerpts are enforced", () => {
  const fixture = semanticFixtures.find(f => f.id === "nonBmp")!.observations[0]!
  const valid = checked(fixture)
  assert.equal(valid.sourceSpans[0]!.start, 2) // emoji + space, not three UTF-16 units
  assert.equal(Array.from(fixture.context.sources[0]!.text).slice(valid.sourceSpans[0]!.start, valid.sourceSpans[0]!.end).join(""), valid.sourceSpans[0]!.excerpt)
  for (const [field, value] of [["start", 3], ["start", -1], ["start", 0.5], ["end", 999], ["end", 2], ["sourceId", "other"], ["revisionId", "stale"], ["excerpt", "ფასი სხვაა"]] as const) invalid(fixture, changed(fixture, `sourceSpans.0.${field}`, value), "span")
  invalid(fixture, fixture.observation, "span", { ...fixture.context, sources: [{ ...fixture.context.sources[0]!, revisionId: "revision2" }] })
  invalid(fixture, changed(fixture, "sourceSpans", []))
  // Even another exact substring cannot replace the caller's independently supplied anchor.
  const source = fixture.context.sources[0]!
  invalid(fixture, changed(fixture, "sourceSpans", [{ sourceId: source.sourceId, revisionId: source.revisionId, start: 0, end: 1, excerpt: "😀" }]), "identity")
})

test("caller owns observation, proposition and binding identities", () => {
  invalid(exactPrice, changed(exactPrice, "observationId", "minted"), "identity")
  invalid(exactPrice, changed(exactPrice, "propositionId", "minted"), "identity")
  invalid(exactPrice, changed(exactPrice, "bindings.0.bindingId", "minted"), "identity")
  invalid(exactPrice, { ...exactPrice.observation, bindings: [...exactPrice.observation.bindings!, exactPrice.observation.bindings![0]!] }, "identity")
})

test("registry ownership requires trusted exact identity resolution, never declared provenance alone", () => {
  const input = changed(exactPrice, "bindings.0.target.value.registryId", "registry-service")
  invalid(exactPrice, input, "provenance")
  const resolution = { bindingId: "service1", mention: "კონსულტაცია", registryId: "registry-service", method: "structured" as const, sourceRef: exactPrice.context.provenance.refs[0]! }
  const context: SemanticContractContext = { ...exactPrice.context, registryResolutions: [resolution] }
  assert.equal(checked(exactPrice, input, context).bindings![0]!.target.state, "known")
  invalid(exactPrice, input, "provenance", { ...context, registryResolutions: [{ ...resolution, mention: "სხვა სერვისი" }] })
  invalid(exactPrice, input, "provenance", { ...context, registryResolutions: [{ ...resolution, method: "deterministic" }] })
  const declared = { ...input as object, provenance: { ...exactPrice.observation.provenance, fieldOrigins: [{ field: "bindings.0.target.value.registryId", method: "structured", sourceRef: resolution.sourceRef }] } }
  invalid(exactPrice, declared, "provenance")
  const origin = { field: "bindings.0.target.value.registryId", method: "structured" as const, sourceRef: resolution.sourceRef }
  checked(exactPrice, declared, { ...context, provenance: { ...context.provenance, fieldOrigins: [origin] } })
  // A future model method cannot self-declare an S/D override; no provider adapter is invoked.
  invalid(exactPrice, { ...declared, provenance: { ...exactPrice.observation.provenance, method: "jevCandidate" } }, "provenance", { ...context, provenance: { ...context.provenance, method: "jevCandidate" } })
})

test("unique family objects, bounded profile fields and service bindings are enforced", () => {
  invalid(exactPrice, { ...exactPrice.observation, claims: [exactPrice.observation.claims[0], exactPrice.observation.claims[0]] }, "shape")
  for (const field of ["supported", "publishable", "severity", "routing", "confidence", "modality", "claimTypes"]) invalid(exactPrice, { ...exactPrice.observation, [field]: true })
  for (const family of ["openingHours", "clinicalOutcome", "descriptiveAssertion", "campaignPeriod", "inventory"]) invalid(exactPrice, changed(exactPrice, "claims.0.type", family), "profile")
  invalid(exactPrice, changed(exactPrice, "bindings", []), "profile")
  invalid(exactPrice, changed(exactPrice, "bindings.0.role", "comparator"), "profile")
  invalid(exactPrice, changed(exactPrice, "claims.0.supported", true), "fieldNotRequested")
  const narrower = { ...PHASE_7A_PROFILE, fields: PHASE_7A_PROFILE.fields.filter(f => f !== "time") }
  const result = checkSemanticObservationContract(unavailable.observation, unavailable.context, narrower)
  assert.equal(result.status, "structurallyInvalid")
})

test("decimal strings and range bounds are validated without floating-point rounding", () => {
  for (const value of [150, "150,00", "1e2", "NaN", "-1", "+150", "0150", "150.", " 150"]) invalid(exactPrice, changed(exactPrice, "claims.0.amount.value", value), "numeric")
  const range = (lower: string, upper: unknown = known("180")) => ({ ...exactPrice.observation, claims: [{ type: "price", amount: known(lower), currency: known("GEL"), basis: known("range"), upperAmount: upper }] })
  checked(exactPrice, range("150"))
  checked(exactPrice, range("150", unknown)) // missing upper bound stays missing
  checked(exactPrice, range("150.00", known("150")))
  invalid(exactPrice, range("181"), "range")
  invalid(exactPrice, range("9007199254740993.0000000000000002", known("9007199254740993.0000000000000001")), "range")
  checked(exactPrice, range("9007199254740993.0000000000000001", known("9007199254740993.0000000000000002")))
  invalid(exactPrice, range("150", { state: "notApplicable" }), "range")
  invalid(exactPrice, changed(exactPrice, "claims.0.basis.value", "range"), "range")
  invalid(exactPrice, { ...exactPrice.observation, claims: [{ ...exactPrice.observation.claims[0]!, upperAmount: known("180") }] }, "range")
  invalid(exactPrice, changed(exactPrice, "claims.0.currency.value", "lari"), "shape")
})

test("discount quantity and consumer-required qualifiers retain exact conditions and eligibility", () => {
  const fixture = semanticFixtures.find(f => f.id === "qualifiedDiscount")!.observations[0]!
  const qualifiers = [{ kind: "condition", text: "წინასწარი გადახდით" }, { kind: "eligibility", text: "ახალი პაციენტებისთვის" }]
  const value = checked(fixture, { ...fixture.observation, qualifiers })
  assert.deepEqual(projectSemanticFactMatches(value)[0]!.qualifiers, qualifiers)
  invalid(fixture, changed(fixture, "claims.0.reduction.value.value", "20%"), "numeric")
  invalid(fixture, { ...fixture.observation, qualifiers: [{ kind: "measurementBasis", text: "სხვა მეთოდთან შედარებით" }] }, "profile")
  invalid(fixture, { ...fixture.observation, qualifiers: [{ kind: "eligibility", text: "" }] }, "shape")
})

test("availability projection uses polarity and resource binding, without an invented zero", () => {
  const projection = projectSemanticFactMatches(checked(unavailable))[0]!
  assert.equal(projection.claim.type, "availability")
  if (projection.claim.type !== "availability") throw Error("Wrong family")
  assert.deepEqual(projection.claim.availabilityState, known("unavailable"))
  assert.equal(Object.hasOwn(projection.claim, "quantity"), false)
  invalid(unavailable, changed(unavailable, "claims.0.resource.value", "missing"), "reference")
  invalid(unavailable, { ...unavailable.observation, bindings: [{ ...unavailable.observation.bindings![0]!, role: "branchOrPlace" }] }, "reference")
  const unknownPolarity = checked(unavailable, { ...unavailable.observation, polarity: unknown })
  const unknownView = projectSemanticFactMatches(unknownPolarity)[0]!
  if (unknownView.claim.type !== "availability") throw Error("Wrong family")
  assert.deepEqual(unknownView.claim.availabilityState, unknown)
  const ambiguous = checked(unavailable, { ...unavailable.observation, polarity: { state: "unresolved", alternatives: ["affirmed", "negated"] }, interpretation: { status: "partial", unresolvedFields: ["polarity"] } })
  const ambiguousView = projectSemanticFactMatches(ambiguous)[0]!
  if (ambiguousView.claim.type !== "availability") throw Error("Wrong family")
  assert.deepEqual(ambiguousView.claim.availabilityState, { state: "unresolved", alternatives: ["available", "unavailable"] })
})

test("hours negative control has no supplied availability observation and no inferred capacity", () => {
  const fixture = semanticFixtures.find(f => f.id === "openingHours")!
  assert.equal(fixture.observations.length, 0)
  assert.deepEqual(fixture.observations.flatMap(item => projectSemanticFactMatches(checked(item))), [])
  // Shape validation rejects an out-of-slice family; it does not claim linguistic accuracy.
  invalid(exactPrice, changed(exactPrice, "claims.0.type", "openingHours"), "profile")
})

test("mixed temporal clauses stay three propositions with independent polarity and branch scope", () => {
  const fixture = semanticFixtures.find(f => f.id === "mixedDiscount")!
  const views = fixture.observations.map(item => projectSemanticFactMatches(checked(item))[0]!)
  assert.equal(new Set(views.map(v => v.propositionId)).size, 3)
  assert.deepEqual(views.map(v => v.polarity), [known("affirmed"), known("negated"), known("affirmed")])
  assert.deepEqual(views.map(v => v.time!.relation), [known("past"), known("current"), known("future")])
  assert.equal(views[0]!.bindings!.some(b => b.role === "branchOrPlace"), false)
  assert.equal(views[1]!.bindings!.some(b => b.role === "branchOrPlace"), false)
  assert.deepEqual(views[2]!.bindings!.find(b => b.role === "branchOrPlace")!.target, known({ mention: "ვაკის ფილიალი" }))
  for (const view of views) assert.deepEqual(view.time!.relativeReferenceId, { state: "unknown", reason: "notSupplied" })
})

test("two branch prices remain separate and retain starting-price basis where supplied", () => {
  const fixture = semanticFixtures.find(f => f.id === "branchPrices")!
  const views = fixture.observations.map(item => projectSemanticFactMatches(checked(item))[0]!)
  assert.deepEqual(views.map(v => v.claim.type === "price" ? v.claim.amount : null), [known("150"), known("180")])
  assert.deepEqual(views.map(v => v.bindings!.find(b => b.role === "branchOrPlace")!.target), [known({ mention: "ვაკის ფილიალი" }), known({ mention: "საბურთალოს ფილიალი" })])
  const starting = semanticFixtures.find(f => f.id === "startingPrice")!.observations[0]!
  assert.deepEqual(projectSemanticFactMatches(checked(starting))[0]!.claim, starting.observation.claims[0])
})

test("time containers and relative references never supply a default date or clock", () => {
  const view = projectSemanticFactMatches(checked(unavailable))[0]!
  assert.deepEqual(view.time!.period, unknown)
  assert.deepEqual(view.time!.relativeReferenceId, { state: "unknown", reason: "notSupplied" })
  invalid(unavailable, changed(unavailable, "time.relativeReferenceId", known("machine-now")), "reference")
  const period = { start: known("2026-10-03"), end: known("2026-10-10"), timeZone: known("Asia/Tbilisi"), endInclusive: known(true) }
  checked(unavailable, changed(unavailable, "time.period", known(period)))
  invalid(unavailable, changed(unavailable, "time.period", known({ ...period, start: known("tomorrow") })), "shape")
  invalid(unavailable, changed(unavailable, "time.period", known({ ...period, endInclusive: known("true") })), "shape")
})

test("interpretation, field paths and provenance must be consistent and caller-owned", () => {
  invalid(exactPrice, changed(exactPrice, "claims.0.amount", { state: "unresolved" }), "interpretation")
  invalid(exactPrice, changed(exactPrice, "claims.0.amount", { state: "unknown", reason: "notEvaluated" }), "interpretation")
  invalid(exactPrice, changed(exactPrice, "interpretation", { status: "partial", unresolvedFields: [] }))
  invalid(exactPrice, changed(exactPrice, "interpretation", { status: "abstained" }), "interpretation")
  const abstained = checked(exactPrice, { ...exactPrice.observation, claims: [], normalizedProposition: { state: "unresolved" }, interpretation: { status: "abstained", abstentionReason: "insufficientContext", unresolvedFields: ["normalizedProposition"] } })
  assert.deepEqual(projectSemanticFactMatches(abstained), [])
  assert.deepEqual(projectSemanticSafetyReview(abstained).interpretation, { status: "abstained", unresolvedFields: ["normalizedProposition"] })
  invalid(exactPrice, changed(exactPrice, "interpretation", { status: "partial", unresolvedFields: ["nonexistent"] }), "reference")
  invalid(exactPrice, changed(exactPrice, "provenance.contractVersion", "v2"), "provenance")
  invalid(exactPrice, changed(exactPrice, "provenance.inputRefs", remove), "provenance")
  invalid(exactPrice, changed(exactPrice, "provenance.contextRefs", ["invented"]), "reference")
  invalid(exactPrice, changed(exactPrice, "provenance.method", "human"), "provenance")
  invalid(exactPrice, changed(exactPrice, "provenance.method", "strongerModel"))
  invalid(exactPrice, changed(exactPrice, "provenance.interpreter", {}))
})

test("unresolved service bindings and scope reasons do not become invented identities", () => {
  const fixture = semanticFixtures.find(f => f.id === "deniedDiscount")!.observations[0]!
  const target = { state: "unresolved", alternatives: [{ mention: "კონსულტაცია" }, { mention: "პროცედურა" }] }
  const result = checked(fixture, { ...fixture.observation, bindings: [{ ...fixture.observation.bindings![0]!, target }], reasons: [{ code: "unclearScope", fields: ["bindings.0.target"] }], interpretation: { status: "partial", unresolvedFields: ["bindings.0.target"] } })
  assert.deepEqual(projectSemanticFactMatches(result)[0]!.bindings![0]!.target, target)
  invalid(fixture, { ...fixture.observation, reasons: [{ code: "vagueQuantifier", fields: ["bindings"] }] }, "shape")
})

test("projections are detached whitelists; structural success does not certify meaning or support", () => {
  const before = JSON.stringify(exactPrice)
  const value = checked()
  const safety = projectSemanticSafetyReview(value)
  const fact = projectSemanticFactMatches(value)[0]!
  assert.equal(Object.hasOwn(safety, "provenance"), false)
  for (const output of [safety, fact]) for (const field of ["confidence", "routing", "supported", "authorized", "publishable"]) assert.equal(Object.hasOwn(output, field), false)
  assert.deepEqual(Object.keys(fact).sort(), ["bindings", "claim", "polarity", "propositionId", "trace"])
  assert.notEqual(safety.claims, value.claims)
  assert.notEqual(fact.bindings, value.bindings)
  assert.equal(JSON.stringify(exactPrice), before)
  // Deliberately wrong linguistic kernel still passes shape: this checker is not a model.
  const structurallyValid = checked(exactPrice, changed(exactPrice, "normalizedProposition", known("ფასი არ არის 150 ლარი.")))
  assert.deepEqual(structurallyValid.normalizedProposition, known("ფასი არ არის 150 ლარი."))
})
