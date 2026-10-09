import type {
  SocialContentPublishAttemptId, SocialContentPublishResultId, SocialContentSchedule,
  SocialContentScheduleEvent, SocialContentScheduleLifecycleState, SocialPublishingAccount,
} from "../../blueprints/social"
import type { SocialPublicationBundle } from "./publication-bundle-codec"
import type { ScheduleTimeContext } from "./schedule-time"

export type PublicationInputRecord = ReturnType<typeof import("./materialize-approved-post").materializeApprovedPost> | ReturnType<typeof import("./materialize-post-revision").materializePostRevision>

export type ScheduleDestination = {
  readonly publishingAccountId: string
  readonly channel: "facebook" | "instagram"
  readonly publishAt: string
  readonly contentMode: import("../../blueprints/social/tokens").SocialContentMode
}

export type PersistedSocialSchedule = {
  readonly publicationInputId: string
  readonly supersededByInputId: string | null
  readonly approvalId: string | null
  readonly schedule: SocialContentSchedule
  readonly postKey: string
  readonly publishingAccountId: string
  readonly brandId: string
  readonly lifecycle: SocialContentScheduleLifecycleState
  readonly timeContext?: ScheduleTimeContext | null
  readonly delivery?: { state: "notStarted" | "inProgress" | "published" | "unknown" | "failed"; attemptCount: number }
}

export type ScheduleChange = {
  readonly ownerId: string; readonly brandId: string; readonly scheduleId: string; readonly operationId: string
  readonly expectedRevision: number; readonly now: string
} & ({ readonly action: "reschedule"; readonly publishAt: string; readonly timeContext?: ScheduleTimeContext }
  | { readonly action: "cancel"; readonly reason?: string })

export type DueSocialPublication = PersistedSocialSchedule & {
  readonly bundle: SocialPublicationBundle
  readonly provider: string
  readonly publishingAccount: SocialPublishingAccount
  readonly attemptNumber: number
  readonly attemptId: SocialContentPublishAttemptId
  readonly resultId: SocialContentPublishResultId
}

export interface SocialPublicationStore {
  saveSchedules(input: {
    readonly ownerId: string
    readonly actorId: string
    readonly brandId: string
    readonly sourceRunId: string
    readonly approvalAt: string
    readonly approvalActorId: string
    readonly replaceInputIds?: readonly string[]
    readonly records: readonly { readonly publication: PublicationInputRecord; readonly schedule: SocialContentSchedule; readonly publishingAccountId: string; readonly timeContext?: ScheduleTimeContext }[]
  }): Promise<readonly PersistedSocialSchedule[]>
  listSchedules(scope: { readonly ownerId: string; readonly brandId: string; readonly sourceRunId?: string }): Promise<readonly PersistedSocialSchedule[]>
  appendScheduleEvent(scope: { readonly ownerId: string; readonly brandId: string }, event: SocialContentScheduleEvent): Promise<void>
  changeSchedule(input: ScheduleChange): Promise<void>
  claimDue(now: string, maxAttempts: number, limit?: number): Promise<readonly DueSocialPublication[]>
}
