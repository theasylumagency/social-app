import type { Pool } from "pg"
import { claimStrategy, readWeekEvidence } from "../infrastructure/postgres/social-strategy-store"
import { inspectSocialPresence } from "../application/social-strategy/reconnaissance"
import { STRATEGY_SCHEMA, validateStrategyProposal, type SocialStrategyProposal } from "../blueprints/social/strategy/model"
import { SOCIAL_STRATEGY_PROMPT } from "../blueprints/social/strategy/prompt"
import { createBrandReasoner } from "../infrastructure/models/brand-reasoning"
import { modelFailure } from "../infrastructure/models/runtime-policy"

export async function runSocialStrategy(pool: Pool, ownerId: string, id: string) {
  const claim = await claimStrategy(pool, ownerId, id)
  if (!claim) return
  const { strategy: s, token } = claim
  const p = structuredClone(s.payload)
  try {
    if (!p.sources) {
      const accounts = await pool.query<{ profile_url: string | null }>("SELECT profile_url FROM social_publishing_accounts WHERE brand_id=$1", [s.brandId])
      p.sources = await inspectSocialPresence(p.basis, accounts.rows.flatMap((a) => a.profile_url ? [a.profile_url] : []))
      const saved = await pool.query("UPDATE social_strategies SET payload=$3::jsonb WHERE id=$1 AND lease_token=$2 AND lease_until>now()", [id, token, JSON.stringify(p)])
      if (!saved.rowCount) return
    }
    const reason = createBrandReasoner(async (run) => { await pool.query("INSERT INTO social_strategy_model_runs(id,strategy_id,payload) VALUES($1,$2,$3::jsonb)", [run.id, id, JSON.stringify(run)]) }, { model: process.env.OPENAI_PLANNING_MODEL?.trim() || "gpt-5.6-terra", reasoningEffort: "low" })
    p.proposal = await reason<SocialStrategyProposal>({ step: "social_strategy", version: "social-strategy-v1", prompt: SOCIAL_STRATEGY_PROMPT, input: { brand: p.basis.payload.understanding, audiences: p.basis.payload.landscape, envelope: p.basis.payload.envelope, socialSources: p.sources, previousProposal: p.previousProposal, revisionReason: p.reason, founderComment: p.comment, evidence: await readWeekEvidence(pool, ownerId, s.brandId) }, schema: STRATEGY_SCHEMA, validate: (value) => validateStrategyProposal(value as SocialStrategyProposal, p.sources!) })
    await pool.query("UPDATE social_strategies SET status='proposed',payload=$3::jsonb,lease_token=NULL,lease_until=NULL,error=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND lease_until>now()", [id, token, JSON.stringify(p)])
  } catch (error) {
    console.error("Social strategy failed", { id, ...modelFailure(error) })
    await pool.query("UPDATE social_strategies SET status='failed',lease_token=NULL,lease_until=NULL,error=$3,updated_at=now() WHERE id=$1 AND lease_token=$2", [id, token, "რეკომენდაციის მომზადება დროებით შეწყდა. შენახული კვლევიდან შეგიძლიათ ხელახლა სცადოთ."])
  }
}
