import type { IsoDateTime } from "../../core/domain"
import type { SocialContentPublisher } from "../../blueprints/social"
import { runDurableSocialContentPublish } from "./run-durable-publish"
import type { SocialPublicationStore } from "./publication-store"
import type { SocialContentPublishStore } from "./publish-store"

export async function runSocialPublishQueue(deps: {
  readonly publications: SocialPublicationStore
  readonly attempts: SocialContentPublishStore
  readonly publisherFor: (provider: string) => SocialContentPublisher
  readonly now: () => IsoDateTime
  readonly maxAttempts: number
  readonly unresolvedAttemptGraceMs: number
  readonly limit?: number
}) {
  const work = await deps.publications.claimDue(deps.now(), deps.maxAttempts, deps.limit)
  return Promise.allSettled(work.map((item) => runDurableSocialContentPublish({
    draft: item.bundle.draft, contentExecutionSpec: item.bundle.contentExecutionSpec,
    schedule: item.schedule, scheduleState: item.lifecycle, publishingAccount: item.publishingAccount,
    attemptId: item.attemptId, attemptNumber: item.attemptNumber, resultId: item.resultId,
    retryPolicy: { maxAttempts: deps.maxAttempts }, recoveryPolicy: { unresolvedAttemptGraceMs: deps.unresolvedAttemptGraceMs },
  }, { store: deps.attempts, publish: deps.publisherFor(item.provider), now: deps.now })))
}
