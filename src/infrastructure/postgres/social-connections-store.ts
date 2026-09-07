import type { Pool, PoolClient } from "pg"
import type { SocialPublishingAccountId } from "../../blueprints/social/content-publish-eligibility"
import { SOCIAL_CHANNELS } from "../../blueprints/social/tokens"
import {
  SocialConnectionConflict,
  type ActivateProviderBindingInput, type ProviderAccountBinding, type ProviderBindingHealth,
  type ProviderProfileRecord, type PublishingAccountRecord, type SocialConnectionsStore,
  type SocialConnectionScope,
} from "../../application/social-connections/connection-store"

const accountFields = `id, brand_id AS "brandId", channel, native_account_ref AS "nativeAccountRef",
  username, display_name AS "displayName", profile_url AS "profileUrl"`
const profileFields = `id, brand_id AS "brandId", provider, provider_profile_ref AS "providerProfileRef", status`
const bindingFields = `id, publishing_account_id AS "publishingAccountId", channel, provider,
  provider_profile_ref AS "providerProfileRef", provider_account_ref AS "providerAccountRef",
  binding_status AS "bindingStatus", connection_status AS "connectionStatus", can_publish AS "canPublish",
  can_fetch_analytics AS "canFetchAnalytics", capabilities`

const capabilityNames = new Set(["publish", "analytics", "images", "carousel", "stories", "reels"])
function assertHealth(health: ProviderBindingHealth) {
  if (!["connected", "disconnected", "error"].includes(health.connectionStatus)
    || typeof health.canPublish !== "boolean" || typeof health.canFetchAnalytics !== "boolean"
    || !health.capabilities || Array.isArray(health.capabilities)
    || Object.entries(health.capabilities).some(([key, value]) => !capabilityNames.has(key) || typeof value !== "boolean")) {
    throw new SocialConnectionConflict("Invalid connection capabilities")
  }
}

/** Owner-scoped application port, using the same brand/workspace ownership as other stores. */
export class PostgresSocialConnectionsStore implements SocialConnectionsStore {
  constructor(private readonly pool: Pool | PoolClient) {}

  private async transaction<T>(scope: SocialConnectionScope, work: (c: PoolClient) => Promise<T>): Promise<T> {
    // A connection-flow transaction can reuse this port and commit the account,
    // binding, and consumed intent together. It already holds the brand lock.
    if ("release" in this.pool) {
      const access = await this.pool.query(`SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id
        WHERE b.id=$1 AND w.owner_user_id=$2 FOR UPDATE OF b`, [scope.brandId, scope.ownerId])
      if (!access.rowCount) throw new Error("Brand access denied")
      return work(this.pool)
    }
    const c = await this.pool.connect()
    try {
      await c.query("BEGIN")
      // Serializes account/binding mutations. Future attempt claiming must use this same
      // brand lock when capturing its binding so migration cannot race a dispatch.
      const access = await c.query(`SELECT b.id FROM brands b JOIN workspaces w ON w.id=b.workspace_id
        WHERE b.id=$1 AND w.owner_user_id=$2 FOR UPDATE OF b`, [scope.brandId, scope.ownerId])
      if (!access.rowCount) throw new Error("Brand access denied")
      const result = await work(c)
      await c.query("COMMIT")
      return result
    } catch (error) {
      await c.query("ROLLBACK")
      throw error
    } finally { c.release() }
  }

  async saveProfile(scope: SocialConnectionScope, profile: Omit<ProviderProfileRecord, "brandId" | "status">) {
    return this.transaction(scope, async (c) => {
      const existing = await c.query<ProviderProfileRecord>(`SELECT ${profileFields} FROM social_provider_profiles
        WHERE brand_id=$1 AND provider=$2`, [scope.brandId, profile.provider])
      if (existing.rows[0]) {
        if (existing.rows[0].id !== profile.id || existing.rows[0].providerProfileRef !== profile.providerProfileRef) {
          throw new SocialConnectionConflict("Provider profile identity cannot be replaced in place")
        }
        return existing.rows[0]
      }
      const r = await c.query<ProviderProfileRecord>(`INSERT INTO social_provider_profiles(id,brand_id,provider,provider_profile_ref)
        VALUES($1,$2,$3,$4) RETURNING ${profileFields}`, [profile.id, scope.brandId, profile.provider, profile.providerProfileRef])
      return r.rows[0]!
    })
  }

  async saveAccount(scope: SocialConnectionScope, account: Omit<PublishingAccountRecord, "brandId">) {
    return this.transaction(scope, async (c) => {
      const existing = await c.query<PublishingAccountRecord>(`SELECT ${accountFields} FROM social_publishing_accounts WHERE id=$1`, [account.id])
      const old = existing.rows[0]
      if (old && (old.brandId !== scope.brandId || old.channel !== account.channel
        || (old.nativeAccountRef !== null && account.nativeAccountRef !== old.nativeAccountRef))) {
        throw new SocialConnectionConflict("Canonical account identity cannot be replaced")
      }
      const r = await c.query<PublishingAccountRecord>(`INSERT INTO social_publishing_accounts
        (id,brand_id,channel,native_account_ref,username,display_name,profile_url) VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(id) DO UPDATE SET native_account_ref=EXCLUDED.native_account_ref,username=EXCLUDED.username,
          display_name=EXCLUDED.display_name,profile_url=EXCLUDED.profile_url,updated_at=now()
        RETURNING ${accountFields}`, [account.id, scope.brandId, account.channel, account.nativeAccountRef,
        account.username, account.displayName, account.profileUrl])
      return r.rows[0]!
    })
  }

