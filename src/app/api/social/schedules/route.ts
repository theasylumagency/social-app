import {listPostRevisions,readPostRevision} from "../../../../infrastructure/postgres/post-revisions-store"
import { authenticateAccountRequest, authenticateWorkRequest } from "../../../_server/auth"
import { getDatabasePool } from "../../../_server/database"
import { readPlanningRun } from "../../../../infrastructure/postgres/weekly-planning-store"
import { listPostAssets, readWeeklyPosts } from "../../../../infrastructure/postgres/weekly-posts-store"
import { PostgresSocialPublicationStore } from "../../../../infrastructure/postgres/social-publication-store"
import { scheduleApprovedPost, scheduleApprovedWeek } from "../../../../application/publishing/schedule-approved-post"
import { SOCIAL_CONTENT_MODES } from "../../../../blueprints/social/tokens"
import { readConnectionAccounts } from "../../../../application/social-connections/view"
import { PostgresSocialConnectionsStore } from "../../../../infrastructure/postgres/social-connections-store"
import { ScheduleConflict, scheduleErrorMessage } from "../../../../application/publishing/schedule-errors"
import { resolveScheduleTime } from "../../../../application/publishing/schedule-time"
import { scheduleChangeRequest, scheduleIdentifier, scheduleTimeContext } from "../../../../application/publishing/schedule-request"

export const runtime = "nodejs"
const modes = new Set<string>(Object.values(SOCIAL_CONTENT_MODES))
const response = (error: unknown) => Response.json({ message: scheduleErrorMessage(error) }, { status: error instanceof ScheduleConflict ? 409 : 422 })
async function body(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > 64_000) throw Error("მოთხოვნა ზედმეტად დიდია.")
  const raw = await request.text()
  if (Buffer.byteLength(raw) > 64_000) throw Error("მოთხოვნა ზედმეტად დიდია.")
  const value = JSON.parse(raw)
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("განრიგის მოთხოვნა არასწორია.")
  return value as Record<string, unknown>
}
function runIdentifier(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)) throw Error("კვირის არჩევანი არასწორია.")
  return value
}

export async function GET(request: Request) {
  // Reading and cancelling an owned pending schedule remain available after subscription expiry.
  const access = await authenticateAccountRequest(request)
  if (access.error) return access.error
  try {
    const q = new URL(request.url).searchParams
    const brandId = scheduleIdentifier(q.get("brandId")), runId = q.get("runId") ? runIdentifier(q.get("runId")) : undefined
    const pool = getDatabasePool()
    const [schedules, accounts, revisions] = await Promise.all([
      new PostgresSocialPublicationStore(pool).listSchedules({ ownerId: access.session.user.id, brandId, ...(runId ? { sourceRunId: runId } : {}) }),
      readConnectionAccounts(new PostgresSocialConnectionsStore(pool), { ownerId: access.session.user.id, brandId }),
      runId ? listPostRevisions(pool,access.session.user.id,brandId,runId) : Promise.resolve([]),
    ])
    return Response.json({ revisions, capturedAt: new Date().toISOString(), accounts, schedules: schedules.map(item => ({
      publicationInputId: item.publicationInputId, supersededByInputId: item.supersededByInputId, approvalId: item.approvalId,
      postKey: item.postKey, publishingAccountId: item.publishingAccountId,
      schedule: { id: item.schedule.id, channel: item.schedule.channel, publishAt: item.schedule.publishAt, draftVersion: item.schedule.draftVersion },
      lifecycle: item.lifecycle, timeContext: item.timeContext, delivery: item.delivery,
    })) })
  } catch (error) { return response(error) }
}

