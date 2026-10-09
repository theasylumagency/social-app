import { comparisonCases, WEEK, type Check } from "../model-comparison/cases"
import { createCorpus, digest, fixedId } from "../performance/corpus"
import { advanceDiscovery } from "../../src/application/brand-discovery/advance"
import { createPostSchedule, reviewPosts } from "../../src/application/weekly-planning/posts"
import { countPostChannels, type PostSchedule, type PostsPayload, type PostsReview } from "../../src/blueprints/social/weekly-planning/posts"
import { STRATEGY_SCHEMA, validateStrategyProposal, type SocialStrategyProposal, type ReconSource } from "../../src/blueprints/social/strategy/model"
import { SOCIAL_STRATEGY_PROMPT, SOCIAL_STRATEGY_PROMPT_VERSION } from "../../src/blueprints/social/strategy/prompt"
import type { DiscoverySession } from "../../src/blueprints/social/brand-discovery/model"
import type { BrandReasoner, BrandModelCall } from "../../src/infrastructure/models/brand-reasoning"
import { almostAnotherPost } from "../../tests/fixtures/almost-another-voice"
import { SOCIAL_CONTENT_MODES } from "../../src/blueprints/social/tokens"

export const EFFORTS = ["low", "medium", "high"] as const
export type Effort = typeof EFFORTS[number]
export type EffortCase = { id: string; title: string; role: string; execute: (reason: BrandReasoner) => Promise<unknown>; checks: (value: unknown) => Check[]; rubric: string[] }
const check = (id: string, passed: boolean): Check => ({ id, passed, provenance: "controlled-test-reference" })
export async function effortCases(): Promise<EffortCase[]> {
  const previous = await comparisonCases()
  const corpus = await createCorpus(WEEK)
  const workshop = structuredClone(corpus.find(item => item.id === "U05")!.context.planning.run!)
  const basis = structuredClone(workshop.payload.basis)
  const sourceText = "სახელოსნო „ნიმუში“ თბილისში ტყავის ჩანთებს, ფეხსაცმელს და აქსესუარებს აკეთებს. ფოტო გვჭირდება პირველი შეფასებისთვის; სამუშაოს შესაძლებლობას ადგილზე დათვალიერებით ვაზუსტებთ. ძველ ფაქტურას ვინარჩუნებთ. ყველა დაზიანების შეკეთების გარანტიას არ ვიძლევით. ჩვენი ხმა საგნობრივი და მშვიდია: ჯერ ახსენით მასალის მდგომარეობა და მხოლოდ შემდეგ შესაძლებელი სამუშაო. არ გვინდა ზოგადი სარეკლამო დაპირებები. ფასი და დასრულების ვადა მხოლოდ კონკრეტული ნივთის ნახვის შემდეგ განისაზღვრება. გვსურს ნივთის მფლობელმა შეკეთების შესაძლებლობა რეალისტურად გაიგოს. ასაკობრივი მონაცემები, გაყიდვების რაოდენობა და ტელეფონი აქ მითითებული არ არის."
  const discovery: DiscoverySession = { id: fixedId("effort-discovery"), ownerId: "evaluation-only", brandId: workshop.brandId, revision: 1, status: "queued", step: "understanding", error: null, leaseUntil: null, updatedAt: `${WEEK}T10:00:00.000Z`, payload: { ...basis.payload, sources: [{ key: "founder", url: null, title: "კონტროლირებადი დამფუძნებლის ინფორმაცია", text: sourceText, capturedAt: `${WEEK}T10:00:00.000Z` }], input: { website: "", notes: sourceText, language: "ka" }, understanding: null } }
  const sources: ReconSource[] = [
    { channel: "facebook", url: "https://benchmark.example/facebook", capturedAt: `${WEEK}T10:00:00.000Z`, availability: "accessible", text: "კონტროლირებადი საჯარო ამონაწერი: 2026-10-01 — ტყავის ჩანთის ნაკერის ახლო კადრი. 2026-10-03 — ფოტო მხოლოდ პირველ შეფასებაში გვეხმარება; კონკრეტულ სამუშაოს ნივთის ნახვის შემდეგ ვაზუსტებთ. ორი კომენტარი კითხულობს, შეიძლება თუ არა ნივთის გარანტირებულად აღდგენა. ნახვების, გაყიდვების და შენახვების მონაცემები არ ჩანს." },
    { channel: "instagram", url: null, capturedAt: `${WEEK}T10:00:00.000Z`, availability: "unknown", text: "ავტორიზაციის გარეშე გვერდის აქტივობა ვერ შემოწმდა." },
  ]
  const strategyInput = { brand: basis.payload.understanding, audiences: basis.payload.landscape, envelope: basis.payload.envelope, socialSources: sources, previousProposal: workshop.payload.socialStrategy?.payload.proposal ?? null, revisionReason: "approachFailure", founderComment: "ფოტოების გამოგზავნას ზოგჯერ შეკეთების გარანტიად იგებენ. გვინდა ეს მოლოდინი სწორად განვსაზღვროთ. მიმდინარე კვირაში ახალი სამუშაოს ფოტოებიც არ გვაქვს და ვიდეოს ვერ გადავიღებთ. ბრენდის ძირითადი მიზანი არ იცვლება.", evidence: [{ week: WEEK, reviewedAt: `${WEEK}T10:00:00.000Z`, availability: "partial", observations: [{ level: "public", observation: "კონტროლირებადი ამონაწერის ორ კომენტარში გარანტიის შესახებ კითხულობენ.", source: sources[0]!.url }], execution: [], unknowns: ["გაყიდვები", "რეალური შენახვები"], businessContext: "წარმოების შეზღუდვა მიმდინარე კვირაზეა; მუდმივი სტრატეგია და დროებითი ტაქტიკა გასარჩევია." }] }
  const cases: EffortCase[] = [
    { id: "brand-understanding", title: "ბრენდის გააზრება ფაქტების, ხმისა და შეზღუდვების გარჩევით", role: "brand", execute: reason => advanceDiscovery(structuredClone(discovery), { reason, capture: async () => { throw Error("NO_NETWORK_SOURCE") }, now: () => `${WEEK}T10:00:00.000Z` }), checks: value => {
      const p = (value as Awaited<ReturnType<typeof advanceDiscovery>>).payload
      return [check("understandingReturned", !!p.understanding), check("citationAnchors", p.evidence.every(item => item.sourceKey === "founder" && sourceText.includes(item.exactExcerpt))), check("voiceAndConstraints", !!p.understanding?.voice.principles.length && !!p.understanding.constraints.length), check("noInventedContactOrPrice", !/\+995|555\d{6}|\b\d+\s*(?:ლარ|GEL)/u.test(JSON.stringify(p.understanding)))]
    }, rubric: ["ფოტოს პირველ შეფასებასა და ადგილზე დათვალიერებას ზუსტად არჩევს", "საგნობრივ ხმას მოქმედ პრინციპებად აქცევს", "სერვისს, შეზღუდვას და მომხმარებლის სასურველ ცვლილებას ერთმანეთში არ ურევს", "ცნობილ ფაქტს გამოყოფს უცნობი ფასისა და გარანტიისგან"] },
    { id: "strategy", title: "სტრატეგიის გადახედვა მტკიცებულებისა და დროებითი შეზღუდვის გარჩევით", role: "strategy", execute: reason => reason<SocialStrategyProposal>({ step: "social_strategy", version: SOCIAL_STRATEGY_PROMPT_VERSION, prompt: SOCIAL_STRATEGY_PROMPT, input: structuredClone(strategyInput), schema: STRATEGY_SCHEMA, validate: value => validateStrategyProposal(value as SocialStrategyProposal, sources) }), checks: value => {
      const p = value as SocialStrategyProposal
      return [check("sourceValidation", !validateStrategyProposal(p, sources).length), check("instagramRemainsUnknown", p.reconnaissance.find(item => item.channel === "instagram")?.status === "unknown"), check("channelRolesDistinct", new Set(p.channels.map(item => item.role)).size > 1), check("noInventedMetrics", !/\b(?:reach|impressions|saves|sales)\s*[:=]\s*\d/iu.test(JSON.stringify(p)))]
    }, rubric: ["მუდმივ მიზანს მიმდინარე კვირის მედიის არქონისგან არჩევს", "პასუხობს გარანტიის მცდარ მოლოდინს კონკრეტული გეგმით", "ორივე არხის როლი ბრენდსა და აუდიტორიას ეყრდნობა", "საჯარო სიგნალს გაყიდვისა და კერძო ანალიტიკის მტკიცებულებად არ აქცევს"] },
  ]
  workshop.payload.cadence = { facebook: 3, instagram: 2 }
  cases.push({ id: "planner", title: "გეგმა განსხვავებული რაოდენობებით და ვიდეოს შეზღუდვით", role: "planner", execute: reason => createPostSchedule(structuredClone(workshop), reason), checks: value => [check("exactCadence", digest(countPostChannels((value as PostSchedule).posts)) === digest({ facebook: 3, instagram: 2 })), check("noUnsupportedVideo", !(value as PostSchedule).posts.some(post => post.format === "reel"))], rubric: ["პოსტების სამუშაო ერთმანეთისგან განსხვავდება", "ფორმატების წარმოება მოცემული რესურსებით შესაძლებელია", "იგივე სათქმელის უაზრო გამეორებას ერიდება", "გეგმა მიზანს, აუდიტორიას და ყველა მნიშვნელოვან მიმართულებას აკავშირებს"] })
  for (const id of ["writer-price", "writer-voice", "review-valid-price", "review-wrong-price"]) {
    const item = previous.find(item => item.id === id)!
    cases.push({ id, title: item.title, role: item.role, execute: reason => item.execute(reason, async () => { throw Error("NO_EXTRACTION") }, "new"), checks: item.checks, rubric: item.role === "writer" ? ["პოსტს კონკრეტული სათქმელი აქვს", "ბრენდის ხმა დაცულია და ზოგად რჩევებში არ იკარგება", "არგუმენტი ვითარდება და დასკვნა საწყის კითხვას პასუხობს", "ფაქტი, ინტერპრეტაცია და დაპირება გამიჯნულია"] : ["ცნობილ სწორ ფასს უსაფუძვლოდ არ ბლოკავს", "მცდარ ფასს ზუსტად პოულობს", "შესწორების ინსტრუქცია მხოლოდ პრობლემას ეხება", "შენიშვნა რეალური ტექსტითა და მოცემული ამოცანითაა დასაბუთებული"] })
  }
  const essay = structuredClone(corpus.find(item => item.id === "E06")!.context.planning.run!)
  essay.payload.basis.payload.input.language = "ka"
  const post = { ...structuredClone(almostAnotherPost), contentMode: SOCIAL_CONTENT_MODES.educational, factKeys: [] }
  const thin: PostsPayload = { outline: { summary: "მოქალაქე და ძალაუფლება", cadenceReason: "ერთი არგუმენტი", channelReason: "Facebook", posts: [post] }, copies: { p1: { variants: [{ channel: "facebook", caption: "ჩვენს ციფრულ ეპოქაში ყველაფერი სწრაფად იცვლება. ავტომატიზაცია ახალ შესაძლებლობებს გვთავაზობს. ერთი პასუხი არსებობს, მაგრამ სხვა კითხვაც ჩნდება. მთავარია, ყველას მოვუსმინოთ და ერთად უკეთესი მომავალი შევქმნათ. არც ერთი შედეგი წინასწარ განსაზღვრული არ არის.", frames: [], script: "", onScreenText: [] }] } }, review: null, repairs: 0 }
  cases.push({ id: "review-thin-voice", title: "სწორი ფორმატით დაწერილი, მაგრამ ბრენდის ხმადაკარგული ტექსტი", role: "review", execute: reason => reviewPosts(structuredClone(essay), structuredClone(thin), reason), checks: value => [check("thinVoiceDetected", !!(value as PostsReview).editorial?.posts.some(p => p.dimensions.some(d => ["brandFidelity", "taskFit", "nonGenericity"].includes(d.dimension) && d.rating === "weak")))], rubric: ["არგუმენტისა და ხმის დაკარგვას პოულობს", "ზუსტად ციტირებს სუსტ მონაკვეთს", "შესწორება კონკურენტ არგუმენტებსა და პოლიტიკურ დაძაბულობას აღადგენს", "არ ამატებს ფაქტობრივ ბრალდებას ან ამოცანისთვის უცხო მოთხოვნას"] })
  return cases
}
export async function captureEffortCalls(item: EffortCase) {
  const calls: { step: string; version: string; prompt: string; input: unknown; schema: unknown; language: string }[] = []
  const reason: BrandReasoner = async <T>(call: BrandModelCall): Promise<T> => { calls.push({ step: call.step, version: call.version, prompt: call.prompt, input: call.input, schema: call.schema, language: call.outputLanguage ?? "ka" }); throw Error("CAPTURE_ONLY") }
  try { await item.execute(reason) } catch { /* Only application inputs are captured. */ }
  return calls
}
