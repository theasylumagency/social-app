import type {
  SocialContentPublishAttemptId, SocialContentPublishResultId, SocialContentSchedule,
  SocialContentScheduleEvent, SocialContentScheduleLifecycleState, SocialPublishingAccount,
} from "../../blueprints/social"
import type { SocialPublicationBundleV1 } from "./publication-bundle-codec"

export type PublicationInputRecord = ReturnType<typeof import("./materialize-approved-post").materializeApprovedPost>

export type ScheduleDestination = {
  readonly publishingAccountId: string
  readonly channel: "facebook" | "instagram"
  readonly publishAt: string
  readonly contentMode: import("../../blueprints/social/tokens").SocialContentMode
}

export type PersistedSocialSchedule = {
  readonly schedule: SocialContentSchedule
  readonly postKey: string
  readonly publishingAccountId: string
  readonly brandId: string
  readonly lifecycle: SocialContentScheduleLifecycleState
}

export type DueSocialPublication = PersistedSocialSchedule & {
  readonly bundle: SocialPublicationBundleV1
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
    readonly records: readonly { readonly publication: PublicationInputRecord; readonly schedule: SocialContentSchedule; readonly publishingAccountId: string }[]
  }): Promise<readonly PersistedSocialSchedule[]>
  listSchedules(scope: { readonly ownerId: string; readonly brandId: string; readonly sourceRunId?: string }): Promise<readonly PersistedSocialSchedule[]>
  appendScheduleEvent(scope: { readonly ownerId: string; readonly brandId: string }, event: SocialContentScheduleEvent): Promise<void>
  claimDue(now: string, maxAttempts: number, limit?: number): Promise<readonly DueSocialPublication[]>
}