  async listAccounts(scope: SocialConnectionScope) {
    return this.transaction(scope, async (c) => (await c.query<PublishingAccountRecord>(
      `SELECT ${accountFields} FROM social_publishing_accounts WHERE brand_id=$1 ORDER BY created_at,id`, [scope.brandId])).rows)
  }

  async listBindings(scope: SocialConnectionScope, accountId: SocialPublishingAccountId) {
    return this.transaction(scope, async (c) => (await c.query<ProviderAccountBinding>(
      `SELECT ${bindingFields} FROM social_provider_account_bindings WHERE brand_id=$1 AND publishing_account_id=$2 ORDER BY created_at,id`,
      [scope.brandId, accountId])).rows)
  }

  async activateBinding(scope: SocialConnectionScope, input: ActivateProviderBindingInput) {
    assertHealth(input)
    return this.transaction(scope, async (c) => {
      const account = (await c.query<PublishingAccountRecord>(`SELECT ${accountFields} FROM social_publishing_accounts
        WHERE id=$1 AND brand_id=$2 AND channel=$3 FOR UPDATE`, [input.publishingAccountId, scope.brandId, input.channel])).rows[0]
      if (!account) throw new SocialConnectionConflict("Publishing account not found")
      const profile = await c.query(`SELECT id FROM social_provider_profiles
        WHERE brand_id=$1 AND provider=$2 AND provider_profile_ref=$3 AND status='active' FOR SHARE`,
      [scope.brandId, input.provider, input.providerProfileRef])
      if (!profile.rowCount) throw new SocialConnectionConflict("Active provider profile not found")
      const active = (await c.query<ProviderAccountBinding>(`SELECT ${bindingFields} FROM social_provider_account_bindings
        WHERE publishing_account_id=$1 AND binding_status='active' FOR UPDATE`, [account.id])).rows[0]
      if (active?.id === input.id && active.provider === input.provider
        && active.providerProfileRef === input.providerProfileRef && active.providerAccountRef === input.providerAccountRef) return active
      if ((active?.id ?? null) !== input.expectedActiveBindingId) throw new SocialConnectionConflict("Active provider binding changed")
      if ((account.nativeAccountRef !== null && account.nativeAccountRef !== input.verifiedNativeAccountRef)
        || (active && account.nativeAccountRef === null)) {
        throw new SocialConnectionConflict("Verified native account identity is required for this binding")
      }
      // No dispatch journal/reconciliation store exists until Phase 3. Conservatively
      // block every result-less or unknown attempt, including first-binding recovery.
      const unresolved = await c.query(`SELECT a.id FROM social_publish_attempts a
        LEFT JOIN social_publish_results r ON r.attempt_id=a.id
        WHERE a.publishing_account_id=$1 AND (r.id IS NULL OR r.status='unknownOutcome') LIMIT 1`, [account.id])
      if (unresolved.rowCount) throw new SocialConnectionConflict("Unresolved publication attempt prevents binding replacement")
      if (active) await c.query("UPDATE social_provider_account_bindings SET binding_status='retired',updated_at=now() WHERE id=$1", [active.id])
      const r = await c.query<ProviderAccountBinding>(`INSERT INTO social_provider_account_bindings
        (id,publishing_account_id,brand_id,channel,provider,provider_profile_ref,provider_account_ref,
         connection_status,can_publish,can_fetch_analytics,capabilities,connected_at,disconnected_at,health_checked_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,
          CASE WHEN $8='connected' THEN now() END,CASE WHEN $8='disconnected' THEN now() END,now())
        RETURNING ${bindingFields}`, [input.id, account.id, scope.brandId, input.channel, input.provider,
        input.providerProfileRef, input.providerAccountRef, input.connectionStatus, input.canPublish,
        input.canFetchAnalytics, JSON.stringify(input.capabilities)])
      return r.rows[0]!
    })
  }

  async updateBindingHealth(scope: SocialConnectionScope, bindingId: string, health: ProviderBindingHealth) {
    assertHealth(health)
    await this.transaction(scope, async (c) => {
      const r = await c.query(`UPDATE social_provider_account_bindings SET connection_status=$3,can_publish=$4,
        can_fetch_analytics=$5,capabilities=$6::jsonb,health_checked_at=now(),updated_at=now(),
        connected_at=CASE WHEN $3='connected' AND connection_status<>'connected' THEN now() ELSE connected_at END,
        disconnected_at=CASE WHEN $3='disconnected' AND connection_status<>'disconnected' THEN now() ELSE disconnected_at END
        WHERE id=$1 AND brand_id=$2 AND binding_status='active'`, [bindingId, scope.brandId, health.connectionStatus,
        health.canPublish, health.canFetchAnalytics, JSON.stringify(health.capabilities)])
      if (!r.rowCount) throw new SocialConnectionConflict("Active provider binding not found")
    })
  }

  async resolveAccount(scope: SocialConnectionScope, accountId: SocialPublishingAccountId) {
    return this.transaction(scope, async (c) => {
      const binding = (await c.query<ProviderAccountBinding>(`SELECT ${bindingFields} FROM social_provider_account_bindings
        WHERE brand_id=$1 AND publishing_account_id=$2 AND binding_status='active'`, [scope.brandId, accountId])).rows[0]
      if (!binding) return null
      const profile = await c.query(`SELECT id FROM social_provider_profiles WHERE brand_id=$1 AND provider=$2
        AND provider_profile_ref=$3 AND status='active'`, [scope.brandId, binding.provider, binding.providerProfileRef])
      return { binding, account: {
        id: accountId, channel: SOCIAL_CHANNELS[binding.channel], providerAccountRef: binding.providerAccountRef,
        connected: profile.rowCount === 1 && binding.connectionStatus === "connected" && binding.canPublish,
      } }
    })
  }
}
