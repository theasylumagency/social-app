import { randomUUID } from "node:crypto"
import type { Pool } from "pg"
import { purchaseSubscription } from "../src/infrastructure/postgres/subscription-store"
import { claimDiscovery, confirmDiscovery, finishDiscoveryStep, saveDiscoveryDraft, startDiscovery } from "../src/infrastructure/postgres/brand-discovery-store"
import { completeFixture, note } from "./brand-discovery-fixture"
import { strategyProposal } from "./social-strategy-fixture"
import { approveStrategy, proposeStrategy } from "../src/infrastructure/postgres/social-strategy-store"

export async function subscribeFixture(pool: Pool, ownerId: string) {
  await purchaseSubscription(pool, ownerId, randomUUID(), "agency")
}
export async function strategicBrandFixture(pool: Pool, ownerId = "owner") {
  const input = { website: "", notes: note, language: "ka" as const }
  const draft = await saveDiscoveryDraft(pool, ownerId, randomUUID(), input, null)
  await startDiscovery(pool, ownerId, draft.id, draft.revision, input)
  const claim = (await claimDiscovery(pool, ownerId, draft.id))!
  const d = await completeFixture(claim.session)
  await finishDiscoveryStep(pool, claim.session, claim.token, d.payload, "ready")
  const brandId = await confirmDiscovery(pool, ownerId, draft.id, draft.revision, [], "ka")
  const strategy = await proposeStrategy(pool, ownerId, { id: randomUUID(), brandId })
  strategy.payload.proposal = strategyProposal()
  strategy.payload.sources = []
  await pool.query("UPDATE social_strategies SET status='proposed',payload=$2::jsonb WHERE id=$1", [strategy.id, JSON.stringify(strategy.payload)])
  await approveStrategy(pool, ownerId, brandId, strategy.id, strategy.revision)
  return brandId
}
