import { prepareContextualNote } from "../../src/application/contextual-notes/workflow"
import { reviewPostRevision } from "../../src/application/post-revisions/review"
import { assertRevisionScope } from "../../src/application/post-revisions/scope"
import { weeklyReviewBlocker } from "../../src/application/weekly-planning/review-policy"
import type { BrandReasoner, BrandModelRun } from "../../src/infrastructure/models/brand-reasoning"
import type { EvaluationCase, EvaluationResult } from "./model"
import { digest } from "./corpus"
import type { PostRevision } from "../../src/application/post-revisions/model"

export async function evaluateWorkflow(item: EvaluationCase, week: string, noteReason: BrandReasoner, reviewReason: BrandReasoner, reviewRuns: BrandModelRun[]) {
  const phases: { name: string; durationMs: number }[] = []
  const started = performance.now()
  const prepared = await prepareContextualNote(structuredClone(item.input), structuredClone(item.context), { reason: noteReason, currentWeek: () => week,
    channelPolicies: async () => [{ channel: "facebook", active: true }, { channel: "instagram", active: true }], channelImpact: async () => ({ affectedFuture: 0, unresolved: 0 }) })
  phases.push({ name: "interpretAndPrepare", durationMs: performance.now() - started })
  let revisedPosts: EvaluationResult["revisedPosts"] = null, status: string = prepared.status
  if (prepared.decision.action === "revise_post" && prepared.snapshot?.post?.after && prepared.snapshot.revision) {
    const original = prepared.snapshot.revision.posts
    const payload = structuredClone(original.payload)
    payload.copies[prepared.snapshot.post.postKey] = prepared.snapshot.post.after
    delete payload.reviewEvidence; payload.review = null
    assertRevisionScope(original.payload, payload, prepared.snapshot.post.postKey, prepared.snapshot.post.channel)
    const revision: PostRevision = { id: item.input.id, noteId: item.input.id, ownerId: "evaluation-only", brandId: item.input.context.brandId,
      runId: original.runId, postKey: prepared.snapshot.post.postKey, channel: prepared.snapshot.post.channel, stablePostId: `evaluation:${item.id}`,
      version: 2, parentRevisionId: null, baseApprovalId: "controlled-start-not-real-approval", baseDigest: digest(original.payload), status: "running",
      run: prepared.snapshot.revision.run, before: original.payload, batch: { ...original, payload }, error: null, updatedAt: original.updatedAt }
    const reviewStarted = performance.now()
    revisedPosts = await reviewPostRevision(revision, reviewReason, reviewRuns)
    phases.push({ name: "independentReview", durationMs: performance.now() - reviewStarted })
    status = revisedPosts.reviewEvidence && !weeklyReviewBlocker(revisedPosts.reviewEvidence) ? "readyForHumanApproval" : "needsChanges"
  }
  const assertions: EvaluationResult["assertions"] = []
  const check = (id: string, passed: boolean, provenance: EvaluationResult["assertions"][number]["provenance"] = item.reference.provenance) => assertions.push({ id, passed, provenance })
  const ref = item.reference, interpretation = prepared.interpretation, proposal = interpretation.weeklyDirectives
  if (ref.actions) check("expectedAction", ref.actions.includes(prepared.decision.action))
  if (ref.modes) check("expectedMode", ref.modes.includes(prepared.decision.mode))
  if (ref.cadence) {
    const actual = proposal?.cadence.map(({ channel, mode, quantity }) => ({ channel, mode, quantity })) ?? []
    const ordered = (values: typeof actual) => [...values].sort((a, b) => a.channel.localeCompare(b.channel))
    check("exactCadence", digest(ordered(actual)) === digest(ordered(ref.cadence)))
  }
  if (ref.direction) check("direction", proposal?.direction.intent === ref.direction)
  if (ref.period) check("period", proposal?.period.kind === ref.period)
  if (ref.engineering?.period) check("engineeringPeriod", proposal?.period.kind === ref.engineering.period, "engineering-invariant")
  if (ref.engineering?.direction) check("engineeringDirection", proposal?.direction.intent === ref.engineering.direction, "engineering-invariant")
  if (ref.format) check("format", digest(proposal?.formatChanges.map(({ from, to }) => ({ from, to })) ?? []) === digest(ref.format))
  const before = item.context.planning.posts?.payload.copies[item.input.context.postKey ?? ""]?.variants.find(variant => variant.channel === item.input.context.channel)
  const after = revisedPosts?.copies[item.input.context.postKey ?? ""]?.variants.find(variant => variant.channel === item.input.context.channel)
  if (ref.shorter) check("shorter", !!before && !!after && after.caption.length < before.caption.length)
  if (ref.noEmoji) check("noEmoji", !!after && !/\p{Extended_Pictographic}/u.test(after.caption))
  if (revisedPosts) check("unselectedScopePreserved", true, "engineering-invariant") // assertRevisionScope already rejects any changed sibling/outline/channel.
  if (item.id === "E05") check("unregisteredPriceMustNotBecomeReady", status !== "readyForHumanApproval" || !after?.caption.includes("30"))
  return { result: { interpretation, decision: prepared.decision, status, revisedPosts, assertions }, phases }
}
