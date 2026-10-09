import { materializeApprovedPost } from './materialize-approved-post';
import { encodeSocialPublicationBundle } from './publication-bundle-codec';
import { reviewDigest } from '../weekly-planning/review-evidence';
import type { PostRevision } from '../post-revisions/model';
import { assertRevisionScope } from '../post-revisions/scope';
import { assertCurrentWeeklyApproval } from '../weekly-planning/approval-evidence';
export function materializePostRevision(revision: PostRevision) {
    if (revision.status !== 'approved')
        throw Error('შესწორებულ ტექსტს საკუთარი დამტკიცება სჭირდება.');
    assertRevisionScope(revision.before, revision.batch.payload, revision.postKey, revision.channel);
    assertCurrentWeeklyApproval(revision.run, revision.batch);
    const post = revision.batch.payload.outline!.posts[Number(revision.postKey.slice(1)) - 1]!;
    const record = materializeApprovedPost({ run: revision.run, posts: revision.batch, postKey: revision.postKey, channel: revision.channel, contentMode: post.contentMode! });
    const draft = { ...record.bundle.draft, version: revision.version };
    return { ...record, draftVersion: revision.version, ...encodeSocialPublicationBundle({ ...record.bundle, draft, approval: { ...record.bundle.approval, draftDigest: reviewDigest(draft) }, postRevision: { id: revision.id, stablePostId: revision.stablePostId, version: revision.version, postKey: revision.postKey, channel: revision.channel, parentRevisionId: revision.parentRevisionId, baseApprovalId: revision.baseApprovalId, baseDigest: revision.baseDigest, before: revision.before.copies[revision.postKey]! } }) };
}
