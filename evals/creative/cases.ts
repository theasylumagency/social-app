import { createRequire } from "node:module"
import { compileBrandVoice } from "../../src/blueprints/social/brand-voice"
import type { CreativeInput } from "../../src/blueprints/social/creative/model"
import type { PostOutline } from "../../src/blueprints/social/weekly-planning/posts"
import { almostAnotherPost, almostAnotherSources, almostAnotherVoice } from "../../tests/fixtures/almost-another-voice"

export type CreativeEvaluationCase = { id: string; source: string; creativeInput: CreativeInput; post: PostOutline; writerContext: Record<string, unknown> }
const require = createRequire(import.meta.url)
const { TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT: dental } = require("../../tests/golden/total-charm-dent.content-writer.fixture.cjs")

function writerContext(post: PostOutline) {
  return { contentLanguage: "ka", task: { brief: post.brief, format: post.format, channels: post.channels.map(c => c.channel), frameCount: post.visual.frames.length, framePlan: post.visual.frames }, publicFacts: [], eligibleProof: [], operatingRules: [], constraints: post.brief.mustNotSay, siblingJobs: [], previousDraft: null, reviewFeedback: [] }
}
const dentalPost: PostOutline = {
  directionKey: "d1", dayOffset: 0, title: "რა უნდა გაარკვიოს დიაგნოსტიკამ", why: "მკურნალობის არჩევამდე გაურკვევლობის კონკრეტულ კითხვებად ქცევა", format: "carousel",
  channels: [{ channel: "instagram", reason: "შეფასების კითხვების თანმიმდევრული განხილვა" }],
  brief: { job: "რთული მკურნალობის არჩევამდე დიაგნოსტიკის როლის ახსნა", takeaway: "მკურნალობის არჩევანს ინდივიდუალური შეფასება და კითხვებზე პასუხები სჭირდება", points: ["რა ვიცით მდგომარეობის შესახებ", "რისი დაზუსტებაა საჭირო", "რა ალტერნატივებია განსახილველი", "რა ეტაპები და შეზღუდვებია გასარკვევი"], mustNotSay: dental.writerContext.constraints.map((c: { instruction: string }) => c.instruction) },
  visual: { kind: "slides", description: "შეფასებიდან გადაწყვეტილებამდე კითხვების ვიზუალური გზა", aspectRatio: "4:5", frames: ["გადაწყვეტილების წინ არსებული გაურკვევლობა", "შეფასებით დასაზუსტებელი მდგომარეობა", "ალტერნატივების განხილვა", "ეტაპები და შეზღუდვები", "ზოგადი კითხვები და ინდივიდუალური რეკომენდაცია"] },
}

/** Small mappings from existing real-brand regression material, not fresh discovery or audience research. */
export const creativeEvaluationCases: CreativeEvaluationCase[] = [
  {
    id: "almost-another-facebook",
    source: "Existing Almost Another source/voice/post fixture; audience is an evaluation hypothesis, not an observed demographic.",
    creativeInput: { business: "პოლიტიკური ესეისტიკისა და სპეკულაციური ფიქციის ავტორული პროექტი", audiences: [{ name: "პოლიტიკური ესეისტიკის მკითხველი", situation: "ფიქრობს ავტომატიზაციის, შრომისა და პოლიტიკური ძალაუფლების ურთიერთობაზე" }], platforms: ["facebook"] },
    post: almostAnotherPost,
    writerContext: { ...writerContext(almostAnotherPost), voice: compileBrandVoice(almostAnotherVoice, almostAnotherSources), internalGuidance: { business: { name: "Almost Another", description: "პოლიტიკური ესეისტიკა და სპეკულაციური ფიქცია" } }, communication: { salesPressure: "low", ctaStyle: "რეფლექსიური კითხვა, მხოლოდ საჭიროებისას" } },
  },
  {
    id: "total-charm-dent-instagram",
    source: "Existing Total Charm Dent golden Writer fixture; original diagnostic job mapped to five frames for this comparison. Facts are fixture authority, not freshly verified claims.",
    creativeInput: { business: "მრავალპროფილური სტომატოლოგიური კლინიკა", audiences: [{ name: "მკურნალობის გზაში გაურკვეველი ადამიანი", situation: dental.writerContext.audience.value.primary }], platforms: ["instagram"] },
    post: dentalPost,
    writerContext: { ...writerContext(dentalPost), publicFacts: dental.writerContext.publicFacts, voice: { traits: dental.writerContext.voice.value.tone, languageRules: dental.communicationEnvelope.terminologyRules ?? [], behaviors: [], references: [] }, internalGuidance: { business: { name: "Total Charm Dent", description: "მრავალპროფილური სტომატოლოგიური კლინიკა" }, audience: dental.writerContext.audience.value }, communication: dental.writerContext.voice.value },
  },
]
