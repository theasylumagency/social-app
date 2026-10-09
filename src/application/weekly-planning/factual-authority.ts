import { currentFactualBlocker, postAuthorityReferences, validateFactualReferences, type PublicKnowledgeSnapshot } from "../../blueprints/social/public-knowledge"
import type { PlanningRun } from "../../blueprints/social/weekly-planning/model"
import type { PostsPayload } from "../../blueprints/social/weekly-planning/posts"
export function postsFactualBlocker(run: PlanningRun, posts: PostsPayload | undefined, current: PublicKnowledgeSnapshot, now: string) {
  if (!posts?.outline) return null
  for (const [i, post] of posts.outline.posts.entries()) {
    const copy = posts.copies[`p${i + 1}`]
    if (!copy) continue
    if (validateFactualReferences(run.payload.publicKnowledge, post.factKeys ?? [], copy.factualReferences).length) return "პოსტს ფაქტების სწორი მითითება და ხელახალი შემოწმება სჭირდება."
    const reason = currentFactualBlocker(run.payload.publicKnowledge, postAuthorityReferences(post, copy, run.payload.publicKnowledge), current, now)
    if (reason) return reason
  }
  return null
}
