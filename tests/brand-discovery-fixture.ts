import assert from "node:assert/strict"
import type { BrandUnderstanding, DiscoverySession } from "../src/blueprints/social/brand-discovery/model"
import type { BrandModelCall, BrandReasoner } from "../src/infrastructure/models/brand-reasoning"
import { advanceDiscovery } from "../src/application/brand-discovery/advance"
import { validateSchema } from "../src/blueprints/social/brand-discovery/validation"

export const note = "Workshop repairs leather bags, shoes, and accessories. Customers send photographs before receiving a repair estimate. We retain patina and show stitching before and after repair."
const citation = { sourceKey: "founder", exactExcerpt: "Workshop repairs leather bags, shoes, and accessories." }
export const understanding: BrandUnderstanding = {
  name: "Workshop", summary: "ტყავის ნივთების სახელოსნო წინასწარი შეფასებითა და თავდაპირველი ფაქტურის შენარჩუნებით.",
  businessModel: "შეკეთების მოცულობას ფოტოების მიხედვით აფასებს და შემდეგ ადგენს შეთავაზებას.",
  positioning: "ნივთის შენარჩუნების ალტერნატივა მისი ახლით ჩანაცვლების ნაცვლად.", valueProposition: "მფლობელმა წინასწარ გაიგოს, რა შეიძლება აღდგეს.",
  offers: [{ name: "Leather bags, shoes, and accessories repair", description: "ტყავის ნივთების შეკეთება", ...citation }],
  distinctiveSignals: [{ statement: "ფაქტურის შენარჩუნება", sourceKey: "founder", exactExcerpt: "We retain patina and show stitching before and after repair." }], audienceSignals: [],
  voice: { traits: ["საგნობრივი", "ხელობის დეტალებზე ორიენტირებული"], principles: ["ახსენით რა აღდგება", "აჩვენეთ მასალის მდგომარეობა"], examples: [] },
  constraints: [], openQuestions: [{ question: "რომელ დაზიანებას ვერ აკეთებთ?", whyItMatters: "შეფასების მოლოდინი უნდა იყოს რეალისტური." }],
}
export function fixtureOutput(call: BrandModelCall): unknown {
  if (call.step === "understanding") return structuredClone(understanding)
  if (call.step === "audiences") return { segments: [{ name: "ნივთის შენარჩუნებასა და შეცვლას შორის", buyingSituation: "ფეხსაცმელი დაზიანდა და პატრონი შეკეთებას ადარებს ახლის ყიდვას.", currentNeed: "გაიგოს შესაძლებელია თუ არა აღდგენა", relevantOffers: [understanding.offers[0]!.name], mainQuestions: ["რა აღდგება?"], likelyBarriers: ["მოსალოდნელი შედეგის გაურკვევლობა"], decisionStage: "solutionAware", evidenceKeys: ["e1"], rationale: "შეკეთების არჩევანს არსებული ნივთის მდგომარეობა განსაზღვრავს.", assumptions: ["ამ სიტუაციის გავრცელება ჯერ უცნობია"], confidenceBand: "reasonable" }] }
  if (call.step === "profiles") return { profiles: (call.input as { audiences: { audienceKey: string }[] }).audiences.map((a) => ({ audienceKey: a.audienceKey, communicationGoal: "დაეხმარეთ შეკეთების საზღვრების გაგებაში", toneAdjustments: ["მშვიდი ახსნა"], preferredFraming: ["დაზიანება, შესაძლებელი სამუშაო, შეზღუდვა"], usefulContentAngles: ["ნაკერის აღდგენის პროცესი"], assumedKnowledge: "none", explanationDepth: "balanced", trustMechanisms: ["რეალური სამუშაოს ახლო კადრი"], ctaStyle: "consultative", avoid: ["აღდგენის გარანტია შეფასების გარეშე"], rationale: "ნივთის მდგომარეობა განსაზღვრავს რეალურ შესაძლებლობას" })) }
  if (call.step === "envelope") return { envelope: { complexity: "plainWithProfessionalDepth", assumedKnowledge: "none", explanationDepth: "balanced", toneRange: ["საგნობრივი"], framingRules: ["ჯერ ნივთის მდგომარეობა, შემდეგ შესაძლებელი სამუშაო"], preferredStructures: ["დაზიანება → შეფასება → სამუშაო"], terminologyRules: ["ხელობის ტერმინს მოკლე განმარტება დაურთეთ"], proofStyle: ["ნაკერის ახლო კადრები"], ctaStyle: "consultative", salesPressure: "low", inclusivityRules: ["არ იგულისხმოთ ახალი ნივთის ყიდვის შესაძლებლობა"], trustMechanisms: ["რეალური შეზღუდვების ახსნა"], avoid: ["შეფასების გარეშე გარანტიები"], rationale: "კომუნიკაცია შეფასების პროცესს გასაგებს ხდის" } }
  if (call.step === "goals") return { goals: ["შეკეთების შესაძლებლობის გაგება", "ინფორმირებული მოთხოვნის მიღება"].map((title) => ({ title, desiredChange: "მფლობელი აგზავნის შეფასებისთვის გამოსადეგ ფოტოებს", rationale: "ფოტოები შეფასების პირველი ნაბიჯია", audienceKeys: ["a1"], progressSignals: ["მოთხოვნაში დაზიანების ახლო ფოტო ჩანს", "მფლობელი აცნობიერებს შეკეთების საზღვრებს"] })) }
  throw new Error(`Unexpected step: ${call.step}`)
}
export function fixtureReasoner(calls: BrandModelCall[] = []): BrandReasoner {
  return async <T,>(call: BrandModelCall) => {
    calls.push(call)
    const output = fixtureOutput(call)
    assert.deepEqual(validateSchema(output, call.schema), [])
    assert.deepEqual(call.validate?.(output) ?? [], [])
    return output as T
  }
}
export async function completeFixture(session: DiscoverySession, calls: BrandModelCall[] = []) {
  let current = structuredClone(session)
  while (current.step !== "ready") {
    const next = await advanceDiscovery(current, { reason: fixtureReasoner(calls), capture: async () => { throw new Error("Website unavailable") }, now: () => "2026-09-06T10:00:00.000Z" })
    current = { ...current, ...next, status: next.step === "ready" ? "ready" : "queued" }
  }
  return current
}
