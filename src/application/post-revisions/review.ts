import type { PostRevision } from './model';
import type { BrandReasoner, BrandModelRun } from '../../infrastructure/models/brand-reasoning';
import type { PostsReview } from '../../blueprints/social/weekly-planning/posts';
import { assertRevisionScope } from './scope';
import { reviewPosts } from '../weekly-planning/posts';
import { captureWeeklyReview } from '../weekly-planning/review-evidence';
export async function reviewPostRevision(revision: PostRevision, reason: BrandReasoner, runs: BrandModelRun[]) {
    const payload = structuredClone(revision.batch.payload);
    assertRevisionScope(revision.before, payload, revision.postKey, revision.channel);
    let safety: PostsReview | undefined;
    const scoped: BrandReasoner = call => reason({ ...call, version: `${call.version}-single-channel-v1`, input: {...(call.input as Record<string,unknown>),revisionTarget:{postKey:revision.postKey,channel:revision.channel}}, prompt: call.prompt + '\nFor this single-channel revision, also compare all drafts in this week for accidental duplication or sequence conflicts. Report the exact affected post keys. Unselected posts are frozen; never suggest silently rewriting them.' });
    const review = await reviewPosts(revision.run, payload, scoped, value => { safety = value; });
    if (!safety || !review.editorial)
        throw Error('Review is incomplete');
    payload.review = review;
    payload.reviewEvidence = captureWeeklyReview(revision.run, payload, safety, review.editorial, runs, new Date().toISOString());
    return payload;
}
