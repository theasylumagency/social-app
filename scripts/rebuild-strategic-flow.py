from pathlib import Path

def edit(path, old, new):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if old not in s: raise RuntimeError(f'Missing anchor in {path}: {old[:70]}')
    p.write_text(s.replace(old,new),encoding='utf-8')

# Read requests and direct links share the same subscription boundary as writes.
for path in ['src/app/api/brand-discovery/route.ts','src/app/api/weekly-planning/route.ts','src/app/api/weekly-planning/assets/route.ts']:
    edit(path,'authenticateWorkRequest, currentSession','authenticateWorkRequest, currentSession, subscriptionRequired')
    s=Path(path).read_text(encoding='utf-8'); name='auth' if 'const auth = await currentSession()' in s else 'session'
    line=next(l for l in s.splitlines() if f'if (!{name}?.user.emailVerified)' in l)
    edit(path,line,line+f'\n  const billing = await subscriptionRequired({name}.user.id)\n  if (billing) return billing')
edit('src/app/account/page.tsx','<div className="account-card">','<div className="account-card"><Link href="/subscription">გამოწერა, განახლება და გადახდები →</Link>')
edit('src/infrastructure/postgres/ingestion-store.ts','import { assertWorkspaceAccess','import { assertBrandCapacity } from "./subscription-store"\nimport { assertWorkspaceAccess')
edit('src/infrastructure/postgres/ingestion-store.ts','): Promise<void> {\n  const result = await client.query(\n    `\n      INSERT INTO brands','): Promise<void> {\n  if (access) await assertBrandCapacity(client, access.workspaceId, brand.id)\n  const result = await client.query(\n    `\n      INSERT INTO brands')

# Remove Brand Brain's goal-selection step. Legacy saved goals remain historical context.
edit('src/application/brand-discovery/advance.ts',', GoalProposal','')
edit('src/application/brand-discovery/advance.ts','import { BRAND_GOALS_PROMPT } from "../../blueprints/social/brand-discovery/prompts/goals"\n','')
edit('src/application/brand-discovery/advance.ts',', BRAND_GOALS_SCHEMA','')
p=Path('src/application/brand-discovery/advance.ts'); s=p.read_text(encoding='utf-8'); start=s.index('  if (session.step === "goals")'); end=s.index('  return { payload: p, step: "ready" }\n}',start)
s=s[:start]+'  // Legacy queued goal stages finish without another paid call.\n'+s[end:]; s=s.replace('return { payload: p, step: "goals" }','p.goals = []; p.feedback.selectedGoalIds = []\n    return { payload: p, step: "ready" }'); p.write_text(s,encoding='utf-8')
edit('src/infrastructure/postgres/brand-discovery-store.ts','!Array.isArray(selectedGoals) || !selectedGoals.length ||','!Array.isArray(selectedGoals) ||')
edit('src/infrastructure/postgres/brand-discovery-store.ts','აირჩიეთ სულ მცირე ერთი შემოთავაზებული მიზანი.','მიზნების ძველი ჩანაწერი არასწორია.')
edit('src/app/discovery-client.tsx','DISCOVERY_STEPS.filter((step) => step !== "ready")','DISCOVERY_STEPS.filter((step) => step !== "ready" && step !== "goals")')
p=Path('src/app/brand-dossier.tsx'); s=p.read_text(encoding='utf-8'); start=s.index('    <section id="bd-goals"'); end=s.index('    {envelope ?',start)
s=s[:start]+'''    <section className="bd-section"><h2>შემდეგი ნაბიჯი — სოციალური სტრატეგია</h2><p>ბრენდის დადასტურების შემდეგ Operator შეაფასებს საჯარო სოციალურ გარემოს და შემოგთავაზებთ კონკრეტულ მიზანსა და არხების რეკომენდაციას.</p></section>

'''+s[end:]; s=s.replace(' || !goalIds.length','').replace('დადასტურება შეინახავს საქმიანობასა და არჩეულ მიზნებს.','დადასტურება შეინახავს ბრენდის საქმიანობასა და კომუნიკაციის საფუძველს.').replace(': !goalIds.length ? <small>აირჩიეთ სულ მცირე ერთი მიზანი.</small>','')
# Goal selection is no longer editable; preserve existing confirmed IDs only for old dossier reads.
s=s.replace('const [goalIds, setGoalIds]', 'const [goalIds]'); p.write_text(s,encoding='utf-8')
edit('src/app/api/brand-discovery/route.ts','redirect: "/workspace/brand"','redirect: "/workspace/strategy"')

