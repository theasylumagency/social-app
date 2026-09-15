import type { PlanningView } from "../../blueprints/social/weekly-planning/model"
import { operatingChannels, type StrategyView } from "../../blueprints/social/strategy/model"
import type { ConnectionAccountView } from "../social-connections/view"

export type BriefingItem = { id: string; kind: "decision" | "action"; title: string; detail: string; href: string; label: string }

/** A read-only projection of saved work. It neither grants authority nor infers delivery health. */
export function buildBriefing({ strategy, planning, accounts, week }: {
  strategy: StrategyView; planning: PlanningView; accounts: readonly ConnectionAccountView[]; week: string
}) {
  const items: BriefingItem[] = []
  const work: string[] = []
  const latest = strategy.latest
  const run = planning.run
  const posts = planning.posts
  const weekHref = `/workspace/week?week=${week}`
  const contentHref = `/workspace/content?week=${week}`
  const add = (id: string, kind: BriefingItem["kind"], title: string, detail: string, href: string, label: string) => items.push({ id, kind, title, detail, href, label })

  if (latest?.status === "proposed") add("strategy-review", "decision", "სოციალური სტრატეგია დასადასტურებელია", "მიზანი და არხების როლები თქვენს გადაწყვეტილებას ელოდება.", "/workspace/strategy", "სტრატეგიის განხილვა")
  else if (latest?.status === "failed") add("strategy-failed", "action", "სტრატეგიის მომზადება შეჩერებულია", "შენახული ეტაპიდან გაგრძელება სტრატეგიის გვერდზე შეგიძლიათ.", "/workspace/strategy", "მომზადების გაგრძელება")
  else if (latest?.status === "queued" || latest?.status === "running") work.push(latest.status === "queued" ? "სტრატეგიის მომზადება რიგშია." : "სოციალური სტრატეგია მზადდება.")
  else if (!strategy.active) add("strategy-start", "action", "ჯერ სოციალური მიზანი შევათანხმოთ", "ბრენდის ცოდნა მზადაა. შემდეგი ნაბიჯია სტრატეგიული რეკომენდაციის მომზადება.", "/workspace/strategy", "სტრატეგიის დაწყება")

  const planningWorking = run?.status === "queued" || run?.status === "running"
  const postsWorking = posts?.status === "queued" || posts?.status === "running"
  const blocking = run?.payload.review?.concerns.some((c) => c.severity === "blocking") || posts?.payload.review?.issues.some((i) => i.severity === "blocking")
  if (planningWorking) work.push(run.status === "queued" ? "კვირის გეგმის მომზადება რიგშია." : "კვირის მიზანი და მიმართულებები მზადდება.")
  else if (run?.status === "failed") add("plan-failed", "action", "კვირის გეგმის მომზადება შეჩერებულია", "დასრულებული ეტაპები შენახულია; გაგრძელება გეგმის გვერდზეა შესაძლებელი.", weekHref, "გეგმის ნახვა")
  else if (run && planning.stale) add("plan-stale", "action", "გეგმის საფუძველი შეიცვალა", "მიმდინარე გეგმა ბრენდისა და სტრატეგიის მოქმედ საფუძველს უნდა შევუსაბამოთ, სანამ მას დაადასტურებთ.", weekHref, "გეგმის დაზუსტება")
  else if (run && blocking && !postsWorking) add("content-blocked", "action", "დადასტურებამდე საკითხებია გასასწორებელი", "შემოწმებამ დამბლოკავი საკითხები გამოავლინა. მათი საფუძველი გეგმასა და კონტენტში ჩანს.", contentHref, "საკითხების ნახვა")
  else if ((run?.status === "ready" || run?.status === "approved") && posts?.status === "ready" && !posts.approvedAt) add("content-review", "decision", "კვირის გეგმა და ტექსტები განსახილველად მზადაა", "მოქმედი წესით თქვენი დადასტურება საჭიროა. გამოსაქვეყნებელი ვიზუალები და განრიგი ცალკე მოწმდება.", contentHref, "განხილვა და დადასტურება")
  else if (!run && strategy.active && !planning.basis) add("brand-basis", "action", "ბრენდის სამუშაო საფუძველია დასაზუსტებელი", "კვირის დაწყებამდე მიმდინარე ბრენდის ანალიზი გვჭირდება.", "/workspace/brand", "ბრენდის ნახვა")
  else if (!run && strategy.active) add("plan-start", "action", "ამ კვირის გეგმა ჯერ არ მომზადებულა", "შეთანხმებული სტრატეგიიდან კვირის მიზანი და კონტენტის მიმართულებები მოვამზადოთ.", weekHref, "კვირის დაგეგმვა")
  else if (run?.status === "changesRequested" || run?.status === "superseded") add("plan-revision", "action", "კვირის მიმდინარე ვერსია გადასახედია", "წინა ვერსიები შენახულია. სამუშაოს გასაგრძელებლად კვირის გეგმა გახსენით.", weekHref, "გეგმის ნახვა")

  if (!planningWorking && posts?.status === "failed") add("posts-failed", "action", "ტექსტების მომზადება შეჩერებულია", "მომზადებული ტექსტები შენახულია. გაგრძელება კონტენტის გვერდზე შეგიძლიათ.", contentHref, "ტექსტების ნახვა")
  else if (postsWorking) work.push(posts.status === "queued" ? "ტექსტების მომზადება რიგშია." : "ტექსტები მზადდება და მოწმდება.")
  else if (run?.status === "approved" && posts?.approvedAt) work.push("კვირის გეგმა და ტექსტები დადასტურებულია. ეს გამოქვეყნების დადასტურებას არ ნიშნავს.")
  else if (run?.payload.plan && !posts && !planningWorking) add("posts-start", "action", "გეგმის მიხედვით ტექსტებია მოსამზადებელი", "კვირის მიმართულებები შენახულია; პოსტების მომზადება ჯერ არ დაწყებულა.", contentHref, "პოსტების მომზადება")

  const channels = posts?.payload.outline ? [...new Set(posts.payload.outline.posts.flatMap((p) => p.channels.map((c) => c.channel)))] : operatingChannels(strategy.active?.payload.proposal)
  const missing = channels.filter((channel) => !accounts.some((a) => a.channel === channel && a.connected && a.canPublish))
  if (missing.length) add("connections", "action", "გამოქვეყნებისთვის არხებია დასაკავშირებელი", `${missing.map((c) => c === "facebook" ? "Facebook" : "Instagram").join(" · ")} — გამოსაქვეყნებელი კავშირი ხელმისაწვდომი არ არის.`, "/workspace/connections", "კავშირების შემოწმება")

  return { decisions: items.filter((i) => i.kind === "decision"), actions: items.filter((i) => i.kind === "action"), work }
}
