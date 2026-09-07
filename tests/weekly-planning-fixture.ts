import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { emptyDiscovery, type BrandDossier, type DiscoverySession } from "../src/blueprints/social/brand-discovery/model"
import type { PlanningRun, PlanningPayload } from "../src/blueprints/social/weekly-planning/model"
import type { BrandModelCall, BrandReasoner } from "../src/infrastructure/models/brand-reasoning"
import { advanceWeeklyPlanning } from "../src/application/weekly-planning/advance"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"
import { completeFixture, note } from "./brand-discovery-fixture"

export async function discoveryFixture(): Promise<DiscoverySession> {
  const initial: DiscoverySession = { id: randomUUID(), ownerId: "owner", brandId: null, revision: 1, status: "queued", step: "sources", payload: emptyDiscovery({ website: "", notes: note, language: "ka" }), error: null, updatedAt: "2026-09-06T10:00:00.000Z", leaseUntil: null }
  return completeFixture(initial)
}
export async function planningFixture(): Promise<PlanningRun> {
  const discovery = await discoveryFixture()
  discovery.payload.feedback.selectedGoalIds = [discovery.payload.goals[0]!.id]
  const basis: BrandDossier = { sessionId: discovery.id, revision: 1, confirmedAt: "2026-09-06T10:00:00.000Z", payload: discovery.payload }
  return { id: randomUUID(), ownerId: "owner", brandId: `brand:${discovery.id}`, week: "2026-09-07", version: 1, status: "queued", step: "objective", error: null, leaseUntil: null, createdAt: "2026-09-06T10:00:00.000Z", updatedAt: "2026-09-06T10:00:00.000Z", payload: { basis, priority: "", revisionNote: "", previousVersion: null, priorWeeks: [], plannedOn: "2026-09-06", objective: null, focus: null, directions: [], adaptation: [], experiment: null, review: null, plan: null } }
}
export function planningOutput(call: BrandModelCall): unknown {
  if (call.step === "weekly_strategy") return {
    ...(planningOutput({ ...call, step: "weekly_objective" }) as object),
    ...(planningOutput({ ...call, step: "weekly_focus" }) as object),
    ...(planningOutput({ ...call, step: "weekly_directions" }) as object),
    audienceDirections: (planningOutput({ ...call, step: "weekly_adaptation" }) as { directions: unknown }).directions,
    ...(planningOutput({ ...call, step: "weekly_experiment" }) as object),
  }
  if (call.step === "weekly_objective") return { weeklyObjective: { objective: "ნივთის მფლობელმა გაარჩიოს, რა შეიძლება გაირკვეს ფოტოებით და რა მოითხოვს ადგილზე შეფასებას.", rationale: "სახელოსნოში არჩევანი იწყება დაზიანების შეფასებით, არა წინასწარი შედეგის დაპირებით.", deliberateOmissions: ["შეფასებამდე საბოლოო შედეგისა და ფასის დაპირება"] } }
  if (call.step === "weekly_focus") return { focus: { primaryAudienceKey: "a1", secondaryAudienceKeys: [], rationale: "შეკეთებასა და ჩანაცვლებას შორის მყოფ მფლობელს ჯერ შეფასების საზღვრები სჭირდება." } }
  if (call.step === "weekly_directions") return { directions: [
    { direction: "რას აჩვენებს დაზიანების ფოტო", purpose: "მფლობელმა მოამზადოს შეფასებისთვის გამოსადეგი ინფორმაცია", rationale: "სახელოსნო ფოტოების მიღებით იწყებს შეფასებას" },
    { direction: "რისი დაზუსტება ხდება მხოლოდ ნივთის ადგილზე ნახვისას", purpose: "ფოტოზე დანახული შესაძლებლობა გარანტიად არ იქცეს", rationale: "დაზიანების ხასიათი განსაზღვრავს შეკეთების საზღვრებს" },
    { direction: "როდის აქვს აზრი ძველი ფაქტურის შენარჩუნებას", purpose: "მფლობელმა გაარჩიოს აღდგენა ახლის ეფექტისგან", rationale: "სახელოსნო პირვანდელი ფაქტურის შენარჩუნებაზე მუშაობს" },
  ] }
  if (call.step === "weekly_adaptation") return { directions: ["d1", "d2", "d3"].map((contentDirectionKey) => ({ contentDirectionKey, primaryAudienceKey: "a1", secondaryAudienceKeys: [], bias: contentDirectionKey === "d1" ? "morePractical" : "moreExplanatory" })) }
  if (call.step === "weekly_experiment") return { experimentDecision: { decision: "noExperiment", rationale: "ჯერ შეფასების პროცესი უნდა გახდეს გასაგები; დაკვირვების მონაცემები არ მოგვეწოდა.", experiment: { hypothesis: null, variable: null, comparison: null, learningSignal: null, guardrails: [] } } }
  if (call.step === "weekly_review") return { brandGoalKeys: ["g1"], progressSignals: ["მფლობელი აგზავნის დაზიანების ახლო ფოტოს", "შეკითხვა განასხვავებს შეფასებას გარანტიისგან"], checks: { brandSpecificity: "შეფასება და ფაქტურის შენარჩუნება სახელოსნოს პროცესს ეყრდნობა", focusCoherence: "სამი მიმართულება განსხვავებულ შეფასების კითხვას პასუხობს", voiceCompatibility: "ხელობის დეტალები განიმარტება მშვიდად", evidenceDiscipline: "არც შედეგი და არც კლიენტის გამოხმაურება არ არის გამოგონილი", priorityResponse: "მიზანი დადასტურებულ ბრენდის მიზანს აგრძელებს" }, concerns: [] }
  throw new Error(`Unexpected planning step: ${call.step}`)
}
export function planningReasoner(calls: BrandModelCall[] = []): BrandReasoner {
  return async <T>(call: BrandModelCall) => {
    calls.push(call)
    const value = planningOutput(call)
    assert.deepEqual(validateSchema(value, call.schema), [])
    assert.deepEqual(call.validate?.(value) ?? [], [])
    return value as T
  }
}
export async function completePlanningFixture(run: PlanningRun, calls: BrandModelCall[] = []): Promise<PlanningRun> {
  let current = structuredClone(run)
  while (current.step !== "ready") {
    const next: { payload: PlanningPayload; step: PlanningRun["step"] } = await advanceWeeklyPlanning(current, planningReasoner(calls), "2026-09-06T10:15:00.000Z")
    current = { ...current, ...next, status: next.step === "ready" ? "ready" : "queued" }
  }
  return current
}
