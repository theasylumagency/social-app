import { authenticateWorkRequest } from '../../_server/auth';
import { getDatabasePool } from '../../_server/database';
import { limitedBody } from '../../_server/limited-body';
import { isDiscoveryId } from '../../../infrastructure/postgres/brand-discovery-store';
import { resolvePostRevision } from '../../../infrastructure/postgres/post-revisions-store';
export const runtime = 'nodejs';
export async function POST(request: Request) {
    const access = await authenticateWorkRequest(request);
    if (access.error)
        return access.error;
    try {
        const body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 4000))) as Record<string, unknown>;
        if (!body || !isDiscoveryId(body.id) || !['approve', 'discard', 'retry'].includes(String(body.action)) || typeof body.updatedAt !== 'string' || body.updatedAt.length > 40 || !Number.isFinite(Date.parse(body.updatedAt)))
            throw Error('პოსტის ვერსია ან მოქმედება არასწორია.');
        await resolvePostRevision(getDatabasePool(), access.session.user.id, body.id, body.action as 'approve' | 'discard' | 'retry', body.updatedAt);
        return Response.json({ saved: true });
    }
    catch (error) {
        return Response.json({ message: error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : 'მოქმედება ვერ დასრულდა. განაახლეთ გვერდი და ხელახლა სცადეთ.' }, { status: 409 });
    }
}
