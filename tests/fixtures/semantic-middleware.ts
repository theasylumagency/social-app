import {
  SEMANTIC_OBSERVATION_CONTRACT_VERSION,
  type Binding, type SemanticSourceRevision, type Slot, type SourceSpan, type TemporalScope,
} from "../../src/core/domain/semantic-observation"
import type { Phase7aClaim, Phase7aObservation, SemanticContractContext } from "../../src/blueprints/social/semantic-middleware/contract"

export const known = <T>(value: T): Slot<T> => ({ state: "known", value })
export const unknown: Slot<never> = { state: "unknown", reason: "notStated" }
export const service: Binding = { bindingId: "service1", role: "serviceOrItem", target: known({ mention: "კონსულტაცია" }) }
export const unknownService: Binding = { bindingId: "service1", role: "serviceOrItem", target: unknown }
export const price = (amount: string, basis: "exact" | "starting" = "exact"): Phase7aClaim => ({
  type: "price", amount: known(amount), currency: known("GEL"), basis: known(basis),
})
export const discount: Phase7aClaim = { type: "discount", reduction: known({ value: "20", unit: known("percent") }) }

export type AnchoredFixtureObservation = { readonly observation: Phase7aObservation; readonly context: SemanticContractContext }
export type SemanticFixture = {
  readonly id: string
  readonly source: SemanticSourceRevision
  readonly observations: readonly AnchoredFixtureObservation[]
}

/** Exact excerpt explicitly selected by fixture author, not discovered by a scanner. */
function anchor(source: SemanticSourceRevision, excerpt: string): SourceSpan {
  const utf16Start = source.text.indexOf(excerpt)
  if (utf16Start < 0) throw Error("Fixture excerpt is absent")
  const start = Array.from(source.text.slice(0, utf16Start)).length
  return { sourceId: source.sourceId, revisionId: source.revisionId, start, end: start + Array.from(excerpt).length, excerpt }
}
function time(relation: "past" | "current" | "future", expression?: string): TemporalScope {
  return {
    relation: known(relation), expressions: expression ? [expression] : [], period: unknown,
    ...(expression ? { relativeReferenceId: { state: "unknown" as const, reason: "notSupplied" as const } } : {}),
  }
}
function observation(
  source: SemanticSourceRevision, id: string, excerpt: string, kernel: string,
  claims: readonly Phase7aClaim[], polarity: "affirmed" | "negated",
  bindings: readonly Binding[], temporal?: TemporalScope,
  method: "structured" | "deterministic" | "human" = "deterministic",
): AnchoredFixtureObservation {
  const span = anchor(source, excerpt)
  const sourceRef = `${source.sourceId}/${source.revisionId}`
  const result: Phase7aObservation = {
    observationId: `${source.sourceId}/${id}/attempt1`, propositionId: `${source.sourceId}/${id}`,
    sourceSpans: [span], normalizedProposition: known(kernel), presentation: known("assertion"),
    claims, polarity: known(polarity), attribution: { mode: known("firstParty"), adoption: known("adopted") },
    bindings, ...(temporal ? { time: temporal } : {}), interpretation: { status: "resolved" },
    provenance: {
      contractVersion: SEMANTIC_OBSERVATION_CONTRACT_VERSION, method,
      contextRefs: [sourceRef], ...(method !== "deterministic" ? { inputRefs: [sourceRef] } : {}),
    },
  }
  return {
    observation: result,
    context: {
      observationId: result.observationId, anchor: { propositionId: result.propositionId, sourceSpans: [span] },
      sources: [source], bindingIds: bindings.map(b => b.bindingId), provenance: { method, refs: [sourceRef] },
    },
  }
}
const source = (id: string, text: string): SemanticSourceRevision => ({ sourceId: id, revisionId: "revision1", text })

