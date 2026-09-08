from pathlib import Path
def edit(path,old,new):
 p=Path(path); s=p.read_text(encoding='utf-8')
 if old not in s: raise RuntimeError(f'Missing {path}: {old[:60]}')
 p.write_text(s.replace(old,new),encoding='utf-8')

for path in ['src/infrastructure/postgres/weekly-planning-store.ts','src/infrastructure/postgres/weekly-posts-store.ts']:
 p=Path(path); s=p.read_text(encoding='utf-8'); s='import { currentWeeklyOperation } from "./weekly-operation-access"\n'+s
 # Admission to worker lease and explicit post generation must reflect current strategy/week/subscription.
 if path.endswith('weekly-planning-store.ts'):
  s=s.replace('WHERE ${owned} AND r.id=$2 AND (r.status=', 'WHERE ${owned} AND ${currentWeeklyOperation} AND r.id=$2 AND (r.status=')
  s=s.replace('const [r, approved, history, foundation] = await Promise.all([','const [r, approved, history, foundation, strategy] = await Promise.all([').replace('    basis(pool, ownerId, brandId),','    basis(pool, ownerId, brandId),\n    readStrategyView(pool, ownerId, brandId),')
  s=s.replace('stale: !!run && (run.payload.basis.sessionId','stale: !!run && (run.payload.socialStrategy?.id !== strategy.active?.id || !run.payload.socialStrategy || run.payload.basis.sessionId')
 else:
  s=s.replace('WHERE ${access} AND r.id=$2 AND r.version=$3','WHERE ${access} AND ${currentWeeklyOperation} AND r.id=$2 AND r.version=$3')
  s=s.replace('AND ${access} AND r.id=$2 AND r.status','AND ${access} AND ${currentWeeklyOperation} AND r.id=$2 AND r.status')
 p.write_text(s,encoding='utf-8')

# Legacy pending/future jobs cannot consume models while waiting for an approved strategy.
edit('scripts/brand-discovery-worker.mts','import { runSocialStrategy }','import { currentWeeklyOperation } from "../src/infrastructure/postgres/weekly-operation-access"\nimport { runSocialStrategy }')
edit('scripts/brand-discovery-worker.mts','FROM weekly_planning_runs r JOIN auth_user u ON u.id=r.owner_user_id WHERE','FROM weekly_planning_runs r JOIN auth_user u ON u.id=r.owner_user_id WHERE ${currentWeeklyOperation} AND')
edit('scripts/brand-discovery-worker.mts','JOIN weekly_planning_runs r ON r.id=p.run_id JOIN auth_user u ON u.id=r.owner_user_id WHERE','JOIN weekly_planning_runs r ON r.id=p.run_id JOIN auth_user u ON u.id=r.owner_user_id WHERE ${currentWeeklyOperation} AND')

# Existing low-cost account/callback reads must also respect expired subscriptions.
edit('src/app/_server/social-connections.ts','import "server-only"','import "server-only"\nimport { hasSubscription } from "../../infrastructure/postgres/subscription-store"')
edit('src/app/_server/social-connections.ts','session: (request) => getAuth().api.getSession({ headers: request.headers }),','session: async (request) => { const session = await getAuth().api.getSession({ headers: request.headers }); return session && await hasSubscription(getDatabasePool(), session.user.id) ? session : null },')
edit('src/infrastructure/postgres/subscription-store.ts','return await readSubscription(pool, ownerId)','return await readSubscription(c, ownerId)')
edit('src/infrastructure/postgres/social-strategy-store.ts','assertStrategyRevision(view.active, input.reason, input.comment)','assertStrategyRevision(view.latest.status === "approved" ? view.active : null, input.reason, input.comment)')

# Navigation follows Next router semantics and fixed Georgian dates.
for path in ['src/app/subscription/subscription-client.tsx','src/app/workspace/strategy-client.tsx','src/app/workspace/evidence-client.tsx']:
 p=Path(path); s=p.read_text(encoding='utf-8'); s=s.replace('"use client"','"use client"\nimport { useRouter } from "next/navigation"',1)
 anchor=next(l for l in s.splitlines() if l.startswith('export function ') and ('Client(' in l))
 s=s.replace(anchor,anchor+'\n  const router = useRouter()').replace('window.location.assign("/")','router.push("/"); router.refresh()').replace('window.location.assign("/subscription")','router.push("/subscription")').replace('[brandId, working])','[brandId, working, router])')
 s=s.replace('toLocaleDateString("ka-GE")','toLocaleDateString("ka-GE", { timeZone: "Asia/Tbilisi" })').replace('toLocaleString("ka-GE")','toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi" })')
 p.write_text(s,encoding='utf-8')
edit('eslint.config.mjs','    ".next/**",','    ".next/**",\n    ".local/**",')
edit('.env.example','DATABASE_URL=', '# Test deployments must explicitly opt into simulated subscription checkout. No bank is contacted.\nBILLING_MODE=simulated\n\nDATABASE_URL=')

# Remove executable novelty machinery while preserving only the shape of historical JSON.
p=Path('src/blueprints/social/weekly-planning/sequence.ts'); s=p.read_text(encoding='utf-8'); s=s.replace('import type { JsonSchema } from "../brand-discovery/schemas"\n','').replace('import type { PostOutline, PostsPayload } from "./posts"\n','')
start=s.index('const text ='); end=s.index('export const EDITORIAL_PROGRESS_RULES =',start); s=s[:start]+s[end:]
start=s.index('export const SEQUENCE_REVIEW_PROMPT ='); s=s[:start]; p.write_text(s,encoding='utf-8')
