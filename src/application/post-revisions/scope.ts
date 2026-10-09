import { reviewDigest } from '../weekly-planning/review-evidence';
import type { PostsPayload } from '../../blueprints/social/weekly-planning/posts';
/** One selected variant may change; every outline, sibling and other channel stays exact. */
export function assertRevisionScope(before: PostsPayload, after: PostsPayload, postKey: string, channel: string) {
    if (reviewDigest(before.outline) !== reviewDigest(after.outline) || reviewDigest(Object.keys(before.copies).sort()) !== reviewDigest(Object.keys(after.copies).sort()))
        throw Error('Revision changed the outline or sibling set');
    for (const [key, copy] of Object.entries(before.copies)) {
        const next = after.copies[key];
        if (key !== postKey) {
            if (reviewDigest(copy) !== reviewDigest(next))
                throw Error('Revision changed an unselected post');
            continue;
        }
        if (!next || copy.variants.length !== next.variants.length || next.variants.filter(v => v.channel === channel).length !== 1)
            throw Error('Revision channel is incomplete');
        for (const variant of copy.variants.filter(v => v.channel !== channel))
            if (reviewDigest(variant) !== reviewDigest(next.variants.find(v => v.channel === variant.channel)))
                throw Error('Revision changed an unselected channel');
    }
}
