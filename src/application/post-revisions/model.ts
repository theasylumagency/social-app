import type { PlanningRun } from '../../blueprints/social/weekly-planning/model';
import type { PostsBatch, PostsPayload, PostVariant } from '../../blueprints/social/weekly-planning/posts';
export type PostRevision = {
    id: string;
    noteId: string;
    ownerId: string;
    brandId: string;
    runId: string;
    postKey: string;
    channel: 'facebook' | 'instagram';
    stablePostId: string;
    version: number;
    parentRevisionId: string | null;
    baseApprovalId: string;
    baseDigest: string;
    status: 'queued' | 'running' | 'ready' | 'needsChanges' | 'approved' | 'discarded' | 'failed';
    run: PlanningRun;
    before: PostsPayload;
    batch: PostsBatch;
    error: string | null;
    updatedAt: string;
};
export type PostRevisionView = Pick<PostRevision, 'id' | 'postKey' | 'channel' | 'version' | 'status' | 'updatedAt' | 'error'> & {
    batchTitle: string;
    approvalId: string | null;
    before: PostVariant;
    after: PostVariant;
    issues: {
        postKey: string;
        message: string;
        severity: string;
    }[];
};