# Retain old snapshot types for reading, remove semantic-novelty gates from the execution path.
p=Path('src/worker/weekly-posts.ts'); s=p.read_text(encoding='utf-8').replace(', reviewPostSequence','').replace('import { applySequenceReview } from "../blueprints/social/weekly-planning/sequence"\n','')
s='import { hasSubscription } from "../infrastructure/postgres/subscription-store"\n'+s
s=s.replace('    const claim = await claimWeeklyPosts','    if (!await hasSubscription(pool, ownerId)) return\n    const claim = await claimWeeklyPosts')
s='\n'.join(l for l in s.splitlines() if 'const needsSequence =' not in l)
s=s.replace('postStageModel(needsSequence ? "review" : claim.batch.step)','postStageModel(claim.batch.step)').replace('        payload.sequenceRetainedCount = payload.outline?.posts.length ?? 0\n','')
s=s.replace('      else if (needsSequence) {\n        step = applySequenceReview(payload, await reviewPostSequence(run, payload, reason))\n      }\n','')
p.write_text(s+'\n',encoding='utf-8')
for path in ['src/infrastructure/postgres/weekly-planning-store.ts','src/infrastructure/postgres/weekly-posts-repair.ts']:
    p=Path(path); lines=p.read_text(encoding='utf-8').splitlines(); p.write_text('\n'.join(l for l in lines if 'import { sequenceIssues }' not in l and 'sequenceReview && sequenceIssues(' not in l)+'\n',encoding='utf-8')
p=Path('src/application/weekly-planning/posts.ts'); s=p.read_text(encoding='utf-8'); s='\n'.join(l for l in s.splitlines() if 'import { SEQUENCE_REVIEW_PROMPT' not in l)
start=s.index('export async function reviewPostSequence('); end=s.index('export async function writePost(',start); s=s[:start]+s[end:]
s=s.replace(', sequenceFeedback: existing?.sequenceFeedback ?? null','').replace('trialIncludesGeneration: false','billingMode: "simulated"')
p.write_text(s+'\n',encoding='utf-8')
p=Path('src/blueprints/social/weekly-planning/sequence.ts'); s=p.read_text(encoding='utf-8'); start=s.index('export const EDITORIAL_PROGRESS_RULES ='); end=s.index('export const SEQUENCE_REVIEW_PROMPT =',start)
s=s[:start]+'''export const EDITORIAL_PROGRESS_RULES = `
CONTENT SERVES THE ACTIVE STRATEGY
Repeated strategic ideas and useful takeaways across weeks are allowed. Semantic novelty, role rotation and intellectual progress are not independent goals. Prior plans are intentions, never evidence of publication or audience progress. Preserve brand voice and grounded facts. Catch exact or near-verbatim copy reuse and accidental duplicates; avoid effectively identical posts within the same week unless deliberately requested. Do not require new ideas just because a new week starts.
`

'''+s[end:]
# Legacy review compatibility must never restore cross-week novelty blocking.
start=s.index('export function sequenceIssues('); end=s.index('/** Repair jobs',start)
s=s[:start]+'''export function sequenceIssues(review: SequenceReview) {
  return review.pairs.filter((p) => p.relationship === "duplicate").map((p) => ({ postKey: p.rightKey, severity: "blocking" as const, message: p.reason }))
}

'''+s[end:]; p.write_text(s,encoding='utf-8')
edit('src/blueprints/social/weekly-planning/prompts/context.ts','Only selectedBrandGoals are active goals. Unselected suggestions must not steer this week.','The approved socialStrategy is the persistent social objective. selectedBrandGoals are its reference projection for the weekly contract; legacy brand goals are historical context only.')
edit('src/blueprints/social/weekly-planning/prompts/context.ts','help avoid repeating the same communication job','preserve strategically useful ideas')
p=Path('src/blueprints/social/weekly-planning/prompts/posts.ts'); s=p.read_text(encoding='utf-8'); s='\n'.join(l for l in s.splitlines() if not l.startswith('If sequenceFeedback is supplied'))
s=s.replace('excluded from trial, planned for paid accounts','planned as a separately configured production capability'); p.write_text(s+'\n',encoding='utf-8')

# Gate durable jobs on every iteration, not just the browser.
for path,anchor in [('src/worker/weekly-planning.ts','    const claim = await claimPlanningRun'),('src/worker/brand-discovery.ts','    const claim = await claimDiscovery')]:
    p=Path(path); s=p.read_text(encoding='utf-8'); s='import { hasSubscription } from "../infrastructure/postgres/subscription-store"\n'+s; s=s.replace(anchor,'    if (!await hasSubscription(pool, ownerId)) return\n'+anchor); p.write_text(s,encoding='utf-8')
p=Path('scripts/brand-discovery-worker.mts'); s=p.read_text(encoding='utf-8'); s='import { runSocialStrategy } from "../src/worker/social-strategy"\n'+s
s=s.replace('    const results = await Promise.allSettled([','    const strategies = await pool.query<{ id: string; owner_user_id: string }>(`SELECT s.id,s.owner_user_id FROM social_strategies s JOIN auth_user u ON u.id=s.owner_user_id WHERE u."emailVerified"=true AND (s.status=\'queued\' OR (s.status=\'running\' AND s.lease_until<now())) ORDER BY s.updated_at LIMIT 2`)\n    const results = await Promise.allSettled([...strategies.rows.map((job) => runSocialStrategy(pool, job.owner_user_id, job.id)), ')
# Expired jobs should not starve active subscribers in the worker queue.
s=s.replace('WHERE u."emailVerified"=true AND','WHERE u."emailVerified"=true AND EXISTS(SELECT 1 FROM workspaces w JOIN workspace_subscriptions sub ON sub.workspace_id=w.id WHERE w.owner_user_id=u.id AND sub.paid_at<=now() AND sub.expires_at>now()) AND')
p.write_text(s,encoding='utf-8')
