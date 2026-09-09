import { randomUUID } from "node:crypto"
import { authenticateWorkRequest } from "../../../_server/auth"
import { getDatabasePool } from "../../../_server/database"
import { readPlanningRun } from "../../../../infrastructure/postgres/weekly-planning-store"
import { listPostAssets, readWeeklyPosts } from "../../../../infrastructure/postgres/weekly-posts-store"
import { PostgresSocialPublicationStore } from "../../../../infrastructure/postgres/social-publication-store"
import { scheduleApprovedPost } from "../../../../application/publishing/schedule-approved-post"
import { SOCIAL_CONTENT_MODES } from "../../../../blueprints/social/tokens"
import { cancelSocialContentSchedule, rescheduleSocialContent } from "../../../../blueprints/social/content-schedule-lifecycle"
import { createIsoDateTime } from "../../../../core/domain/primitives"
import { readConnectionAccounts } from "../../../../application/social-connections/view"
import { PostgresSocialConnectionsStore } from "../../../../infrastructure/postgres/social-connections-store"

export const runtime = "nodejs"
const modes = new Set<string>(Object.values(SOCIAL_CONTENT_MODES))
const response = (error: unknown) => Response.json({ message: error instanceof Error ? error.message : "Schedule could not be saved" }, { status: 422 })
async function body(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > 64_000) throw new Error("Schedule request is too large")
  const raw = await request.text()
  if (Buffer.byteLength(raw) > 64_000) throw new Error("Schedule request is too large")
  const value = JSON.parse(raw)
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid schedule request")
  return value as Record<string, unknown>
}

export async function GET(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  const q = new URL(request.url).searchParams
  const brandId = q.get("brandId") ?? ""
  if (!brandId || brandId.length > 160) return response(new Error("Invalid brand"))
  try {
    const pool = getDatabasePool()
    const [schedules, accounts] = await Promise.all([
      new PostgresSocialPublicationStore(pool).listSchedules({ ownerId: access.session.user.id,
        brandId, ...(q.get("runId") ? { sourceRunId: q.get("runId")! } : {}) }),
      readConnectionAccounts(new PostgresSocialConnectionsStore(pool), { ownerId: access.session.user.id, brandId }),
    ])
    return Response.json({ schedules, accounts })
  } catch (error) { return response(error) }
}

export async function POST(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  try {
    const input = await body(request)
    const brandId = typeof input.brandId === "string" ? input.brandId : ""
    const runId = typeof input.runId === "string" ? input.runId : ""
    const postKey = typeof input.postKey === "string" ? input.postKey : ""
    if (!brandId || !runId || !/^p([1-9]|10)$/u.test(postKey) || !Array.isArray(input.destinations)) throw new Error("Invalid schedule request")
    const destinations = input.destinations.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid publishing destination")
      const value = raw as Record<string, unknown>
      if ((value.channel !== "facebook" && value.channel !== "instagram") || typeof value.publishingAccountId !== "string"
        || typeof value.publishAt !== "string" || typeof value.contentMode !== "string" || !modes.has(value.contentMode)) throw new Error("Invalid publishing destination")
      const channel: "facebook" | "instagram" = value.channel
      return { channel, publishingAccountId: value.publishingAccountId, publishAt: value.publishAt,
        contentMode: value.contentMode as (typeof SOCIAL_CONTENT_MODES)[keyof typeof SOCIAL_CONTENT_MODES] }
    })
    const pool = getDatabasePool()
    const [run, posts, assets] = await Promise.all([readPlanningRun(pool, access.session.user.id, runId),
      readWeeklyPosts(pool, access.session.user.id, runId), listPostAssets(pool, access.session.user.id, runId)])
    if (!run || !posts || run.brandId !== brandId) throw new Error("Approved weekly post not found")
    const schedules = await scheduleApprovedPost({ ownerId: access.session.user.id, actorId: access.session.user.id, run, posts, assets,
      postKey, destinations, now: new Date().toISOString() }, new PostgresSocialPublicationStore(pool))
    return Response.json({ schedules }, { status: 201 })
  } catch (error) { return response(error) }
}

export async function PATCH(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  try {
    const input = await body(request)
    if (typeof input.brandId !== "string" || typeof input.scheduleId !== "string" || typeof input.publishAt !== "string") throw new Error("Invalid reschedule request")
    const store = new PostgresSocialPublicationStore(getDatabasePool())
    const found = (await store.listSchedules({ ownerId: access.session.user.id, brandId: input.brandId })).find((item) => item.schedule.id === input.scheduleId)
    if (!found) throw new Error("Schedule not found")
    const event = rescheduleSocialContent({ id: `schedule-event:${randomUUID()}` as never, schedule: found.schedule, currentState: found.lifecycle,
      publishAt: createIsoDateTime(input.publishAt), changedBy: access.session.user.id as never, changedAt: createIsoDateTime(new Date().toISOString()) }).event
    await store.appendScheduleEvent({ ownerId: access.session.user.id, brandId: input.brandId }, event)
    return Response.json({ event })
  } catch (error) { return response(error) }
}

export async function DELETE(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  try {
    const input = await body(request)
    if (typeof input.brandId !== "string" || typeof input.scheduleId !== "string") throw new Error("Invalid cancellation request")
    const store = new PostgresSocialPublicationStore(getDatabasePool())
    const found = (await store.listSchedules({ ownerId: access.session.user.id, brandId: input.brandId })).find((item) => item.schedule.id === input.scheduleId)
    if (!found) throw new Error("Schedule not found")
    const event = cancelSocialContentSchedule({ id: `schedule-event:${randomUUID()}` as never, schedule: found.schedule, currentState: found.lifecycle,
      ...(typeof input.reason === "string" ? { reason: input.reason } : {}), changedBy: access.session.user.id as never,
      changedAt: createIsoDateTime(new Date().toISOString()) }).event
    await store.appendScheduleEvent({ ownerId: access.session.user.id, brandId: input.brandId }, event)
    return new Response(null, { status: 204 })
  } catch (error) { return response(error) }
}
