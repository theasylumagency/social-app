import type { Pool } from "pg"
import type { PostsPayload } from "../../blueprints/social/weekly-planning/posts"
import { sequenceIssues } from "../../blueprints/social/weekly-planning/sequence"

export async function repairWeeklyPosts(pool: Pool, ownerId: string, runId: string, version: number) {
  const c = await pool.connect()
  try {
    await c.query("BEGIN")
    // Lock plan before posts, consistently with the approval transaction.
    const run = await c.query("SELECT r.id FROM weekly_planning_runs r JOIN brands b ON b.id=r.brand_id JOIN workspaces w ON w.id=b.workspace_id WHERE r.id=$1 AND r.owner_user_id=$2 AND w.owner_user_id=$2 AND r.version=$3 AND r.status IN ('ready','approved') AND NOT EXISTS(SELECT 1 FROM weekly_planning_runs n WHERE n.brand_id=r.brand_id AND n.week_start=r.week_start AND n.version>r.version) FOR UPDATE OF r", [runId, ownerId, version])
    if (!run.rowCount) throw Error("გეგმა შეიცვალა. განაახლეთ გვერდი.")
    const r = await c.query<{ payload: PostsPayload }>("SELECT payload FROM weekly_post_batches WHERE run_id=$1 AND status='ready' AND approved_at IS NULL FOR UPDATE", [runId])
    if (!r.rows[0]) throw Error("მხოლოდ დაუდასტურებელი, დასრულებული ტექსტების გასწორებაა შესაძლებელი.")
    const count = await c.query<{ n: number }>("SELECT count(*)::int n FROM weekly_planning_events WHERE run_id=$1 AND kind='posts-repaired' AND created_at>now()-interval '1 hour'", [runId])
    if (count.rows[0]!.n >= 5) throw Error("გასწორების ლიმიტი ამოიწურა. მოგვიანებით სცადეთ.")
    const p = r.rows[0].payload
    if (p.sequenceReview && sequenceIssues(p.sequenceReview).length) throw Error("გამეორება პოსტების გეგმაშია. ტექსტის გადაწერის ნაცვლად კვირის გეგმა დააზუსტეთ.")
    const keys = [...new Set(p.review?.issues.filter((i) => i.severity === "blocking").map((i) => i.postKey) ?? [])]
    if (!keys.length) throw Error("დასაზუსტებელი ტექსტი არ მოიძებნა.")
    p.repairDrafts ??= {}
    for (const key of keys) { const copy = p.copies[key]; if (copy) p.repairDrafts[key] = copy; delete p.copies[key] }
    p.repairs = 1 // One explicit repair pass, followed by a fresh review.
    await c.query("UPDATE weekly_post_batches SET payload=$2::jsonb,status='queued',step='writing',error=NULL,lease_until=NULL,lease_token=NULL,updated_at=now() WHERE run_id=$1", [runId, JSON.stringify(p)])
    await c.query("INSERT INTO weekly_planning_events(run_id,kind,payload) VALUES($1,'posts-repaired',$2::jsonb)", [runId, JSON.stringify({ postKeys: keys, decidedBy: ownerId })])
    await c.query("COMMIT")
  } catch (e) { await c.query("ROLLBACK"); throw e } finally { c.release() }
}