export async function POST(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  try {
    const input = await body(request), brandId = scheduleIdentifier(input.brandId), runId = runIdentifier(input.runId)
    if (input.replaceInputIds !== undefined && (!Array.isArray(input.replaceInputIds) || input.replaceInputIds.length > 100)) throw Error("განრიგის ჩანაცვლების მოთხოვნა არასწორია.")
    const replaceInputIds = Array.isArray(input.replaceInputIds) ? input.replaceInputIds.map(scheduleIdentifier) : undefined
    const pool = getDatabasePool()
    const [run, posts, assets] = await Promise.all([readPlanningRun(pool, access.session.user.id, runId),
      readWeeklyPosts(pool, access.session.user.id, runId), listPostAssets(pool, access.session.user.id, runId)])
    if (!run || !posts || run.brandId !== brandId) throw Error("დამტკიცებული კვირა ვერ მოიძებნა.")
    const shared = { ownerId: access.session.user.id, actorId: access.session.user.id, run, posts, assets,
      ...(replaceInputIds ? { replaceInputIds } : {}), now: new Date().toISOString() }
    const store = new PostgresSocialPublicationStore(pool)
    if (input.selections !== undefined) {
      if (!Array.isArray(input.selections) || input.selections.length < 1 || input.selections.length > 40) throw Error("აირჩიეთ 1–40 გამოსაქვეყნებელი ჩანაწერი.")
      const selections = input.selections.map(raw => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("პოსტის არჩევანი არასწორია.")
        const value = raw as Record<string, unknown>
        if ((value.channel !== "facebook" && value.channel !== "instagram") || typeof value.postKey !== "string") throw Error("პოსტის არხი არასწორია.")
        const channel: "facebook" | "instagram" = value.channel
        return { postKey: value.postKey, channel, publishingAccountId: scheduleIdentifier(value.publishingAccountId), timeContext: scheduleTimeContext(value.timeContext), ...(value.revisionId ? {revisionId:runIdentifier(value.revisionId)} : {}) }
      })
      const revisions=await Promise.all([...new Set(selections.flatMap(s=>s.revisionId?[s.revisionId]:[]))].map(id=>readPostRevision(pool,access.session.user.id,id)))
      if(revisions.some(r=>!r||r.runId!==runId||r.brandId!==brandId))throw Error("პოსტის ვერსია ვერ მოიძებნა.")
      const schedules = await scheduleApprovedWeek({ ...shared, revisions:revisions.filter(r=>r!==null), approvalId: scheduleIdentifier(input.approvalId), selections }, store)
      return Response.json({ schedules, count: schedules.length }, { status: 201 })
    }
    // Retain the existing single-post API for callers using explicit UTC times.
    if (typeof input.postKey !== "string" || !/^p([1-9]|10)$/u.test(input.postKey) || !Array.isArray(input.destinations)
      || !input.destinations.length || input.destinations.length > 10) throw Error("განრიგის მოთხოვნა არასწორია.")
    const destinations = input.destinations.map(raw => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("ანგარიშის არჩევანი არასწორია.")
      const value = raw as Record<string, unknown>
      if ((value.channel !== "facebook" && value.channel !== "instagram") || typeof value.publishAt !== "string"
        || typeof value.contentMode !== "string" || !modes.has(value.contentMode)) throw Error("ანგარიშის არჩევანი არასწორია.")
      const channel: "facebook" | "instagram" = value.channel
      return { channel, publishingAccountId: scheduleIdentifier(value.publishingAccountId), publishAt: value.publishAt,
        contentMode: value.contentMode as (typeof SOCIAL_CONTENT_MODES)[keyof typeof SOCIAL_CONTENT_MODES] }
    })
    const schedules = await scheduleApprovedPost({ ...shared, postKey: input.postKey, destinations }, store)
    return Response.json({ count: schedules.length }, { status: 201 })
  } catch (error) { return response(error) }
}

export async function PATCH(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  try {
    const input = await body(request), change = scheduleChangeRequest(input), timeContext = scheduleTimeContext(input.timeContext)
    await new PostgresSocialPublicationStore(getDatabasePool()).changeSchedule({ ...change, ownerId: access.session.user.id,
      action: "reschedule", timeContext, publishAt: resolveScheduleTime(timeContext), now: new Date().toISOString() })
    return Response.json({ changed: true })
  } catch (error) { return response(error) }
}

export async function DELETE(request: Request) {
  const access = await authenticateAccountRequest(request)
  if (access.error) return access.error
  try {
    const input = await body(request), change = scheduleChangeRequest(input)
    if (input.reason !== undefined && (typeof input.reason !== "string" || input.reason.length > 1000)) throw Error("გაუქმების მიზეზი ზედმეტად გრძელია.")
    await new PostgresSocialPublicationStore(getDatabasePool()).changeSchedule({ ...change, ownerId: access.session.user.id,
      action: "cancel", ...(typeof input.reason === "string" ? { reason: input.reason } : {}), now: new Date().toISOString() })
    return new Response(null, { status: 204 })
  } catch (error) { return response(error) }
}
