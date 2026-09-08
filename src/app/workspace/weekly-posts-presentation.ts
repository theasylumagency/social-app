import { postRepairFeedback, type PostsBatch, type PostVariant } from "../../blueprints/social/weekly-planning/posts"

export const savedWorkMessage = "დასრულებული სამუშაო ინახება და გვერდის დახურვა პროცესს თავიდან არ დაიწყებს."

/** Derive progress from durable evidence, including copies temporarily moved for repair. */
export function postsPresentation(batch: PostsBatch) {
  const { payload } = batch
  const keys = payload.outline?.posts.map((_, i) => `p${i + 1}`) ?? []
  const repairKeys = keys.filter((key) => payload.repairDrafts?.[key])
  const written = keys.filter((key) => payload.copies[key] || payload.repairDrafts?.[key]).length
  const current = keys.filter((key) => payload.copies[key]).length
  const rewritten = repairKeys.filter((key) => payload.copies[key]).length
  const active = batch.status === "queued" || batch.status === "running"
  const complete = batch.status === "ready" && !!payload.review && current === keys.length && !payload.review.issues.some((issue) => issue.severity === "blocking")
  const needsSequence = !!keys.length && !payload.sequenceReview && ["writing", "review"].includes(batch.step)
  const phase = batch.step === "outline" ? "outline" : needsSequence ? "sequence" : batch.step === "writing" ? repairKeys.length ? "repair" : "writing" : batch.step === "review" ? "review" : "ready"
  const titles = {
    outline: payload.sequenceFeedback ? "პოსტების სტრუქტურას ვაზუსტებთ" : "პოსტების სტრუქტურას ვამზადებთ",
    sequence: "კვირის შიდა გამეორებასა და წინა კვირებთან მსგავსებას ვამოწმებთ",
    writing: "ტექსტებს ვწერთ",
    review: repairKeys.length ? "გასწორებულ ტექსტებს ხელახლა ვამოწმებთ" : "ბრენდის ხმას, არგუმენტის ხარისხსა და ფაქტებს ვამოწმებთ",
    repair: "ხარისხის შემოწმების შემდეგ ტექსტებს ვასწორებთ",
    ready: complete ? "საბოლოო ვერსიები მზადაა" : "შემოწმების შედეგები განსახილველია",
  }
  const repairMessage = repairKeys.length
    ? `პირველადი ტექსტები შენახულია. ხარისხის შემოწმებისას ${repairKeys.length} პოსტს დაზუსტება დასჭირდა. ${active ? rewritten < repairKeys.length ? `ახლა მათ ვასწორებთ. გადამუშავებულია ${rewritten} / ${repairKeys.length} ტექსტი.` : "გადამუშავებული ტექსტები შენახულია; საბოლოო შემოწმება მიმდინარეობს." : batch.status === "failed" ? "გასწორება დროებით შეჩერებულია; შენახული ვერსიები ქვემოთ ჩანს." : "პირველი და მიმდინარე ვერსიები ქვემოთ შეგიძლიათ შეადაროთ."}`
    : null
  const completion = batch.status !== "ready" ? null : !keys.length ? "ამ კვირაში პოსტები არჩეული არ არის."
    : complete ? repairKeys.length ? `${keys.length} პოსტი მზადაა და შემოწმებულია. ხარისხის შემოწმების შემდეგ ${repairKeys.length} ტექსტი გადავამუშავეთ.` : `${keys.length} პოსტი მზადაა და შემოწმებულია.`
      : payload.review?.issues.some((issue) => issue.severity === "blocking") ? "შემოწმება დასრულდა. დარჩენილი შენიშვნები დადასტურებამდე დაზუსტებას საჭიროებს." : "შენახული ტექსტები ქვემოთ ჩანს. საბოლოო შემოწმება ჯერ დადასტურებული არ არის."
  const stages = [
    { key: "outline", label: "პოსტების სტრუქტურის მომზადება", done: !!payload.outline && phase !== "outline" },
    { key: "sequence", label: "კვირის შიდა გამეორებისა და წინა კვირებთან მსგავსების შემოწმება", done: !!payload.sequenceReview },
    { key: "writing", label: "პირველადი ტექსტების დაწერა", done: !!keys.length && written === keys.length },
    { key: "review", label: "ბრენდის ხმის, არგუმენტის ხარისხის, ფაქტებისა და კომუნიკაციის საზღვრების შემოწმება", done: complete },
    { key: "repair", label: repairKeys.length ? `${repairKeys.length} ტექსტის გასწორება` : "საჭიროების შემთხვევაში ტექსტების გასწორება", done: !!repairKeys.length && rewritten === repairKeys.length },
    { key: "ready", label: "საბოლოო ვერსიების მომზადება", done: complete },
  ].map((stage) => ({ ...stage, current: active && phase === stage.key }))
  return { active, complete, phase, title: titles[phase], written, total: keys.length, repairKeys, repairMessage, completion, stages }
}

export function postPresentation(batch: PostsBatch, key: string) {
  const draft = batch.payload.repairDrafts?.[key]
  const copy = batch.payload.copies[key]
  const blocked = batch.payload.review?.issues.some((issue) => issue.postKey === key && issue.severity === "blocking") ?? false
  const accepted = !!copy && batch.status === "ready" && !!batch.payload.review && !blocked
  // During repair the current review is the trigger. After completion it is a different review.
  const feedback = batch.payload.repairFeedback?.[key] ?? (draft && !copy && batch.payload.review ? postRepairFeedback(batch.payload.review, key) : undefined)
  const label = accepted ? "საბოლოო ვერსია" : batch.status === "failed" ? "შენახული ვერსია — შემოწმება დაუმთავრებელია" : batch.status === "ready" ? "მიმდინარე ვერსია — დასაზუსტებელია" : draft ? copy ? "გადამუშავებული ვერსია — შემოწმება მიმდინარეობს" : "პირველი ვერსია — გასწორება მიმდინარეობს" : "პირველი ვერსია — შემოწმება მიმდინარეობს"
  return { draft, copy, feedback, accepted, label }
}

export function changedCopyParts(first: PostVariant, current: PostVariant): string[] {
  return [
    first.caption !== current.caption ? "პოსტის ტექსტი" : null,
    JSON.stringify(first.frames) !== JSON.stringify(current.frames) ? "სლაიდების / კადრების ტექსტი" : null,
    first.script !== current.script ? "სათქმელი ტექსტი" : null,
    JSON.stringify(first.onScreenText) !== JSON.stringify(current.onScreenText) ? "ტექსტი ეკრანზე" : null,
  ].filter((part): part is string => part !== null)
}
