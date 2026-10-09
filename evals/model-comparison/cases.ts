import { createCorpus, digest } from "../performance/corpus"
import { evaluateWorkflow } from "../performance/workflow"
import { createPostSchedule, writePost, reviewPosts } from "../../src/application/weekly-planning/posts"
import { analyzeBrandWebsiteWithModel, type BrandModelRequest } from "../../src/infrastructure/web/brand-model-extraction"
import type { BrandReasoner, BrandModelCall } from "../../src/infrastructure/models/brand-reasoning"
import type { PlanningRun } from "../../src/blueprints/social/weekly-planning/model"
import type { PostsPayload, PostCopy, PostsReview, PostSchedule } from "../../src/blueprints/social/weekly-planning/posts"
import { countPostChannels } from "../../src/blueprints/social/weekly-planning/posts"
import { almostAnotherPost } from "../../tests/fixtures/almost-another-voice"
import { SOCIAL_CONTENT_MODES } from "../../src/blueprints/social/tokens"
import type { PricedModel } from "./cost"

export type Check = { id: string; passed: boolean; provenance: string }
export type ComparisonCase = {
  id: string; title: string; role: "notes" | "planner" | "writer" | "review" | "extraction";
  effort: "none" | "low" | "medium"; oldModel: PricedModel; newModel: PricedModel;
  execute: (reason: BrandReasoner, extract: (request: BrandModelRequest) => Promise<unknown>, arm: "old" | "new") => Promise<unknown>;
  checks: (value: unknown) => Check[]
}
export const WEEK = "2026-10-05"
const check = (id: string, passed: boolean): Check => ({ id, passed, provenance: "controlled-test-reference" })
const copy = (caption: string): PostCopy => ({ variants: [{ channel: "facebook", caption, frames: [], script: "", onScreenText: [] }], factualReferences: { factKeys: ["fact-price"], proofKeys: ["proof-price"] } })
const georgian = (value: PostCopy) => value.variants.every(variant => /[ა-ჰ]/u.test(variant.caption) && (variant.caption.match(/[ა-ჰ]/gu)?.length ?? 0) > (variant.caption.match(/[a-z]/giu)?.length ?? 0))

