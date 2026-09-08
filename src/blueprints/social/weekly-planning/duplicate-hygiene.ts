import type { PostsPayload } from "./posts"

const words = (text: string) => text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/u).filter(Boolean)
/** Lexical reuse only. Shared ideas and vocabulary do not trigger this check. */
export function nearVerbatim(left: string, right: string) {
  const a = words(left), b = words(right)
  if (!a.length || !b.length) return false
  if (a.join(" ") === b.join(" ")) return true
  if (Math.min(a.length, b.length) < 18 || Math.min(a.length, b.length) / Math.max(a.length, b.length) < .8) return false
  const grams = (w: string[]) => new Set(w.slice(0, -3).map((_, i) => w.slice(i, i + 4).join(" ")))
  const x = grams(a), y = grams(b)
  const shared = [...x].filter((g) => y.has(g)).length
  return shared / Math.max(x.size, y.size) >= .8
}
export function copyTexts(payload: PostsPayload) {
  return Object.entries(payload.copies).flatMap(([postKey, copy]) => copy.variants.map((v) => ({ postKey, text: [v.caption, ...v.frames.flatMap((f) => [f.heading, f.body]), v.script, ...v.onScreenText].filter(Boolean).join(" ") })))
}
export function duplicateCopyIssues(payload: PostsPayload, prior: string[] = []) {
  const copies = copyTexts(payload)
  return copies.flatMap((copy, i) => {
    const repeated = copies.slice(0, i).some((other) => other.postKey !== copy.postKey && nearVerbatim(copy.text, other.text)) || prior.some((text) => nearVerbatim(copy.text, text))
    return repeated ? [{ postKey: copy.postKey, severity: "blocking" as const, message: "ტექსტი სხვა პოსტს სიტყვასიტყვით ან თითქმის სიტყვასიტყვით იმეორებს. შეინარჩუნეთ სასარგებლო იდეა და დაწერეთ ახალი ტექსტი." }] : []
  }).filter((issue, i, all) => all.findIndex((x) => x.postKey === issue.postKey) === i)
}
