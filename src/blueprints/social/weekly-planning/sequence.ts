import type { PlanningPayload } from "./model"

export type RecentWork = { historyKey: string; week: string; status: "ready" | "approved" | "unknown"; title: string; job: string; takeaway: string; points: readonly string[] }

/** Bounded editorial memory, including legacy title-only plans. Never evidence of publication. */
export function recentEditorialWork(payload: PlanningPayload, week: string): RecentWork[] {
  const start = Date.parse(week)
  const seen = new Set<string>()
  return [...payload.priorWeeks].sort((a, b) => b.week.localeCompare(a.week)).filter((p) => {
    const age = (start - Date.parse(p.week)) / 86400000
    if (!(age > 0 && age <= 28) || seen.has(p.week) || seen.size >= 3) return false
    seen.add(p.week); return true
  }).flatMap((p, i) => {
    const work = p.posts?.length ? p.posts : (p.directionDetails ?? p.directions.map((direction) => ({ direction, purpose: "", rationale: "" }))).map((d) => ({ title: d.direction, job: d.direction, takeaway: d.purpose, points: [] }))
    return work.slice(0, 10).map((w, j) => ({ ...w, historyKey: `h${i + 1}p${j + 1}`, week: p.week, status: p.status ?? "unknown" }))
  })
}

export type SequenceReview = {
  posts: { postKey: string; contentRole: string; contribution: string; closestRecentKey: string | null; relationship: "new" | "advances" | "repeats" | "necessaryRepeat"; addedValue: "substantive" | "incidental" | "none"; reason: string }[]
  pairs: { leftKey: string; rightKey: string; relationship: "distinct" | "overlap" | "duplicate"; addedValue: "substantive" | "incidental" | "none"; reason: string }[]
}
export const EDITORIAL_PROGRESS_RULES = `
CONTENT SERVES THE ACTIVE STRATEGY
Repeated strategic ideas and useful takeaways across weeks are allowed. Semantic novelty, role rotation and intellectual progress are not independent goals. Prior plans are intentions, never evidence of publication or audience progress. Preserve brand voice and grounded facts. Catch exact or near-verbatim copy reuse and accidental duplicates; avoid effectively identical posts within the same week unless deliberately requested. Do not require new ideas just because a new week starts.
`

