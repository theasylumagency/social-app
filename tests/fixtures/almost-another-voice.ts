import type { BrandUnderstanding, DiscoverySource } from "../../src/blueprints/social/brand-discovery/model"
import type { PostCopy, PostOutline } from "../../src/blueprints/social/weekly-planning/posts"

// Source excerpts and traits transcribed from docs/ai/task01/Almost Another Brand Discovery output.md.
// The report is rendered UI, not raw discovery JSON. These are test mappings, not a new discovery result.
const thesis = "When a large part of society is no longer needed as a productive force, politics begins to think not in terms of citizens, but in terms of population."
const dialogue = "An adjacent dialogue has been logged beside it. Not as commentary, but as an independent verbal structure formed around the exact same tension."
export const almostAnotherSources: DiscoverySource[] = [
  { key: "dialogue", url: "https://almostanother.com/dialogues/Conservative_vs_Liberal", title: "Dialogue", text: thesis, capturedAt: "2026-09-07T00:00:00.000Z" },
  { key: "home", url: "https://almostanother.com/", title: "Almost Another", text: dialogue, capturedAt: "2026-09-07T00:00:00.000Z" },
]
export const almostAnotherVoice: BrandUnderstanding["voice"] = {
  traits: ["დიალექტიკური და კონფრონტაციული", "პოლიტიკურად ფილოსოფიური", "აფორისტული და თეატრალური", "მკაცრი, მაგრამ განმარტებით გამჭვირვალე"],
  principles: ["დაპირისპირებული პოზიციები წარმოადგინოს შინაგანად თანმიმდევრულად, წინასწარ მინიჭებული გამარჯვებულის გარეშე.", "განასხვავოს ფაქტი, ინტერპრეტაცია, გამოგონილი ნარატივი და ღია კითხვა."],
  examples: [{ sourceKey: "dialogue", exactExcerpt: thesis }, { sourceKey: "home", exactExcerpt: dialogue }],
  behaviors: [
    { dimension: "rhetoricalStance", instruction: "ძალაუფლებრივი დაძაბულობა გამოხატოს მკვეთრი ინტერპრეტაციული თეზისით.", sourceKey: "dialogue", exactExcerpt: thesis },
    { dimension: "argumentStructure", instruction: "დამოუკიდებელი არგუმენტები ააგოს საერთო დაძაბულობის გარშემო.", sourceKey: "home", exactExcerpt: dialogue },
  ],
}
export const almostAnotherPost: PostOutline = {
  directionKey: "d1", dayOffset: 0, title: "მოქალაქე თუ სამართავი მოსახლეობა", why: "შრომისა და ძალაუფლების ურთიერთობის გააზრება", format: "text",
  channels: [{ channel: "facebook", reason: "არგუმენტის განვითარება" }],
  brief: { job: "ავტომატიზაციის პოლიტიკური დაშვების გამოკვეთა", takeaway: "შრომის როლის ცვლილება მოქალაქეობის პოლიტიკურ აზრსაც ეხება", points: ["მოქალაქე და მოსახლეობა", "წარმოების საჭიროება და პოლიტიკური ძალაუფლება"], mustNotSay: ["გარდაუვალი შედეგი", "გამოგონილი ნარატივი როგორც ფაქტობრივი მტკიცებულება"] },
  visual: { kind: "none", description: "ტექსტი", aspectRatio: "none", frames: [] },
}
// Only these English failure fragments were supplied in Astra Task — Brand Voice Fidelity.md.
// No complete generated Facebook post was attached. Do not present this composite as that post.
export const flattenedFragments: PostCopy = { variants: [{ channel: "facebook", caption: "one answer is...\n\nbut there is another question...\n\nneither outcome is predetermined...", frames: [], script: "", onScreenText: [] }] }
