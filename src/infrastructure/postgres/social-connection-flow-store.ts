import type { Pool } from "pg"
import { ConnectionFlowError, type ConnectionIntent, type ConnectionFlowSession, type SocialConnectionFlowStore } from "../../application/social-connections/connection-flow"
import type { ProviderProfileRecord } from "../../application/social-connections/connection-store"
import { PostgresSocialConnectionsStore } from "./social-connections-store"

type IntentRow = {
  id: string; provider: string; provider_profile_ref: string; requested_channel: ConnectionIntent["channel"];
  state_digest: Buffer; flow_step: ConnectionIntent["step"]; selection_options: ConnectionIntent["pages"];
  provider_context_ciphertext: Buffer | null; provider_context_iv: Buffer | null; provider_context_tag: Buffer | null;
  expires_at: Date; consumed_at: Date | null;
}

export class PostgresSocialConnectionFlowStore implements SocialConnectionFlowStore {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(ownerId: string, target: { brandId: string } | { intentId: string }, work: (session: ConnectionFlowSession) => Promise<T>): Promise<T> {
    // This independent cleanup commits even when the expired request is rejected.
    await this.pool.query(`UPDATE social_connection_intents SET provider_context_ciphertext=NULL,
      provider_context_iv=NULL,provider_context_tag=NULL,selection_options='[]',flow_step='failed',consumed_at=now(),updated_at=now()
      WHERE initiated_by_user_id=$1 AND consumed_at IS NULL AND expires_at<=now()`, [ownerId])
    const c = await this.pool.connect()
    try {
      await c.query("BEGIN")
      const brand = "brandId" in target ? target.brandId : (await c.query<{ brand_id: string }>(
        "SELECT brand_id FROM social_connection_intents WHERE id=$1 AND initiated_by_user_id=$2", [target.intentId, ownerId])).rows[0]?.brand_id
      if (!brand) throw new ConnectionFlowError("invalidFlow")
      const access = await c.query(`SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id
        WHERE b.id=$1 AND w.owner_user_id=$2 FOR UPDATE OF b`, [brand, ownerId])
      if (!access.rowCount) throw new ConnectionFlowError("invalidFlow")
      const row = "intentId" in target ? (await c.query<IntentRow>("SELECT * FROM social_connection_intents WHERE id=$1 FOR UPDATE", [target.intentId])).rows[0] : null
      const intent: ConnectionIntent | null = row ? { id: row.id, provider: row.provider, profileRef: row.provider_profile_ref,
        channel: row.requested_channel, digest: row.state_digest, step: row.flow_step, pages: row.selection_options,
        expiresAt: row.expires_at, consumedAt: row.consumed_at, context: row.provider_context_ciphertext && row.provider_context_iv && row.provider_context_tag
          ? { ciphertext: row.provider_context_ciphertext, iv: row.provider_context_iv, tag: row.provider_context_tag } : null } : null
      const result = await work({ scope: { ownerId, brandId: brand }, accounts: new PostgresSocialConnectionsStore(c), intent,
        profile: async (provider) => (await c.query<ProviderProfileRecord>(`SELECT id,brand_id AS "brandId",provider,
          provider_profile_ref AS "providerProfileRef",status FROM social_provider_profiles WHERE brand_id=$1 AND provider=$2`, [brand, provider])).rows[0] ?? null,
        createIntent: async (input) => {
          const count = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM social_connection_intents
            WHERE brand_id=$1 AND initiated_by_user_id=$2 AND created_at>now()-interval '1 hour'`, [brand, ownerId])
          if (count.rows[0]!.n >= 10) throw new ConnectionFlowError("rateLimited")
          await c.query(`INSERT INTO social_connection_intents(id,brand_id,provider,provider_profile_ref,requested_channel,
            initiated_by_user_id,state_digest,return_path,expires_at,provider_context_ciphertext,provider_context_iv,provider_context_tag)
            VALUES($1,$2,$3,$4,$5,$6,$7,'/workspace/connections',$8,$9,$10,$11)`, [input.id, brand, input.provider, input.profileRef,
            input.channel, ownerId, input.digest, input.expiresAt, input.context?.ciphertext, input.context?.iv, input.context?.tag])
        },
        select: async (pages, context) => {
          if (!intent) throw new ConnectionFlowError("invalidFlow")
          await c.query(`UPDATE social_connection_intents SET flow_step='select_page',selection_options=$2::jsonb,
            provider_context_ciphertext=$3,provider_context_iv=$4,provider_context_tag=$5,updated_at=now() WHERE id=$1`,
          [intent.id, JSON.stringify(pages), context.ciphertext, context.iv, context.tag])
        },
        consume: async (step) => {
          if (!intent) throw new ConnectionFlowError("invalidFlow")
          await c.query(`UPDATE social_connection_intents SET flow_step=$2,consumed_at=now(),updated_at=now(),selection_options='[]',
            provider_context_ciphertext=NULL,provider_context_iv=NULL,provider_context_tag=NULL WHERE id=$1`, [intent.id, step])
        },
      })
      await c.query("COMMIT")
      return result
    } catch (error) { await c.query("ROLLBACK"); throw error }
    finally { c.release() }
  }
}
