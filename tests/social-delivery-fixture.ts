import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { TestContext } from "node:test"
import { Pool } from "pg"
import type { SocialContentPublishAttempt, SocialContentPublishResult } from "../src/blueprints/social"
import { ensurePersonalWorkspace } from "../src/infrastructure/postgres/workspace-store"

export async function socialDeliveryFixture(t: TestContext) {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required; delivery integration coverage must not be skipped")
  const admin = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = `delivery_test_${randomUUID().replaceAll("-", "")}`
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort()) {
    await pool.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"))
  }
  await pool.query('INSERT INTO auth_user(id,name,email,"emailVerified") VALUES(\'owner\',\'Owner\',\'owner@example.test\',true)')
  const workspace = await ensurePersonalWorkspace(pool, "owner")
  await pool.query("INSERT INTO brands(id,created_at,workspace_id) VALUES('brand',now(),$1)", [workspace.workspaceId])
  await pool.query(`INSERT INTO social_provider_profiles(id,brand_id,provider,provider_profile_ref)
    VALUES('profile','brand','zernio','provider-profile')`)
  await pool.query(`INSERT INTO social_publishing_accounts(id,brand_id,channel,native_account_ref,display_name)
    VALUES('account','brand','facebook','native-page','Page')`)
  await pool.query(`INSERT INTO social_provider_account_bindings(id,publishing_account_id,brand_id,channel,provider,
    provider_profile_ref,provider_account_ref,connection_status,can_publish,can_fetch_analytics,capabilities,connected_at)
    VALUES('binding','account','brand','facebook','zernio','provider-profile','provider-account','connected',true,true,'{"publish":true,"analytics":true}',now())`)
  return { pool }
}

export function attempt(id: string = randomUUID(), attemptedAt = "2026-09-09T12:00:00.000Z") {
  return { id, idempotencyKey: `intent:${id}`, attemptNumber: 1, contentId: `content:${id}`, draftId: `draft:${id}`, draftVersion: 1,
    scheduleId: `schedule:${id}`, scheduleRevision: 0, publishingAccountId: "account", channel: "facebook",
    publishAt: "2026-09-09T11:00:00.000Z", attemptedAt } as SocialContentPublishAttempt
}

export function unknownResult(a: SocialContentPublishAttempt, id: string = `result:${a.id}`) {
  return { id, attemptId: a.id, idempotencyKey: a.idempotencyKey, contentId: a.contentId, draftId: a.draftId,
    draftVersion: a.draftVersion, scheduleId: a.scheduleId, scheduleRevision: a.scheduleRevision,
    publishingAccountId: a.publishingAccountId, channel: a.channel, recordedAt: "2026-09-09T12:01:00.000Z",
    status: "unknownOutcome", errorCode: "providerResponseMissing" } as SocialContentPublishResult
}

export async function prepareSchedule(pool: Pool, a: SocialContentPublishAttempt, scope = { ownerId: "owner", brandId: "brand" }) {
  const runId = randomUUID()
  const count = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM weekly_planning_runs WHERE brand_id=$1", [scope.brandId])).rows[0]!.n
  const week = new Date("2030-01-07T12:00:00Z")
  week.setUTCDate(week.getUTCDate() + count * 7)
  await pool.query(`INSERT INTO weekly_planning_runs(id,owner_user_id,brand_id,week_start,version,status,step,payload)
    VALUES($1,$2,$3,$4,1,'approved','ready','{}')`, [runId, scope.ownerId, scope.brandId, week.toISOString().slice(0, 10)])
  await pool.query("INSERT INTO weekly_post_batches(run_id,status,step,payload,approved_at,approved_by_user_id) VALUES($1,'ready','ready','{}',now(),$2)", [runId, scope.ownerId])
  await pool.query(`INSERT INTO social_publication_inputs(id,brand_id,source_weekly_run_id,post_key,channel,content_id,content_brief_id,
    content_execution_spec_id,draft_id,draft_version,bundle_schema,bundle_version,bundle)
    VALUES($1,$2,$3,'p1',$4,$5,$6,$7,$8,$9,'unda.social-publication-input',1,'{}')`,
  [`input:${a.id}`, scope.brandId, runId, a.channel, a.contentId, `brief:${a.id}`, `spec:${a.id}`, a.draftId, a.draftVersion])
  await pool.query(`INSERT INTO social_content_schedules(id,brand_id,publication_input_id,publishing_account_id,content_id,draft_id,
    draft_version,content_execution_spec_id,channel,"authorization",publish_at,scheduled_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'{"type":"humanApproved","reviewRequestId":"r","reviewDecisionId":"d"}',$10,$11)`,
  [a.scheduleId, scope.brandId, `input:${a.id}`, a.publishingAccountId, a.contentId, a.draftId, a.draftVersion,
    `spec:${a.id}`, a.channel, a.publishAt, new Date(Date.parse(a.publishAt) - 60_000).toISOString()])
}