export const exactPriceSource = source("exactPrice", "კონსულტაცია 150 ლარი ღირს.")
export const exactPrice = observation(exactPriceSource, "p1", exactPriceSource.text, "კონსულტაცია 150 ლარი ღირს.", [price("150")], "affirmed", [service], undefined, "structured")
const starting = source("startingPrice", "კონსულტაციის ფასი 150 ლარიდან იწყება.")
const ended = source("endedDiscount", "კონსულტაციაზე 20%-იანი ფასდაკლება დასრულდა.")
const denied = source("deniedDiscount", "20%-იანი ფასდაკლება აღარ მოქმედებს.")
export const capacitySource = source("unavailable", "დღეს კონსულტაციაზე თავისუფალი ადგილები არ არის.")
export const unavailable = observation(capacitySource, "p1", capacitySource.text, "დღეს კონსულტაციაზე თავისუფალი ადგილები არის.", [{ type: "availability", resource: known("service1") }], "negated", [service], time("current", "დღეს"))
const hours = source("openingHours", "კლინიკა ორშაბათიდან შაბათამდე მუშაობს.")
const mixed = source("mixedDiscount", "გასულ კვირას 20%-იანი ფასდაკლება მოქმედებდა, ახლა აღარ მოქმედებს, მომავალ კვირას ვაკის ფილიალში ისევ იმოქმედებს.")
const branches = source("branchPrices", "ვაკის ფილიალში კონსულტაცია 150 ლარი ღირს, საბურთალოს ფილიალში — 180 ლარი.")
const branch = (id: string, mention: string): Binding => ({ bindingId: id, role: "branchOrPlace", target: known({ mention }) })
const nonBmp = source("nonBmp", "😀 კონსულტაცია 150 ლარი ღირს.")
const qualified = source("qualifiedDiscount", "ახალი პაციენტებისთვის კონსულტაციაზე 20%-იანი ფასდაკლება მოქმედებს წინასწარი გადახდით.")

/** Test-only supplied interpretations. No demo facts, Proof or model provenance. */
export const semanticFixtures: readonly SemanticFixture[] = [
  { id: "exactPrice", source: exactPriceSource, observations: [exactPrice] },
  { id: "startingPrice", source: starting, observations: [observation(starting, "p1", starting.text, starting.text, [price("150", "starting")], "affirmed", [service])] },
  { id: "endedDiscount", source: ended, observations: [observation(ended, "p1", ended.text, "კონსულტაციაზე 20%-იანი ფასდაკლება მოქმედებს.", [discount], "negated", [service], time("current"))] },
  { id: "deniedDiscount", source: denied, observations: [observation(denied, "p1", denied.text, "20%-იანი ფასდაკლება მოქმედებს.", [discount], "negated", [unknownService], time("current"), "human")] },
  { id: "unavailable", source: capacitySource, observations: [unavailable] },
  // Caller supplies no capacity proposition. This is not a semantic classifier test.
  { id: "openingHours", source: hours, observations: [] },
  { id: "mixedDiscount", source: mixed, observations: [
    observation(mixed, "p1", "გასულ კვირას 20%-იანი ფასდაკლება მოქმედებდა", "20%-იანი ფასდაკლება მოქმედებს.", [discount], "affirmed", [unknownService], time("past", "გასულ კვირას")),
    observation(mixed, "p2", "ახლა აღარ მოქმედებს", "20%-იანი ფასდაკლება მოქმედებს.", [discount], "negated", [unknownService], time("current", "ახლა")),
    observation(mixed, "p3", "მომავალ კვირას ვაკის ფილიალში ისევ იმოქმედებს.", "ვაკის ფილიალში 20%-იანი ფასდაკლება მოქმედებს.", [discount], "affirmed", [unknownService, branch("vake", "ვაკის ფილიალი")], time("future", "მომავალ კვირას")),
  ] },
  { id: "branchPrices", source: branches, observations: [
    observation(branches, "p1", "ვაკის ფილიალში კონსულტაცია 150 ლარი ღირს", "ვაკის ფილიალში კონსულტაცია 150 ლარი ღირს.", [price("150")], "affirmed", [service, branch("vake", "ვაკის ფილიალი")]),
    observation(branches, "p2", "საბურთალოს ფილიალში — 180 ლარი.", "საბურთალოს ფილიალში კონსულტაცია 180 ლარი ღირს.", [price("180")], "affirmed", [service, branch("saburtalo", "საბურთალოს ფილიალი")]),
  ] },
  { id: "nonBmp", source: nonBmp, observations: [observation(nonBmp, "p1", "კონსულტაცია 150 ლარი ღირს.", "კონსულტაცია 150 ლარი ღირს.", [price("150")], "affirmed", [service])] },
  { id: "qualifiedDiscount", source: qualified, observations: [observation(qualified, "p1", qualified.text, "კონსულტაციაზე 20%-იანი ფასდაკლება მოქმედებს.", [discount], "affirmed", [service])] },
]
