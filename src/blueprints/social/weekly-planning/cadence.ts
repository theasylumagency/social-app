import { countPostChannels, postRepairFeedback, type PostCadence, type PostOutline, type PostsPayload } from "./posts"

/** Keep existing communication jobs and channel copies; a day change needs no writer. */
export function resizePostSchedule(previous: PostsPayload, cadence: PostCadence) {
  if (!previous.outline) throw Error("Post outline is required")
  const payload: PostsPayload = { outline: { ...previous.outline, summary: `ამ კვირაში: Facebook — ${cadence.facebook}, Instagram — ${cadence.instagram} პოსტი.`, posts: [], cadenceReason: "რაოდენობა თქვენი არჩევანით განახლდა. დარჩენილი პოსტები და მათი საკომუნიკაციო როლები შენარჩუნებულია.", channelReason: "არხებზე განაწილება თქვენს მიერ მითითებულ რაოდენობას მიჰყვება; თითოეული პოსტის არხის დასაბუთება მის ბარათშია." }, copies: {}, repairDrafts: {}, review: null, repairs: 0, cadence }
  const remaining = { ...cadence }
  const mapping: { from: string; to: string }[] = []
  const issues: NonNullable<PostsPayload["review"]>["issues"] = []
  previous.outline.posts.forEach((post, i) => {
    const channels = post.channels.filter((c) => remaining[c.channel] > 0)
    if (!channels.length) return
    for (const c of channels) remaining[c.channel]--
    const from = `p${i + 1}`, to = `p${payload.outline!.posts.length + 1}`
    mapping.push({ from, to })
    payload.outline!.posts.push({ ...post, channels })
    const copy = previous.copies[from] ?? previous.repairDrafts?.[from]
    const feedback = previous.review?.issues.filter((issue) => issue.postKey === from) ?? []
    issues.push(...feedback.map((issue) => ({ ...issue, postKey: to })))
    const draft = previous.repairDrafts?.[from]
    if (draft) payload.repairDrafts![to] = { variants: draft.variants.filter((v) => channels.some((c) => c.channel === v.channel)) }
    const savedFeedback = previous.repairFeedback?.[from]
    if (savedFeedback) {
      payload.repairFeedback ??= {}
      payload.repairFeedback[to] = { ...savedFeedback, issues: savedFeedback.issues.map((issue) => ({ ...issue, postKey: to })) }
    }
    if (copy) {
      const kept = { variants: copy.variants.filter((v) => channels.some((c) => c.channel === v.channel)) }
      if (feedback.some((issue) => issue.severity === "blocking")) {
        payload.repairDrafts![to] = kept
        payload.repairFeedback ??= {}
        const evidence = postRepairFeedback(previous.review!, from)
        payload.repairFeedback[to] = { ...evidence, issues: evidence.issues.map((issue) => ({ ...issue, postKey: to })) }
      }
      else payload.copies[to] = kept
    }
  })
  if (issues.length) payload.review = { summary: "წინა ვერსიიდან დარჩენილი შენიშვნები", issues }
  const needsAdditions = remaining.facebook + remaining.instagram > 0
  if (!cadence.facebook && !cadence.instagram) {
    payload.outline!.summary = "ამ კვირაში პოსტების მომზადება თქვენი არჩევანით შეჩერებულია."
    payload.review = { summary: "ორივე არხზე არჩეულია 0 პოსტი. ტექსტები მოსამზადებელი არ არის.", issues: [] }
  }
  return { payload, mapping, needsAdditions }
}

export function spreadPostDays(posts: PostOutline[], week: string, plannedOn: string): PostOutline[] {
  const delta = Math.round((Date.parse(`${plannedOn}T12:00:00Z`) - Date.parse(`${week}T12:00:00Z`)) / 86400000)
  const first = Math.max(0, Math.min(6, Number.isFinite(delta) ? delta : 0))
  return posts.map((p, i) => ({ ...p, dayOffset: posts.length === 1 ? first : first + Math.round(i * (6 - first) / (posts.length - 1)) }))
}

export function validateCadence(posts: PostOutline[], target: PostCadence): string[] {
  const actual = countPostChannels(posts)
  return actual.facebook === target.facebook && actual.instagram === target.instagram ? [] : ["Post placements must match the requested Facebook and Instagram counts exactly"]
}
