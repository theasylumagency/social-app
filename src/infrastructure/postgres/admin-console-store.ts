import type { Pool } from "pg"

import {
  deriveWorkspaceHealth,
  subscriptionLifecycle,
  type AdminAuditEvent,
  type AdminCustomer,
} from "../../application/admin-console/model"

type BaseRow = {
  id: string
  name: string
  email: string
  email_verified: boolean
  joined_at: Date
  workspace_id: string | null
  workspace_created_at: Date | null
  plan: string | null
  paid_at: Date | null
  expires_at: Date | null
  payment_count: number
}

type BrandRow = {
  workspace_id: string
  id: string
  name: string
  ready: boolean
  created_at: Date
}

type WorkspaceCountRow = { workspace_id: string; count: number }
type ActivityRow = { workspace_id: string; last_activity_at: Date }
type PublishingRow = {
  workspace_id: string
  affected_schedule_count: number
  unknown_outcome_count: number
  failed_publication_count: number
}
type AnalyticsRow = { workspace_id: string; last_observed_at: Date }
type WorkflowRow = { workspace_id: string; count: number }

export type AdminSubscriptionHistoryItem = {
  id: string
  plan: string
  brandLimit: number
  paidAt: string
  expiresAt: string
  mode: string
}

export type AdminBrandDetail = {
  id: string
  name: string
  ready: boolean
  createdAt: string
  strategyStatus: string | null
  planningStatus: string | null
  contentStatus: string | null
}

export type AdminConnectionDetail = {
  id: string
  channel: string
  displayName: string | null
  username: string | null
  connectionStatus: string
  canPublish: boolean
  lastKnownAt: string
  lastErrorCode: string | null
}

export type AdminPublishingSummary = {
  scheduled: number
  published: number
  unresolved: number
  failed: number
}

export type AdminCustomerDetail = {
  customer: AdminCustomer
  brands: AdminBrandDetail[]
  subscriptionHistory: AdminSubscriptionHistoryItem[]
  connections: AdminConnectionDetail[]
  publishing: AdminPublishingSummary
}

