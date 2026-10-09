import { createHash, randomUUID } from "node:crypto"
import type { PostCopy, PostsReview } from "../blueprints/social/weekly-planning/posts"
import type { PlanningRun } from "../blueprints/social/weekly-planning/model"
import type { ShadowInterpreter, ShadowLinkage, ShadowTraceSink } from "../blueprints/social/semantic-middleware/shadow"
import { controlledSentenceTask } from "../blueprints/social/semantic-middleware/shadow-task"
import { collectSemanticShadow, type ShadowCollectionInput } from "../application/semantic-middleware/collect-shadow"
import { semanticShadowSettings, type ShadowSettings } from "../infrastructure/models/semantic-shadow-config"
import { createJevShadowInterpreter } from "../infrastructure/models/jev-semantic-shadow"
import { createShadowJsonlSink } from "../infrastructure/semantic-shadow/jsonl-trace-store"

export type CommittedWeeklyShadow = {
  readonly workflowRunId: string; readonly reviewRunId: string; readonly serviceMentions: readonly string[]
  readonly reviewedCopies: Readonly<Record<string, PostCopy>>
  readonly safetyReview: PostsReview; readonly consolidatedReview: PostsReview
  readonly committedStep: "writing" | "ready"
}
/** Capture original reviewed text before applyPostReview can move/delete repair drafts. */
export function weeklyShadowSnapshot(run: PlanningRun, reviewedCopies: Readonly<Record<string, PostCopy>>, safetyReview: PostsReview, consolidatedReview: PostsReview, committedStep: "writing" | "ready"): CommittedWeeklyShadow {
  return structuredClone({ workflowRunId: run.id, reviewRunId: randomUUID(), serviceMentions: run.payload.basis.payload.understanding?.offers.map(o => o.name) ?? [],
    reviewedCopies, safetyReview, consolidatedReview, committedStep })
}
export function weeklyShadowInputs(event: CommittedWeeklyShadow): ShadowCollectionInput[] {
  const inputs: ShadowCollectionInput[] = []
  for (const [postKey, copy] of Object.entries(event.reviewedCopies)) for (const variant of copy.variants) {
    const surfaces: { surface: string; text: string }[] = [{ surface: "caption", text: variant.caption }, { surface: "script", text: variant.script },
      ...variant.frames.flatMap((frame, i) => [{ surface: "frames." + i + ".heading", text: frame.heading }, { surface: "frames." + i + ".body", text: frame.body }]),
      ...variant.onScreenText.map((text, i) => ({ surface: "onScreenText." + i, text }))]
    for (const { surface, text } of surfaces.filter(s => s.text.trim())) {
      const sourceId = "weekly:" + event.workflowRunId + "/" + postKey + "/" + variant.channel + "/" + surface
      const revisionId = createHash("sha256").update(text).digest("hex")
      const source = { sourceId, revisionId, text }
      const linkage: ShadowLinkage = { workflowRunId: event.workflowRunId, reviewRunId: event.reviewRunId, postKey, channel: variant.channel, surface, committedStep: event.committedStep,
        safetyReviewer: { promptVersion: "founder-post-review-v2", outcome: { summary: event.safetyReview.summary, issues: event.safetyReview.issues.filter(i => i.postKey === postKey) } },
        consolidatedReviewer: { outcome: { summary: event.consolidatedReview.summary, issues: event.consolidatedReview.issues.filter(i => i.postKey === postKey) } } }
      inputs.push({ source, linkage, task: controlledSentenceTask(source, event.reviewRunId + "/" + sourceId, event.serviceMentions) })
    }
  }
  return inputs
}
/** Created only by the existing worker; never a new queue, route or background service. */
export function createWeeklySemanticShadowCollector(settings: ShadowSettings = semanticShadowSettings(), dependencies: { interpreter?: ShadowInterpreter; sink?: ShadowTraceSink } = {}): ((event: CommittedWeeklyShadow, remainingWorkerMs: number) => Promise<void>) | undefined {
  if (!settings.enabled) return undefined
  const interpreter = dependencies.interpreter ?? createJevShadowInterpreter(settings.apiKey, settings.metadata.model)
  const sink = dependencies.sink ?? createShadowJsonlSink(settings.tracePath)
  return async (event, remainingWorkerMs) => {
    if (remainingWorkerMs <= 0) return
    try {
      const inputs = weeklyShadowInputs(structuredClone(event))
      await collectSemanticShadow(inputs, { enabled: true, configuration: settings.metadata, interpreter, sink,
        inputUsdPerMillion: settings.inputUsdPerMillion, outputUsdPerMillion: settings.outputUsdPerMillion }, Math.min(settings.budgetMs, remainingWorkerMs))
    } catch { /* Already-committed production review/repair state never changes. */ }
  }
}

/** Defense around the commit tail: even a broken collector cannot enter the workflow failure path. */
export async function observeCommittedWeeklyShadow(collector: ((event: CommittedWeeklyShadow, budgetMs: number) => Promise<void>) | undefined, event: CommittedWeeklyShadow | undefined, remainingWorkerMs: number): Promise<void> {
  if (!collector || !event) return
  try { await collector(event, remainingWorkerMs) } catch { /* Evaluation only. */ }
}
