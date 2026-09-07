import { readFileSync } from "node:fs"
import type { PostOutline } from "../src/blueprints/social/weekly-planning/posts"
import type { SequenceReview } from "../src/blueprints/social/weekly-planning/sequence"
import { scheduleFixture } from "./weekly-posts-fixture"

/** Extract actual Georgian jobs and copy from the supplied regression weeks, without paraphrasing. */
export function suppliedWeek(n: 1 | 2): PostOutline[] {
  const source = readFileSync(new URL(`../docs/ai/task02/week${n}.md`, import.meta.url), "utf8").replaceAll("\r\n", "\n")
  return source.split(/\n0[123]\n[^\n]+ · შეთავაზებული დღე\n\n/).slice(1).map((section, i) => {
    const lines = section.split("\n")
    const end = section.indexOf("ტექსტის კოპირება")
    const content = section.slice(0, end).split("\n\n").filter(Boolean)
    return { ...scheduleFixture().posts[0]!, directionKey: `d${i + 1}`, dayOffset: i * 3, title: lines[0]!,
      brief: { job: lines[2]!, takeaway: content.at(-1)!, points: content.slice(1), mustNotSay: ["გამოგონილი ფაქტები"] } }
  })
}

export function ordinaryPosts(): PostOutline[] {
  return [
    ["რა ფოტო გამოგვიგზავნოთ?", "დაზიანების გასაგებად სასარგებლო ფოტოების მომზადება", "გადაიღეთ მთელი ნივთი და დაზიანების ახლო ხედი", "მთელი ნივთის ხედი", "დეტალის ხედი"],
    ["რა ვერ ჩანს ფოტოზე?", "ფოტოთი შეფასების შეზღუდვის ახსნა", "ფოტო ფარულ დაზიანებას ვერ გამორიცხავს; შეფასება გარანტია არ არის", "ზედაპირის ხილული ნიშნები", "ფარული მდგომარეობა უცნობია"],
    ["რომელი კვალი გინდათ შეინარჩუნოთ?", "შეკეთების სასურველი შედეგის განსაზღვრა", "მფლობელმა წინასწარ უნდა გამოყოს შესანარჩუნებელი კვალი და შესაცვლელი დაზიანება", "ოჯახური ნივთის ძველი კვალი", "ახალი დაზიანება"],
  ].map(([title, job, takeaway, ...points], i) => ({ ...scheduleFixture().posts[0]!, directionKey: `d${i + 1}`, dayOffset: i * 2, title: title!, brief: { job: job!, takeaway: takeaway!, points, mustNotSay: ["შეკეთების გარანტია"] } }))
}

export const distinctSequence = (count: number, historyKey: string | null = null): SequenceReview => ({
  posts: Array.from({ length: count }, (_, i) => ({ postKey: `p${i + 1}`, contentRole: "პრაქტიკული დახმარება", contribution: "კონკრეტული გადაწყვეტილების მომზადება", closestRecentKey: historyKey, relationship: "new", addedValue: "substantive", reason: "მკითხველი განსხვავებულ პრაქტიკულ კითხვას წყვეტს" })),
  pairs: Array.from({ length: count }, (_, i) => i).flatMap((i) => Array.from({ length: count - i - 1 }, (_, j) => ({ leftKey: `p${i + 1}`, rightKey: `p${i + j + 2}`, relationship: "distinct" as const, addedValue: "substantive" as const, reason: "განსხვავებული სასარგებლო შედეგი მკითხველისთვის" }))),
})
