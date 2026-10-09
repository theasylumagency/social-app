import { isPostContentMode, validatePostContentMode } from "../../blueprints/social/weekly-planning/post-mode"
import { validateFactualReferences } from "../../blueprints/social/public-knowledge"
import { validatePostCopy, type PostsPayload, type PostsReview } from "../../blueprints/social/weekly-planning/posts"
import type { WeeklyPostReviewEvidence } from "../../blueprints/social/weekly-planning/review-evidence"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import { validateVariantOperatingRules } from "../../blueprints/social/weekly-planning/post-context"
import { duplicateCopyIssues } from "../../blueprints/social/weekly-planning/duplicate-hygiene"
import { POST_EDITORIAL_DIMENSIONS } from "../../blueprints/social/weekly-planning/post-editorial"

export function deterministicPostReviewIssues(run: PlanningRun, payload: PostsPayload): PostsReview["issues"] {
  if (!payload.outline) return [{ postKey: "p1", severity: "blocking", message: "პოსტების განრიგი ვერ მოიძებნა." }]
  return [...payload.outline.posts.flatMap((post, i) => {
    const postKey = `p${i + 1}`, copy = payload.copies[postKey]
    if (!copy) return [{ postKey, severity: "blocking" as const, message: "პოსტის ტექსტი ჯერ დასრულებული არ არის." }]
    return [...validatePostContentMode(post, run.payload.publicKnowledge, copy), ...validatePostCopy(copy, post),
      ...validateFactualReferences(run.payload.publicKnowledge, post.factKeys ?? [], copy.factualReferences),
      ...copy.variants.flatMap(v => validateVariantOperatingRules(v, payload.operatingRules ?? run.payload.operatingRules ?? []))]
      .map(message => ({ postKey, severity: "blocking" as const, message }))
  }), ...duplicateCopyIssues(payload, run.payload.priorCopy)]
}
/** Shared policy for approval and publication; missing checks never count as a pass. */
export function weeklyReviewBlocker(e: WeeklyPostReviewEvidence): string | null {
  if (e.version !== 2 || e.policyVersion !== "weekly-review-v2") return "შენახულ ტექსტებს მიმდინარე შემოწმება სჭირდება."
  const keys = Object.keys(e.postDigests)
  if (!e.postModes || Object.keys(e.postModes).length !== keys.length || keys.some(k => !isPostContentMode(e.postModes[k]))) return "პოსტების მიზნის რეჟიმები შემოწმებული არ არის."
  if (!keys.length || !Array.isArray(e.modelRuns) || e.modelRuns.length !== 2 || new Set(e.modelRuns.map(r => r.id)).size !== 2
    || ["post_review", "post_editorial"].some(step => e.modelRuns.filter(r => r.step === step && r.id && r.model && r.promptVersion && /^[a-f0-9]{64}$/u.test(r.inputHash)).length !== 1)
    || !e.safety || !Array.isArray(e.safety.issues) || !e.safety.summary?.trim() || !Array.isArray(e.deterministicIssues)
    || !e.editorial || !Array.isArray(e.editorial.posts) || e.editorial.posts.length !== keys.length) return "შემოწმების შედეგები არასრულია."
  if ([...e.safety.issues, ...e.deterministicIssues].some(i => !keys.includes(i.postKey) || i.severity !== "advisory" || !i.message?.trim())) return "ტექსტის შემოწმება დამტკიცებას ბლოკავს."
  for (const key of keys) {
    const reviewed = e.editorial.posts.filter(p => p.postKey === key)
    if (reviewed.length !== 1 || !Array.isArray(reviewed[0]!.issues) || reviewed[0]!.issues.length || !Array.isArray(reviewed[0]!.dimensions) || reviewed[0]!.dimensions.length !== POST_EDITORIAL_DIMENSIONS.length
      || POST_EDITORIAL_DIMENSIONS.some(d => reviewed[0]!.dimensions.filter(v => v.dimension === d && ["acceptable", "strong"].includes(v.rating) && v.note?.trim()).length !== 1)) return "პოსტს სრული სარედაქციო შეფასება სჭირდება."
  }
  return null
}