export async function comparisonCases(): Promise<ComparisonCase[]> {
  const corpus = await createCorpus(WEEK)
  const ordinary = structuredClone(corpus.find(item => item.id === "U05")!.context.planning.run!)
  const essay = structuredClone(corpus.find(item => item.id === "E06")!.context.planning.run!)
  essay.payload.basis.payload.input.language = "ka"
  const essayPost = { ...structuredClone(almostAnotherPost), contentMode: SOCIAL_CONTENT_MODES.educational, factKeys: [] }
  const essayPayload: PostsPayload = { outline: { summary: "მოქალაქე და ძალაუფლება", cadenceReason: "ერთი არგუმენტი", channelReason: "Facebook-ზე არგუმენტის განვითარება", posts: [essayPost] }, copies: {}, review: null, repairs: 0 }
  const price = structuredClone(corpus.find(item => item.id === "E04")!.context.planning.run!)
  price.payload.basis.payload.input.language = "ka"
  price.payload.directions[0] = { direction: "შეფასების ფასი", purpose: "მფლობელმა გაიგოს შეფასების დადასტურებული ფასი", rationale: "ფასი მხოლოდ დარეგისტრირებულ საჯარო ფაქტს ეყრდნობა" }
  price.payload.objective = { ...price.payload.objective!, objective: "გაიგოს შეფასების ფასი გარანტიისა და დამატებითი პირობების გამოგონების გარეშე." }
  const pricePost = { ...structuredClone(essayPost), title: "ნივთის შეფასების ფასი", brief: { job: "დარეგისტრირებული ფასის განმარტება", takeaway: "ნივთის შეფასება 50 ლარი ღირს", points: ["ნივთის შეფასების ფასი", "წყარო მხოლოდ ფასს ადასტურებს"], mustNotSay: ["გარანტია", "უფასო მომსახურება", "გამოგონილი დამატებითი პირობები"] }, contentMode: SOCIAL_CONTENT_MODES.serviceExplainer, factKeys: ["fact-price"] }
  const pricePayload: PostsPayload = { outline: { summary: "შეფასების ფასი", cadenceReason: "ერთი კონკრეტული პასუხი", channelReason: "Facebook-ის ტექსტური პოსტი", posts: [pricePost] }, copies: {}, review: null, repairs: 0 }
  const cases: ComparisonCase[] = []
  for (const id of ["U05", "C04"]) {
    const item = corpus.find(value => value.id === id)!
    cases.push({ id: `note-${id}`, title: id === "U05" ? "რაოდენობისა და ფორმატის ზუსტი ცვლილება" : "ადგილობრივი და მუდმივი ცვლილების გარჩევა", role: "notes", effort: "medium", oldModel: "gpt-5.6-terra", newModel: "gpt-6.1-sol",
      execute: async reason => (await evaluateWorkflow(item, WEEK, reason, reason, [])).result,
      checks: value => (value as Awaited<ReturnType<typeof evaluateWorkflow>>["result"]).assertions.map(assertion => ({ ...assertion, provenance: assertion.provenance })) })
  }
  ordinary.payload.cadence = { facebook: 2, instagram: 2 }
  cases.push({ id: "planner", title: "ორი პოსტი თითო არხზე", role: "planner", effort: "low", oldModel: "gpt-5.6-terra", newModel: "gpt-6.1-sol",
    execute: reason => createPostSchedule(structuredClone(ordinary), reason),
    checks: value => [check("exactCadence", digest(countPostChannels((value as PostSchedule).posts)) === digest({ facebook: 2, instagram: 2 })), check("noUnsupportedVideo", !(value as PostSchedule).posts.some(post => post.format === "reel"))] })
  const writer = (id: string, title: string, run: PlanningRun, payload: PostsPayload, extra: (value: PostCopy) => Check[]) => {
    cases.push({ id, title, role: "writer", effort: "low", oldModel: "gpt-5.6-sol", newModel: "gpt-6.1-sol", execute: reason => writePost(structuredClone(run), structuredClone(payload), "p1", reason),
      checks: value => [check("GeorgianMajority", georgian(value as PostCopy)), check("noExtraChannels", (value as PostCopy).variants.length === 1 && (value as PostCopy).variants[0]!.channel === "facebook"), ...extra(value as PostCopy)] })
  }
  writer("writer-price", "ქართული ტექსტი დადასტურებული 50-ლარიანი ფასით", price, pricePayload, value => [check("registeredPriceRetained", value.variants.every(variant => /50\s*(?:ლარ|GEL)/u.test(variant.caption))), check("noWrongPrice", !value.variants.some(variant => /30\s*(?:ლარ|GEL)/u.test(variant.caption)))])
  writer("writer-voice", "პოლიტიკური ტექსტი ბრენდის ხმით", essay, essayPayload, () => [])
  for (const wrong of [false, true]) {
    const payload = structuredClone(pricePayload)
    payload.copies.p1 = copy(wrong ? "ნივთის შეფასების ფასი 30 ლარია." : "ნივთის შეფასების ფასი 50 ლარია.")
    cases.push({ id: wrong ? "review-wrong-price" : "review-valid-price", title: wrong ? "არასწორი 30-ლარიანი ფასის აღმოჩენა" : "სწორი 50-ლარიანი ტექსტის მიღება", role: "review", effort: "low", oldModel: "gpt-5.6-terra", newModel: "gpt-6.1-sol",
      execute: reason => reviewPosts(structuredClone(price), structuredClone(payload), reason),
      checks: value => { const result = value as PostsReview; return [check(wrong ? "wrongPriceBlocked" : "validPriceNotBlocked", wrong ? result.issues.some(issue => issue.severity === "blocking" && /30|ფას/u.test(issue.message)) : !result.issues.some(issue => issue.severity === "blocking"))] } })
  }
  const pages = [{ url: "https://benchmark.example/services", title: "ნიმუში — სახელოსნო", text: "ეს არის ხელოვნური ტესტის წყარო. სახელოსნო „ნიმუში“ თბილისში მდებარეობს. ჩვენი მომსახურებებია ხის ავეჯის შეკეთება და ძველი ფაქტურის შენარჩუნება. ნივთის შეფასება 50 ლარი ღირს. სხვა ფასები, გარანტიები და ტელეფონი აქ მითითებული არ არის." }]
  cases.push({ id: "extraction", title: "წყაროთი დასაბუთებული ინფორმაციის ამოღება", role: "extraction", effort: "none", oldModel: "gpt-5.4-nano", newModel: "gpt-6-luna",
    execute: (_reason, extract, arm) => analyzeBrandWebsiteWithModel(pages, { apiKey: "injected-adapter-only", primaryModel: arm === "old" ? "gpt-5.4-nano" : "gpt-6-luna", fallbackModel: arm === "old" ? "gpt-5.6-terra" : "gpt-6.1-sol", callModel: extract }),
    checks: value => { const result = value as Awaited<ReturnType<typeof analyzeBrandWebsiteWithModel>>, extracted = result.extraction;
      return [check("groundedExtractionReturned", !!extracted), check("brandName", !!extracted?.brandName?.value.includes("ნიმუში")), check("location", !!extracted?.locations.some(location => location.value.includes("თბილის"))), check("services", !!extracted?.services.some(service => /შეკეთებ/u.test(service.value))), check("noInventedPhone", !/\+995|555\d{6}/u.test(JSON.stringify(extracted)))] } })
  return cases
}

export async function captureCalls(item: ComparisonCase) {
  const calls: unknown[] = []
  const capture: BrandReasoner = async <T>(call: BrandModelCall): Promise<T> => { calls.push({ step: call.step, version: call.version, prompt: call.prompt, input: call.input, schema: call.schema, language: call.outputLanguage ?? "ka" }); throw Error("CAPTURE_ONLY") }
  try { await item.execute(capture, async request => { calls.push({ step: "extraction", prompt: request.instructions, input: request.input, schema: request.schema }); throw Error("CAPTURE_ONLY") }, "old") } catch { /* Capture has no network, database or mutation ports. */ }
  // Extraction captures the same payload twice when the controlled primary fails; compare unique logical payloads.
  return [...new Map(calls.map(call => [digest(call), call])).values()]
}
