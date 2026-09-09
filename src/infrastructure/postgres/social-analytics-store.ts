import { createHash } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type { AnalyticsCursor, AnalyticsProfile, NormalizedSocialAnalytics, SocialAnalyticsResult,
  SocialAnalyticsStore } from "../../application/analytics/social-analytics-store"
import { SOCIAL_METRIC_NAMES } from "../../application/analytics/social-analytics-store"

const stableId = (bindingId: string, publicationRef: string, updatedAt: string) => `social:analytics:${createHash("sha256").update([bindingId, publicationRef, updatedAt].join("\u0000")).digest("hex")}`
export class PostgresSocialAnalyticsStore implements SocialAnalyticsStore {
  constructor(private readonly pool: Pool) {}
  async listProfiles(provider: string): Promise<readonly AnalyticsProfile[]> {
    const rows = await this.pool.query<{ provider: string; provider_profile_ref: string }>(`SELECT DISTINCT p.provider,p.provider_profile_ref
      FROM social_provider_profiles p JOIN social_provider_account_bindings b ON b.brand_id=p.brand_id AND b.provider=p.provider
        AND b.provider_profile_ref=p.provider_profile_ref
      WHERE p.provider=$1 AND p.status='active' AND b.binding_status='active' AND b.connection_status='connected' AND b.can_fetch_analytics=true
      ORDER BY p.provider_profile_ref`, [provider])
    return rows.rows.map((row) => ({ provider: row.provider, providerProfileRef: row.provider_profile_ref }))
  }
  async readCursor(profile: AnalyticsProfile): Promise<AnalyticsCursor | null> {
    const row = (await this.pool.query<{ cursor: string | null; bootstrapped_at: Date | null }>(`SELECT cursor,bootstrapped_at FROM social_analytics_cursors
      WHERE provider=$1 AND provider_profile_ref=$2`, [profile.provider, profile.providerProfileRef])).rows[0]
    return row ? { cursor: row.cursor, bootstrapped: row.bootstrapped_at !== null } : null
  }
  async resetCursor(profile: AnalyticsProfile, expectedCursor: string | null) {
    const result = await this.pool.query(`UPDATE social_analytics_cursors SET cursor=NULL,bootstrapped_at=NULL,updated_at=now()
      WHERE provider=$1 AND provider_profile_ref=$2 AND cursor IS NOT DISTINCT FROM $3`,
    [profile.provider, profile.providerProfileRef, expectedCursor])
    return result.rowCount === 1
  }
  async commit(profile: AnalyticsProfile, observations: readonly NormalizedSocialAnalytics[], nextCursor: string | null,
    options: { readonly markBootstrapped?: boolean; readonly expectedCursor?: string | null } = {}) {
    if (nextCursor !== null && (!nextCursor || nextCursor.length > 8000)) throw new Error("Invalid analytics cursor")
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))", [profile.provider, profile.providerProfileRef])
      const profileRow = await client.query(`SELECT id FROM social_provider_profiles WHERE provider=$1 AND provider_profile_ref=$2 FOR UPDATE`,
        [profile.provider, profile.providerProfileRef])
      if (!profileRow.rowCount) throw new Error("Analytics provider profile not found")
      if (Object.hasOwn(options, "expectedCursor")) {
        const current = (await client.query<{ cursor: string | null }>(`SELECT cursor FROM social_analytics_cursors
          WHERE provider=$1 AND provider_profile_ref=$2`, [profile.provider, profile.providerProfileRef])).rows[0]?.cursor ?? null
        if (current !== options.expectedCursor) throw new Error("Analytics cursor advanced concurrently")
      }
      for (const observation of observations) await this.insert(client, profile, observation)
      await client.query(`INSERT INTO social_analytics_cursors(provider,provider_profile_ref,cursor,bootstrapped_at)
        VALUES($1,$2,$3,CASE WHEN $4 THEN now() END)
        ON CONFLICT(provider,provider_profile_ref) DO UPDATE SET cursor=CASE WHEN $3::text IS NULL THEN social_analytics_cursors.cursor ELSE $3 END,
          bootstrapped_at=CASE WHEN $4 THEN coalesce(social_analytics_cursors.bootstrapped_at,now()) ELSE social_analytics_cursors.bootstrapped_at END,updated_at=now()`,
      [profile.provider, profile.providerProfileRef, nextCursor, options.markBootstrapped === true])
      await client.query("COMMIT")
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  }
  private async insert(client: PoolClient, profile: AnalyticsProfile, observation: NormalizedSocialAnalytics) {
    if (observation.provider !== profile.provider || observation.providerProfileRef !== profile.providerProfileRef) throw new Error("Analytics profile mismatch")
    const binding = (await client.query<{ id: string; publishing_account_id: string }>(`SELECT b.id,b.publishing_account_id
      FROM social_provider_account_bindings b WHERE b.provider=$1 AND b.provider_profile_ref=$2 AND b.provider_account_ref=$3 AND b.channel=$4
        AND b.can_fetch_analytics=true AND EXISTS(SELECT 1 FROM social_provider_publish_requests j JOIN social_publish_attempts a ON a.id=j.attempt_id
          WHERE j.provider_binding_id=b.id AND a.publishing_account_id=b.publishing_account_id
            AND ($5=j.provider_publication_ref OR $5=j.duplicate_publication_ref))`,
    [profile.provider, profile.providerProfileRef, observation.providerAccountRef, observation.channel, observation.providerPublicationRef])).rows[0]
    if (!binding) throw new Error("Analytics observation is not an UNDA publication for this binding")
    const m = observation.metrics
    await client.query(`INSERT INTO social_post_analytics(id,publishing_account_id,provider_binding_id,provider,provider_publication_ref,
      native_publication_ref,publication_url,provider_updated_at,observed_at,impressions,reach,likes,comments,shares,saves,clicks,views,follows,
      engagement_rate,metric_availability,raw_metrics) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb)
      ON CONFLICT(provider_binding_id,provider_publication_ref,provider_updated_at) DO NOTHING`,
    [stableId(binding.id, observation.providerPublicationRef, observation.providerUpdatedAt), binding.publishing_account_id, binding.id,
      observation.provider, observation.providerPublicationRef, observation.nativePublicationRef, observation.publicationUrl,
      observation.providerUpdatedAt, observation.observedAt, ...SOCIAL_METRIC_NAMES.map((name) => m[name]), m.engagementRate,
      JSON.stringify(observation.availability), JSON.stringify(observation.rawMetrics)])
  }
  async listResults(scope: { ownerId: string; brandId: string }): Promise<readonly SocialAnalyticsResult[]> {
    const rows = await this.pool.query(`SELECT a.*,b.provider_profile_ref,b.provider_account_ref,b.channel FROM social_post_analytics a
      JOIN social_provider_account_bindings b ON b.id=a.provider_binding_id JOIN social_publishing_accounts p ON p.id=a.publishing_account_id
      JOIN brands brand ON brand.id=p.brand_id JOIN workspaces w ON w.id=brand.workspace_id
      WHERE p.brand_id=$1 AND w.owner_user_id=$2 ORDER BY a.provider_updated_at DESC,a.id`, [scope.brandId, scope.ownerId])
    return rows.rows.map((row) => ({ provider: row.provider, providerProfileRef: row.provider_profile_ref,
      providerAccountRef: row.provider_account_ref, channel: row.channel, providerPublicationRef: row.provider_publication_ref,
      nativePublicationRef: row.native_publication_ref, publicationUrl: row.publication_url,
      providerUpdatedAt: row.provider_updated_at.toISOString(), observedAt: row.observed_at.toISOString(),
      metrics: Object.fromEntries([...SOCIAL_METRIC_NAMES.map((name) => [name, row[name] === null ? null : Number(row[name])]),
        ["engagementRate", row.engagement_rate === null ? null : Number(row.engagement_rate)]]) as SocialAnalyticsResult["metrics"],
      availability: row.metric_availability, rawMetrics: row.raw_metrics, publishingAccountId: row.publishing_account_id,
      providerBindingId: row.provider_binding_id }))
  }
}
