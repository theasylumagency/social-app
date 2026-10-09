import type { BoundedSemanticTask, ShadowConfiguration, ShadowLinkage } from "../../src/blueprints/social/semantic-middleware/shadow"
import type { ShadowCollectionInput } from "../../src/application/semantic-middleware/collect-shadow"
import { boundedDecisionRequest } from "../../src/blueprints/social/semantic-middleware/shadow-task"
import { createJevShadowInterpreter } from "../../src/infrastructure/models/jev-semantic-shadow"
import { semanticFixtures } from "./semantic-middleware"

export const fixtureConfiguration: ShadowConfiguration = { provider: "jev", model: "jev-1.13.0", protocolVersion: "unda-semantic-shadow-jev-bounded-v1", executionMode: "fixture",
  configurationRef: "fixture-config:synthetic-smoke-v1", timeoutMs: 100, budgetMs: 2500, maxTasks: 5,
  // Synthetic mechanical check only. These are not measured/recommended production cutoffs.
  policy: { mode: "experimentalDeadZone", low: 0.2, high: 0.8, experimentRef: "local-synthetic-smoke-only" } }
export const fixtureLinkage: ShadowLinkage = { workflowRunId: "fixture-workflow", reviewRunId: "fixture-review", postKey: "p1", channel: "facebook", surface: "caption", committedStep: "ready",
  safetyReviewer: { promptVersion: "fixture-existing-review", outcome: { summary: "Existing fixture review", issues: [] } }, consolidatedReviewer: { outcome: { summary: "Existing fixture review", issues: [] } } }
export function phase7aShadowInputs(): ShadowCollectionInput[] {
  return semanticFixtures.flatMap<ShadowCollectionInput>(fixture => fixture.observations.length ? fixture.observations.map(({ observation }) => {
    const fixtureRef = "fixture-context:" + fixture.id
    const task: BoundedSemanticTask = { observationId: observation.observationId + "/shadow", propositionId: observation.propositionId, source: fixture.source, spans: observation.sourceSpans,
      anchorMethod: "structured", anchorRule: "structuredFixture:v1", contextRefs: [fixtureRef], families: ["price", "discount", "availability"],
      normalizedProposition: observation.normalizedProposition, presentation: observation.presentation, attribution: observation.attribution, claimCandidates: observation.claims,
      bindings: (observation.bindings ?? []).map(b => {
        const isElliptical = b.role === "serviceOrItem" && fixture.id === "branchPrices" && observation.propositionId.endsWith("p2")
        return { bindingId: b.bindingId, role: b.role as "serviceOrItem" | "branchOrPlace", ...(isElliptical ? { capabilityLimit: "ellipticalBinding" as const } : {}),
          candidates: b.target.state === "known" ? [{ candidateId: b.bindingId, value: b.target.value,
            grounding: isElliptical ? "elliptical" as const : observation.sourceSpans.some(s => s.excerpt.includes(b.target.state === "known" ? b.target.value.mention : "")) ? "explicitMention" as const : "applicationEstablished" as const,
            contextRef: fixtureRef }] : [] }
      }), ...(observation.time ? { time: observation.time } : {}), ...(observation.qualifiers ? { qualifiers: observation.qualifiers } : {}) }
    return { source: fixture.source, task, linkage: { ...fixtureLinkage, workflowRunId: "fixture:" + fixture.id } }
  }) : [{ source: fixture.source, task: null, linkage: { ...fixtureLinkage, workflowRunId: "fixture:" + fixture.id } }])
}
export function fixtureProbabilities(input: ShadowCollectionInput): Record<string, number> {
  if (!input.task) return {}
  const original = semanticFixtures.flatMap(f => f.observations).find(f => f.observation.propositionId === input.task!.propositionId)!.observation
  return Object.fromEntries(boundedDecisionRequest(input.task).targets.map(target => [target.key, target.kind === "family" ? original.claims.some(c => c.type === target.family) ? 0.95 : 0.05
    : target.kind === "polarity" ? original.polarity.state === "known" && original.polarity.value === target.value ? 0.95 : 0.05 : 0.95]))
}
/** Real adapter/validator, synthetic HTTP response; NEVER provider quality evidence. */
export function fixtureJevInterpreter(input: ShadowCollectionInput, overrides: Readonly<Record<string, number>> = {}) {
  const mockFetch: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { questions: Record<string, unknown> }
    const probabilities = { ...fixtureProbabilities(input), ...overrides }
    return Response.json({ model: fixtureConfiguration.model, answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, { type: "noul", noul: probabilities[key] }])), usage: { input_tokens: 0, output_tokens: 0 } })
  }
  return createJevShadowInterpreter("FIXTURE_NOT_A_CREDENTIAL", fixtureConfiguration.model, mockFetch)
}
