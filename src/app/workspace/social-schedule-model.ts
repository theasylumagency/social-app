import type { PostsBatch, PostAsset, PostChannel, PostOutline } from "../../blueprints/social/weekly-planning/posts"
import { WEEKLY_EXECUTION_CAPABILITIES } from "../../blueprints/social/weekly-planning/execution-capabilities"
import type { ScheduleTimeContext } from "../../application/publishing/schedule-time"
export type ScheduleAccount = { id: string; channel: PostChannel; name: string; connected: boolean; canPublish: boolean }
export type SavedSchedule = { publicationInputId: string; supersededByInputId: string | null; approvalId: string | null; postKey: string;
  schedule: { id: string; channel: PostChannel; publishAt: string; draftVersion: number }; publishingAccountId: string;
  lifecycle: { status: "scheduled" | "cancelled"; revision: number; publishAt?: string; lastPublishAt?: string };
  timeContext?: ScheduleTimeContext | null; delivery?: { state: "notStarted" | "inProgress" | "published" | "unknown" | "failed"; attemptCount: number } }
export type ScheduleSnapshot = { capturedAt: string; accounts: ScheduleAccount[]; schedules: SavedSchedule[]; revisions?:import("../../application/post-revisions/model").PostRevisionView[] }
export function scheduleRows(batch: PostsBatch, assets: readonly PostAsset[], approved: boolean) {
  return (batch.payload.outline?.posts ?? []).flatMap((post, index) => post.channels.map(({ channel }) => {
    const postKey = `p${index + 1}`, copy = batch.payload.copies[postKey]?.variants.find(v => v.channel === channel)
    const required = post.format === "text" ? 0 : post.format === "image" ? 1 : post.visual.frames.length
    const media = assets.filter(a => a.postKey === postKey).sort((a, b) => a.slot - b.slot)
    const reasons: string[] = []
    if (!(WEEKLY_EXECUTION_CAPABILITIES.supportedFormatsByChannel[channel] as readonly string[]).includes(post.format)) reasons.push("ამ ფორმატის გამოქვეყნება ამ არხზე ჯერ არ არის მხარდაჭერილი.")
    if (!copy || ((post.format === "story" || post.format === "carousel") ? !copy.frames.length || copy.frames.some(f => !f.body.trim()) : !copy.caption.trim())) reasons.push("ამ არხის ტექსტი მოსამზადებელია.")
    if (post.format !== "text" && !required || media.length !== required || media.some((a, slot) => a.slot !== slot)) reasons.push("საჭირო ვიზუალი მოსამზადებელია.")
    if (!approved || !post.contentMode) reasons.push("კვირის ტექსტები დასამტკიცებელია.")
    if (batch.payload.review?.issues.some(i => i.postKey === postKey && i.severity === "blocking")) reasons.push("ტექსტის შეფასებაში დასაზუსტებელი საკითხია.")
    return { key: `${postKey}:${channel}`, postKey, channel, post: post as PostOutline, reasons, media: `${media.length}/${required}` }
  }))
}
export function scheduleMutable(item: SavedSchedule) {
  return !item.supersededByInputId && item.lifecycle.status === "scheduled" && (item.delivery?.attemptCount ?? 0) === 0
}
export function scheduleStatus(item: SavedSchedule) {
  if (item.delivery?.state === "published") return "გამოქვეყნებულია"
  if (item.delivery?.state === "unknown") return "შედეგი ჯერ უცნობია"
  if (item.delivery?.state === "inProgress") return "გაგზავნა დაწყებულია"
  if (item.delivery?.state === "failed") return "გაგზავნის მცდელობა ვერ დასრულდა"
  if (item.supersededByInputId) return "ჩანაცვლებულია ახალი ვერსიით"
  return item.lifecycle.status === "cancelled" ? "გაუქმებულია" : "დაგეგმილია"
}
export function replacementInputs(saved: readonly SavedSchedule[], approvalId: string, selected: readonly { postKey: string; channel: PostChannel }[]) {
  return [...new Set(saved.filter(s => !s.supersededByInputId && s.approvalId !== approvalId && selected.some(r => r.postKey === s.postKey && r.channel === s.schedule.channel)).map(s => s.publicationInputId))]
}

export function approvedTargetRevision(revisions:readonly import("../../application/post-revisions/model").PostRevisionView[],postKey:string,channel:PostChannel) {return revisions.filter(r=>r.status==='approved'&&r.postKey===postKey&&r.channel===channel).reduce<import('../../application/post-revisions/model').PostRevisionView|undefined>((latest,r)=>!latest||r.version>latest.version?r:latest,undefined)}
