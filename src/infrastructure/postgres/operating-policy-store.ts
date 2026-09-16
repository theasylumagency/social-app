import { randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type { ChannelOperatingPolicy, OperatingRule, OperatingRuleDraft, SocialChannel } from "../../core/domain/operating-policy"
import { ruleScopeOverlaps, ruleSubject, SOCIAL_CHANNELS } from "../../core/domain/operating-policy"

type RuleRow = { id: string; revision: number; status: OperatingRule["status"]; kind: OperatingRule["kind"]; effect: OperatingRule["effect"]; parameter: string | null; directive: string; scope: OperatingRule["scope"]; source_note_id: string; superseded_by: string | null; activated_at: Date; deactivated_at: Date | null }
const fromRule = (r: RuleRow): OperatingRule => ({ id: r.id, revision: r.revision, status: r.status, kind: r.kind, effect: r.effect, parameter: r.parameter, directive: r.directive, scope: r.scope, sourceNoteId: r.source_note_id, supersededBy: r.superseded_by, activatedAt: r.activated_at.toISOString(), deactivatedAt: r.deactivated_at?.toISOString() ?? null })

export async function listOperatingRules(db: Pool | PoolClient, ownerId: string, brandId: string, activeOnly = true) {
  const rows = await db.query<RuleRow>(`SELECT r.* FROM brand_operating_rules r JOIN brands b ON b.id=r.brand_id JOIN workspaces w ON w.id=b.workspace_id
    WHERE r.owner_user_id=$1 AND r.brand_id=$2 AND w.owner_user_id=$1 ${activeOnly ? "AND r.status='active'" : ""} ORDER BY r.revision`, [ownerId, brandId])
  return rows.rows.map(fromRule)
}

export async function activateOperatingRule(c: PoolClient, input: { ownerId: string; brandId: string; noteId: string; rule: OperatingRuleDraft }) {
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`operating-rules:${input.brandId}`])
  const existing = await listOperatingRules(c, input.ownerId, input.brandId)
  const conflicts = existing.filter(old => ruleSubject(old) === ruleSubject(input.rule) && ruleScopeOverlaps(old.scope, input.rule.scope) && old.effect !== input.rule.effect)
  const duplicate = existing.find(old => ruleSubject(old) === ruleSubject(input.rule) && old.effect === input.rule.effect && JSON.stringify(old.scope) === JSON.stringify(input.rule.scope))
  if (duplicate) return { rule: duplicate, superseded: [] as OperatingRule[], created: false }
  const revision = Number((await c.query<{ n: number }>("SELECT coalesce(max(revision),0)+1 AS n FROM brand_operating_rules WHERE brand_id=$1", [input.brandId])).rows[0]!.n)
  const id = randomUUID()
  const row = (await c.query<RuleRow>(`INSERT INTO brand_operating_rules(id,owner_user_id,brand_id,revision,status,kind,effect,parameter,directive,scope,source_note_id)
    VALUES($1,$2,$3,$4,'active',$5,$6,$7,$8,$9::jsonb,$10) RETURNING *`, [id, input.ownerId, input.brandId, revision, input.rule.kind, input.rule.effect, input.rule.parameter, input.rule.directive, JSON.stringify(input.rule.scope), input.noteId])).rows[0]!
  if (conflicts.length) await c.query("UPDATE brand_operating_rules SET status='superseded',superseded_by=$2,deactivated_at=now() WHERE id=ANY($1::uuid[]) AND status='active'", [conflicts.map(r => r.id), id])
  // A channel-specific exception narrows a global rule; preserve the rule on the other channel.
  let residualRevision = revision
  for (const old of conflicts.filter(rule => rule.scope.channel === "all" && input.rule.scope.channel !== "all")) {
    const residualChannel = input.rule.scope.channel === "instagram" ? "facebook" : "instagram"
    residualRevision++
    await c.query(`INSERT INTO brand_operating_rules(id,owner_user_id,brand_id,revision,status,kind,effect,parameter,directive,scope,source_note_id,superseded_by)
      VALUES($1,$2,$3,$4,'active',$5,$6,$7,$8,$9::jsonb,$10,$11)`, [randomUUID(), input.ownerId, input.brandId, residualRevision, old.kind, old.effect, old.parameter, old.directive, JSON.stringify({ ...old.scope, channel: residualChannel }), input.noteId, id])
  }
  return { rule: fromRule(row), superseded: conflicts, created: true }
}

