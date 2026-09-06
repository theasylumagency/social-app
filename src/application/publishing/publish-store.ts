import type {
    SocialContentPublishAttempt,
    SocialContentPublishResult,
} from "../../blueprints/social"

// -----------------------------------------------------------------------------
// Attempt claim
// -----------------------------------------------------------------------------

/**
 * An attempt is uniquely claimed by:
 *
 * idempotencyKey + attemptNumber
 *
 * The claim MUST be atomic in the persistence implementation.
 *
 * Only the worker receiving "acquired" may call the provider.
 */
export type SocialContentPublishAttemptClaim =
    | {
        readonly status:
        "acquired"
    }
    | {
        readonly status:
        "alreadyRecorded"

        /**
         * Canonical attempt that already owns this
         * publication-intent + attempt-number pair.
         */
        readonly attempt:
        SocialContentPublishAttempt

        /**
         * Null means:
         *
         * attempt was durably recorded,
         * but no durable result exists.
         *
         * This MUST NOT trigger another provider call.
         * The outcome is operationally ambiguous and must
         * enter reconciliation.
         */
        readonly result:
        SocialContentPublishResult | null
    }

// -----------------------------------------------------------------------------
// Result recording
// -----------------------------------------------------------------------------

export type SocialContentPublishResultRecord =
    | {
        readonly status:
        "recorded"
    }
    | {
        readonly status:
        "alreadyRecorded"

        readonly result:
        SocialContentPublishResult
    }

// -----------------------------------------------------------------------------
// Store port
// -----------------------------------------------------------------------------

export interface SocialContentPublishStore {
    /**
     * Atomically claim one concrete attempt.
     *
     * Persistence identity:
     *
     *     idempotencyKey + attemptNumber
     *
     * The implementation must guarantee that two workers
     * cannot both receive "acquired" for the same pair.
     */
    claimAttempt(
        attempt:
            SocialContentPublishAttempt,
    ): Promise<SocialContentPublishAttemptClaim>

    /**
     * Persist the canonical result for one attempt.
     *
     * Exactly one canonical result may belong to one
     * immutable attempt.
     *
     * Repeating the same persistence operation after a
     * worker restart must be safe.
     */
    recordResult(
        result:
            SocialContentPublishResult,
    ): Promise<SocialContentPublishResultRecord>
}