function dateIso(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

function numeric(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function listAdminCustomers(pool: Pool, now = new Date()): Promise<AdminCustomer[]> {
  const [baseResult, brandResult, connectionResult, publishingResult, activityResult, analyticsResult, workflowResult] = await Promise.all([
    pool.query<BaseRow>(`
      SELECT u.id, u.name, u.email, u."emailVerified" AS email_verified, u."createdAt" AS joined_at,
        w.id AS workspace_id, w.created_at AS workspace_created_at,
        s.plan, s.paid_at, s.expires_at,
        COALESCE(payments.payment_count, 0)::int AS payment_count
      FROM auth_user u
      LEFT JOIN workspaces w ON w.owner_user_id = u.id
      LEFT JOIN workspace_subscriptions s ON s.workspace_id = w.id
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS payment_count FROM subscription_payments p WHERE p.workspace_id = w.id
      ) payments ON true
      ORDER BY u."createdAt" DESC, u.id
    `),
    pool.query<BrandRow>(`
      SELECT b.workspace_id, b.id,
        COALESCE(latest.knowledge #>> '{identityName}', 'ახალი ბრენდი') AS name,
        COALESCE(latest.ready, false) AS ready, b.created_at
      FROM brands b
      LEFT JOIN LATERAL (
        SELECT ss.content #> '{data,knowledge}' AS knowledge,
          (ir.minimum_viable_brand->>'satisfied')::boolean AS ready
        FROM ingestion_runs ir
        JOIN source_snapshots ss ON ss.id = ir.snapshot_id AND ss.brand_id = b.id
        WHERE ir.brand_id = b.id
        ORDER BY ir.completed_at DESC, ir.id DESC LIMIT 1
      ) latest ON true
      WHERE b.workspace_id IS NOT NULL
      ORDER BY b.created_at, b.id
    `),
    pool.query<WorkspaceCountRow>(`
      SELECT b.workspace_id, count(*) FILTER (
        WHERE binding.id IS NULL OR binding.connection_status <> 'connected' OR NOT binding.can_publish
      )::int AS count
      FROM brands b
      JOIN social_publishing_accounts account ON account.brand_id = b.id
      LEFT JOIN social_provider_account_bindings binding
        ON binding.publishing_account_id = account.id AND binding.binding_status = 'active'
      WHERE b.workspace_id IS NOT NULL
      GROUP BY b.workspace_id
    `),
    pool.query<PublishingRow>(`
      SELECT w.id AS workspace_id,
        (SELECT count(*)::int
          FROM social_content_schedules schedule
          JOIN brands b ON b.id = schedule.brand_id
          LEFT JOIN social_provider_account_bindings binding
            ON binding.publishing_account_id = schedule.publishing_account_id AND binding.binding_status = 'active'
          WHERE b.workspace_id = w.id
            AND NOT EXISTS (SELECT 1 FROM social_content_schedule_events event WHERE event.schedule_id = schedule.id AND event.event_type = 'cancelled')
            AND NOT EXISTS (
              SELECT 1 FROM social_publish_attempts attempt JOIN social_publish_results result ON result.attempt_id = attempt.id
              WHERE attempt.schedule_id = schedule.id AND result.status = 'published'
            )
            AND (binding.id IS NULL OR binding.connection_status <> 'connected' OR NOT binding.can_publish)
        ) AS affected_schedule_count,
        (SELECT count(*)::int
          FROM social_publish_results result
          JOIN social_publish_attempts attempt ON attempt.id = result.attempt_id
          JOIN social_content_schedules schedule ON schedule.id = attempt.schedule_id
          JOIN brands b ON b.id = schedule.brand_id
          WHERE b.workspace_id = w.id AND result.status = 'unknownOutcome'
            AND NOT EXISTS (
              SELECT 1 FROM social_publish_reconciliations reconciliation
              WHERE reconciliation.attempt_id = attempt.id
                AND reconciliation.status IN ('publicationFound','confirmedAbsent','publicationFailed')
            )
        ) AS unknown_outcome_count,
        (SELECT count(*)::int
          FROM social_publish_results result
          JOIN social_publish_attempts attempt ON attempt.id = result.attempt_id
          JOIN social_content_schedules schedule ON schedule.id = attempt.schedule_id
          JOIN brands b ON b.id = schedule.brand_id
          WHERE b.workspace_id = w.id AND result.status IN ('retryableFailure','permanentFailure')
        ) AS failed_publication_count
      FROM workspaces w
    `),
    pool.query<ActivityRow>(`
      WITH activity AS (
        SELECT id AS workspace_id, created_at AS occurred_at FROM workspaces
        UNION ALL SELECT workspace_id, created_at FROM brands WHERE workspace_id IS NOT NULL
        UNION ALL SELECT b.workspace_id, d.confirmed_at FROM brand_dossiers d JOIN brands b ON b.id = d.brand_id WHERE b.workspace_id IS NOT NULL
        UNION ALL SELECT b.workspace_id, s.updated_at FROM social_strategies s JOIN brands b ON b.id = s.brand_id WHERE b.workspace_id IS NOT NULL
        UNION ALL SELECT b.workspace_id, p.updated_at FROM weekly_planning_runs p JOIN brands b ON b.id = p.brand_id WHERE b.workspace_id IS NOT NULL
        UNION ALL SELECT b.workspace_id, batch.updated_at FROM weekly_post_batches batch JOIN weekly_planning_runs plan ON plan.id = batch.run_id JOIN brands b ON b.id = plan.brand_id WHERE b.workspace_id IS NOT NULL
        UNION ALL SELECT b.workspace_id, schedule.scheduled_at FROM social_content_schedules schedule JOIN brands b ON b.id = schedule.brand_id WHERE b.workspace_id IS NOT NULL
        UNION ALL SELECT b.workspace_id, attempt.attempted_at FROM social_publish_attempts attempt JOIN social_content_schedules schedule ON schedule.id = attempt.schedule_id JOIN brands b ON b.id = schedule.brand_id WHERE b.workspace_id IS NOT NULL
        UNION ALL SELECT b.workspace_id, analytics.observed_at FROM social_post_analytics analytics JOIN social_publishing_accounts account ON account.id = analytics.publishing_account_id JOIN brands b ON b.id = account.brand_id WHERE b.workspace_id IS NOT NULL
      )
      SELECT workspace_id, max(occurred_at) AS last_activity_at FROM activity GROUP BY workspace_id
    `),
    pool.query<AnalyticsRow>(`
      SELECT b.workspace_id, max(analytics.observed_at) AS last_observed_at
      FROM social_post_analytics analytics
      JOIN social_publishing_accounts account ON account.id = analytics.publishing_account_id
      JOIN brands b ON b.id = account.brand_id
      WHERE b.workspace_id IS NOT NULL
      GROUP BY b.workspace_id
    `),
    pool.query<WorkflowRow>(`
      SELECT b.workspace_id, count(*) FILTER (
        WHERE strategy.status='failed' OR planning.status='failed' OR content.status='failed'
      )::int AS count
      FROM brands b
      LEFT JOIN LATERAL (SELECT status FROM social_strategies WHERE brand_id=b.id ORDER BY updated_at DESC, revision DESC LIMIT 1) strategy ON true
      LEFT JOIN LATERAL (SELECT status, id FROM weekly_planning_runs WHERE brand_id=b.id ORDER BY updated_at DESC, version DESC LIMIT 1) planning ON true
      LEFT JOIN LATERAL (SELECT status FROM weekly_post_batches WHERE run_id=planning.id) content ON true
      WHERE b.workspace_id IS NOT NULL
      GROUP BY b.workspace_id
    `),
  ])

  const brandsByWorkspace = new Map<string, BrandRow[]>()
  for (const brand of brandResult.rows) {
    const brands = brandsByWorkspace.get(brand.workspace_id) ?? []
    brands.push(brand)
    brandsByWorkspace.set(brand.workspace_id, brands)
  }
  const connectionIssues = new Map(connectionResult.rows.map((row) => [row.workspace_id, numeric(row.count)]))
  const publishing = new Map(publishingResult.rows.map((row) => [row.workspace_id, row]))
  const activity = new Map(activityResult.rows.map((row) => [row.workspace_id, row.last_activity_at]))
  const analytics = new Map(analyticsResult.rows.map((row) => [row.workspace_id, row.last_observed_at]))
  const workflowFailures = new Map(workflowResult.rows.map((row) => [row.workspace_id, numeric(row.count)]))

  return baseResult.rows.map((row) => {
    const workspaceBrands = row.workspace_id ? brandsByWorkspace.get(row.workspace_id) ?? [] : []
    const workspacePublishing = row.workspace_id ? publishing.get(row.workspace_id) : undefined
    const lifecycle = subscriptionLifecycle(row.plan ? { paidAt: row.paid_at, expiresAt: row.expires_at } : null, now)
    const lastActivity = row.workspace_id ? activity.get(row.workspace_id) ?? row.workspace_created_at ?? row.joined_at : row.joined_at
    const lastObserved = row.workspace_id ? analytics.get(row.workspace_id) ?? null : null
    const health = deriveWorkspaceHealth({
      hasWorkspace: row.workspace_id !== null,
      brandCount: workspaceBrands.length,
      readyBrandCount: workspaceBrands.filter((brand) => brand.ready).length,
      subscriptionLifecycle: lifecycle,
      connectionIssueCount: row.workspace_id ? connectionIssues.get(row.workspace_id) ?? 0 : 0,
      affectedScheduleCount: numeric(workspacePublishing?.affected_schedule_count),
      unknownOutcomeCount: numeric(workspacePublishing?.unknown_outcome_count),
      failedPublicationCount: numeric(workspacePublishing?.failed_publication_count),
      workflowFailureCount: row.workspace_id ? workflowFailures.get(row.workspace_id) ?? 0 : 0,
      analyticsLastObservedAt: dateIso(lastObserved),
      lastMeaningfulActivityAt: lastActivity.toISOString(),
      now,
    })
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.email_verified,
      joinedAt: row.joined_at.toISOString(),
      workspaceId: row.workspace_id,
      workspaceCreatedAt: dateIso(row.workspace_created_at),
      brandIds: workspaceBrands.map((brand) => brand.id),
      brandNames: workspaceBrands.map((brand) => brand.name),
      readyBrandCount: workspaceBrands.filter((brand) => brand.ready).length,
      subscription: {
        lifecycle,
        plan: row.plan,
        paidAt: dateIso(row.paid_at),
        expiresAt: dateIso(row.expires_at),
        paymentCount: numeric(row.payment_count),
      },
      health: health.status,
      healthReasons: health.reasons,
      lastMeaningfulActivityAt: lastActivity.toISOString(),
      affectedScheduleCount: numeric(workspacePublishing?.affected_schedule_count),
      unknownOutcomeCount: numeric(workspacePublishing?.unknown_outcome_count),
      failedPublicationCount: numeric(workspacePublishing?.failed_publication_count),
      workflowFailureCount: row.workspace_id ? workflowFailures.get(row.workspace_id) ?? 0 : 0,
      analyticsLastObservedAt: dateIso(lastObserved),
    }
  })
}

export async function readAdminCustomerDetail(pool: Pool, customerId: string): Promise<AdminCustomerDetail | null> {
  const customers = await listAdminCustomers(pool)
  const customer = customers.find((item) => item.id === customerId)
  if (!customer) return null
  if (!customer.workspaceId) return {
    customer, brands: [], subscriptionHistory: [], connections: [],
    publishing: { scheduled: 0, published: 0, unresolved: 0, failed: 0 },
  }

  const [brandResult, subscriptionResult, connectionResult, publishingResult] = await Promise.all([
    pool.query<{
      id: string; name: string; ready: boolean; created_at: Date
      strategy_status: string | null; planning_status: string | null; content_status: string | null
    }>(`
      SELECT b.id, COALESCE(latest.knowledge #>> '{identityName}', 'ახალი ბრენდი') AS name,
        COALESCE(latest.ready, false) AS ready, b.created_at,
        strategy.status AS strategy_status, planning.status AS planning_status, content.status AS content_status
      FROM brands b
      LEFT JOIN LATERAL (
        SELECT ss.content #> '{data,knowledge}' AS knowledge, (ir.minimum_viable_brand->>'satisfied')::boolean AS ready
        FROM ingestion_runs ir JOIN source_snapshots ss ON ss.id = ir.snapshot_id AND ss.brand_id = b.id
        WHERE ir.brand_id = b.id ORDER BY ir.completed_at DESC, ir.id DESC LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (SELECT status FROM social_strategies WHERE brand_id=b.id ORDER BY updated_at DESC, revision DESC LIMIT 1) strategy ON true
      LEFT JOIN LATERAL (SELECT status, id FROM weekly_planning_runs WHERE brand_id=b.id ORDER BY updated_at DESC, version DESC LIMIT 1) planning ON true
      LEFT JOIN LATERAL (SELECT status FROM weekly_post_batches WHERE run_id=planning.id) content ON true
      WHERE b.workspace_id=$1 ORDER BY b.created_at, b.id
    `, [customer.workspaceId]),
    pool.query<{ id: string; plan: string; brand_limit: number; paid_at: Date; expires_at: Date; mode: string }>(`
      SELECT id::text, plan, brand_limit, paid_at, expires_at, mode
      FROM subscription_payments WHERE workspace_id=$1 ORDER BY paid_at DESC, id DESC
    `, [customer.workspaceId]),
    pool.query<{
      id: string; channel: string; display_name: string | null; username: string | null
      connection_status: string | null; can_publish: boolean | null; last_known_at: Date; last_error_code: string | null
    }>(`
      SELECT account.id, account.channel, account.display_name, account.username,
        binding.connection_status, binding.can_publish,
        COALESCE(binding.health_checked_at, binding.updated_at, account.updated_at) AS last_known_at,
        COALESCE(binding.capabilities->>'lastErrorCode', profile.last_error_code) AS last_error_code
      FROM social_publishing_accounts account
      JOIN brands b ON b.id=account.brand_id
      LEFT JOIN social_provider_account_bindings binding
        ON binding.publishing_account_id=account.id AND binding.binding_status='active'
      LEFT JOIN social_provider_profiles profile ON profile.brand_id=b.id AND profile.provider=binding.provider
      WHERE b.workspace_id=$1 ORDER BY account.channel, account.created_at
    `, [customer.workspaceId]),
    pool.query<{ scheduled: number; published: number; unresolved: number; failed: number }>(`
      SELECT
        count(DISTINCT schedule.id) FILTER (
          WHERE NOT EXISTS (SELECT 1 FROM social_content_schedule_events event WHERE event.schedule_id=schedule.id AND event.event_type='cancelled')
            AND NOT EXISTS (SELECT 1 FROM social_publish_attempts a JOIN social_publish_results r ON r.attempt_id=a.id WHERE a.schedule_id=schedule.id AND r.status='published')
        )::int AS scheduled,
        count(DISTINCT result.id) FILTER (WHERE result.status='published')::int AS published,
        count(DISTINCT result.id) FILTER (WHERE result.status='unknownOutcome')::int AS unresolved,
        count(DISTINCT result.id) FILTER (WHERE result.status IN ('retryableFailure','permanentFailure'))::int AS failed
      FROM brands b
      LEFT JOIN social_content_schedules schedule ON schedule.brand_id=b.id
      LEFT JOIN social_publish_attempts attempt ON attempt.schedule_id=schedule.id
      LEFT JOIN social_publish_results result ON result.attempt_id=attempt.id
      WHERE b.workspace_id=$1
    `, [customer.workspaceId]),
  ])

  return {
    customer,
    brands: brandResult.rows.map((row) => ({
      id: row.id, name: row.name, ready: row.ready, createdAt: row.created_at.toISOString(),
      strategyStatus: row.strategy_status, planningStatus: row.planning_status, contentStatus: row.content_status,
    })),
    subscriptionHistory: subscriptionResult.rows.map((row) => ({
      id: row.id, plan: row.plan, brandLimit: row.brand_limit,
      paidAt: row.paid_at.toISOString(), expiresAt: row.expires_at.toISOString(), mode: row.mode,
    })),
    connections: connectionResult.rows.map((row) => ({
      id: row.id, channel: row.channel, displayName: row.display_name, username: row.username,
      connectionStatus: row.connection_status ?? "disconnected", canPublish: row.can_publish === true,
      lastKnownAt: row.last_known_at.toISOString(), lastErrorCode: row.last_error_code,
    })),
    publishing: {
      scheduled: numeric(publishingResult.rows[0]?.scheduled),
      published: numeric(publishingResult.rows[0]?.published),
      unresolved: numeric(publishingResult.rows[0]?.unresolved),
      failed: numeric(publishingResult.rows[0]?.failed),
    },
  }
}

export async function readAdminAudit(pool: Pool, limit = 80): Promise<AdminAuditEvent[]> {
  const result = await pool.query<{
    id: string; occurred_at: Date; category: AdminAuditEvent["category"]; title: string; detail: string
    customer_id: string; customer_name: string; actor: string
  }>(`
    WITH brand_names AS (
      SELECT b.id, COALESCE(latest.knowledge #>> '{identityName}', 'ახალი ბრენდი') AS name
      FROM brands b
      LEFT JOIN LATERAL (
        SELECT ss.content #> '{data,knowledge}' AS knowledge
        FROM ingestion_runs ir JOIN source_snapshots ss ON ss.id=ir.snapshot_id AND ss.brand_id=b.id
        WHERE ir.brand_id=b.id ORDER BY ir.completed_at DESC, ir.id DESC LIMIT 1
      ) latest ON true
    ), events AS (
      SELECT 'payment:' || payment.id::text AS id, payment.paid_at AS occurred_at, 'subscription'::text AS category,
        'გამოწერა გააქტიურდა' AS title,
        payment.plan || ' · ' || payment.brand_limit::text || ' ბრენდი · მოქმედებს ' || payment.expires_at::date::text || '-მდე' AS detail,
        user_account.id AS customer_id, user_account.name AS customer_name, 'სისტემა' AS actor
      FROM subscription_payments payment
      JOIN workspaces workspace ON workspace.id=payment.workspace_id
      JOIN auth_user user_account ON user_account.id=workspace.owner_user_id
      UNION ALL
      SELECT 'dossier:' || dossier.id::text, dossier.confirmed_at, 'onboarding',
        'ბრენდის საფუძველი დადასტურდა', brand.name,
        user_account.id, user_account.name, confirmer.name
      FROM brand_dossiers dossier
      JOIN brands b ON b.id=dossier.brand_id
      JOIN brand_names brand ON brand.id=b.id
      JOIN workspaces workspace ON workspace.id=b.workspace_id
      JOIN auth_user user_account ON user_account.id=workspace.owner_user_id
      JOIN auth_user confirmer ON confirmer.id=dossier.confirmed_by
      UNION ALL
      SELECT 'connection:' || binding.id, binding.updated_at, 'connection',
        CASE WHEN binding.connection_status='connected' AND binding.can_publish THEN 'სოციალური კავშირი გამართულია' ELSE 'სოციალური კავშირი შეფერხებულია' END,
        brand.name || ' · ' || account.channel,
        user_account.id, user_account.name, 'სისტემა'
      FROM social_provider_account_bindings binding
      JOIN social_publishing_accounts account ON account.id=binding.publishing_account_id
      JOIN brands b ON b.id=account.brand_id
      JOIN brand_names brand ON brand.id=b.id
      JOIN workspaces workspace ON workspace.id=b.workspace_id
      JOIN auth_user user_account ON user_account.id=workspace.owner_user_id
      WHERE binding.binding_status='active'
      UNION ALL
      SELECT 'publish:' || result.id, result.recorded_at, 'publishing',
        CASE result.status WHEN 'published' THEN 'პუბლიკაცია გამოქვეყნდა' WHEN 'unknownOutcome' THEN 'პუბლიკაციის შედეგი დაუდგენელია' ELSE 'პუბლიკაცია ვერ დასრულდა' END,
        brand.name || ' · ' || attempt.channel,
        user_account.id, user_account.name, 'გამომცემლობის სისტემა'
      FROM social_publish_results result
      JOIN social_publish_attempts attempt ON attempt.id=result.attempt_id
      JOIN social_content_schedules schedule ON schedule.id=attempt.schedule_id
      JOIN brands b ON b.id=schedule.brand_id
      JOIN brand_names brand ON brand.id=b.id
      JOIN workspaces workspace ON workspace.id=b.workspace_id
      JOIN auth_user user_account ON user_account.id=workspace.owner_user_id
      WHERE result.status IN ('published','permanentFailure','unknownOutcome')
    )
    SELECT id, occurred_at, category, title, detail, customer_id, customer_name, actor
    FROM events ORDER BY occurred_at DESC, id DESC LIMIT $1
  `, [limit])
  return result.rows.map((row) => ({
    id: row.id, occurredAt: row.occurred_at.toISOString(), category: row.category,
    title: row.title, detail: row.detail, customerId: row.customer_id,
    customerName: row.customer_name, actor: row.actor,
  }))
}