export async function revertOperatingRule(c: PoolClient, ownerId: string, brandId: string, ruleId: string) {
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`operating-rules:${brandId}`])
  const current = (await c.query<RuleRow>("SELECT * FROM brand_operating_rules WHERE id=$1 AND owner_user_id=$2 AND brand_id=$3 FOR UPDATE", [ruleId, ownerId, brandId])).rows[0]
  if (!current || current.status !== "active") throw Error("ეს წესი მოგვიანებით შეიცვალა. დაბრუნება ახალ წესს გადაფარავდა.")
  const newer = await c.query("SELECT 1 FROM brand_operating_rules WHERE brand_id=$1 AND revision>$2 AND status='active' AND kind=$3 AND source_note_id<>$4", [brandId, current.revision, current.kind, current.source_note_id])
  if (newer.rowCount) throw Error("ამ წესის შემდეგ უფრო ახალი შესაბამისი წესი შეიქმნა. დაბრუნება მას გადაფარავდა.")
  await c.query("UPDATE brand_operating_rules SET status='reverted',deactivated_at=now() WHERE id=$1", [ruleId])
  await c.query("UPDATE brand_operating_rules SET status='reverted',deactivated_at=now() WHERE superseded_by=$1 AND status='active' AND source_note_id=$2", [ruleId, current.source_note_id])
  await c.query("UPDATE brand_operating_rules SET status='active',superseded_by=NULL,deactivated_at=NULL WHERE superseded_by=$1 AND status='superseded'", [ruleId])
}

export async function listChannelPolicies(db: Pool | PoolClient, ownerId: string, brandId: string): Promise<ChannelOperatingPolicy[]> {
  const rows = await db.query<{ channel: SocialChannel; active: boolean; revision: number; updated_at: Date }>(`SELECT p.channel,p.active,p.revision,p.updated_at FROM brand_channel_operating_policies p
    JOIN brands b ON b.id=p.brand_id JOIN workspaces w ON w.id=b.workspace_id WHERE p.owner_user_id=$1 AND p.brand_id=$2 AND w.owner_user_id=$1`, [ownerId, brandId])
  return SOCIAL_CHANNELS.map(channel => { const row = rows.rows.find(r => r.channel === channel); return row ? { channel, active: row.active, revision: row.revision, updatedAt: row.updated_at.toISOString() } : { channel, active: true, revision: 0, updatedAt: new Date(0).toISOString() } })
}

export async function setChannelPolicy(c: PoolClient, input: { ownerId: string; brandId: string; noteId: string; channel: SocialChannel; active: boolean }) {
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`channel-policy:${input.brandId}`])
  const row = (await c.query<{ active: boolean; revision: number }>("SELECT active,revision FROM brand_channel_operating_policies WHERE brand_id=$1 AND channel=$2 FOR UPDATE", [input.brandId, input.channel])).rows[0]
  const previousActive = row?.active ?? true
  const revision = (row?.revision ?? 0) + 1
  if (previousActive === input.active) return { channel: input.channel, active: input.active, revision: row?.revision ?? 0, previousActive, eventId: null }
  const eventId = randomUUID()
  await c.query(`INSERT INTO brand_channel_operating_policies(owner_user_id,brand_id,channel,active,revision) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(brand_id,channel) DO UPDATE SET active=excluded.active,revision=excluded.revision,updated_at=now()`, [input.ownerId, input.brandId, input.channel, input.active, revision])
  await c.query(`INSERT INTO brand_channel_operating_policy_events(id,owner_user_id,brand_id,channel,revision,previous_active,active,source_note_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [eventId, input.ownerId, input.brandId, input.channel, revision, previousActive, input.active, input.noteId])
  return { channel: input.channel, active: input.active, revision, previousActive, eventId }
}

export async function revertChannelPolicy(c: PoolClient, input: { ownerId: string; brandId: string; noteId: string; eventId: string; expectedRevision: number }) {
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`channel-policy:${input.brandId}`])
  const event = (await c.query<{ channel: SocialChannel; active: boolean; previous_active: boolean; revision: number }>("SELECT channel,active,previous_active,revision FROM brand_channel_operating_policy_events WHERE id=$1 AND owner_user_id=$2 AND brand_id=$3 FOR UPDATE", [input.eventId, input.ownerId, input.brandId])).rows[0]
  if (!event || event.revision !== input.expectedRevision) throw Error("არხის გადაწყვეტილება ვერ მოიძებნა.")
  const current = (await c.query<{ revision: number; active: boolean }>("SELECT revision,active FROM brand_channel_operating_policies WHERE brand_id=$1 AND channel=$2 FOR UPDATE", [input.brandId, event.channel])).rows[0]
  if (!current || current.revision !== event.revision || current.active !== event.active) throw Error("არხის პოლიტიკა მოგვიანებით შეიცვალა. დაბრუნება ახალ გადაწყვეტილებას გადაფარავდა.")
  const nextRevision = current.revision + 1
  const revertId = randomUUID()
  await c.query("UPDATE brand_channel_operating_policies SET active=$3,revision=$4,updated_at=now() WHERE brand_id=$1 AND channel=$2", [input.brandId, event.channel, event.previous_active, nextRevision])
  await c.query(`INSERT INTO brand_channel_operating_policy_events(id,owner_user_id,brand_id,channel,revision,previous_active,active,source_note_id,reverted_event_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [revertId, input.ownerId, input.brandId, event.channel, nextRevision, event.active, event.previous_active, input.noteId, input.eventId])
  return { channel: event.channel, active: event.previous_active, revision: nextRevision }
}
