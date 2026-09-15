import Link from "next/link"
import { displayDate } from "../../application/dashboard/model"
import type { DeliveryItem, DeliverySnapshot, DeliveryState } from "../../application/publishing/delivery-view"

const states: Record<DeliveryState, { label: string; detail: string }> = {
  published: { label: "გამოქვეყნებულია", detail: "გამოქვეყნება დადასტურებულია მიღებული შედეგით." },
  cancelled: { label: "გაუქმებულია", detail: "განრიგში გაუქმება დაფიქსირებულია." },
  scheduled: { label: "დაგეგმილია", detail: "გამოქვეყნების დრო ჯერ არ დამდგარა." },
  queued: { label: "შესრულებას ელოდება", detail: "გამოქვეყნების დრო დადგა; გაგზავნის მცდელობა ჯერ არ დაფიქსირებულა." },
  sending: { label: "მზადდება გასაგზავნად", detail: "შესრულების მცდელობა დაწყებულია; საბოლოო შედეგი ჯერ არ გვაქვს." },
  retrying: { label: "განმეორებას ელოდება", detail: "დაფიქსირდა დროებითი წარუმატებლობა ან დადასტურებული არგამოქვეყნება. განმეორება მოქმედი წესებით დასაშვებია." },
  confirming: { label: "დადასტურებას ელოდება", detail: "გაგზავნა დაწყებულია; გამოქვეყნების საბოლოო შედეგი ჯერ არ დასტურდება." },
  unconfirmed: { label: "შედეგი გაურკვეველია", detail: "გამოქვეყნების დადასტურება დაგვიანებულია. ახალი გაგზავნის დაწყებამდე საჭიროა შედეგის დადგენა." },
  failed: { label: "გამოქვეყნება ვერ დასრულდა", detail: "დაფიქსირდა საბოლოო წარუმატებლობა ან ამოიწურა დაშვებული მცდელობები." },
  delayed: { label: "შესრულება დაგვიანებულია", detail: "მოსალოდნელ დროში ახალი შედეგი არ დაფიქსირებულა. საჭიროა შესრულების პროცესის შემოწმება." },
  disconnected: { label: "არხის კავშირია საჭირო", detail: "ამ ანგარიშზე მოქმედი გამოსაქვეყნებელი კავშირი ხელმისაწვდომი არ არის." },
  disabled: { label: "გამოქვეყნება გამორთულია", detail: "გამოქვეყნების სერვისი ამ გარემოში გამორთულია. შენახული განრიგი შესრულებას ვერ დაიწყებს." },
  unavailable: { label: "მდგომარეობა დასადგენია", detail: "გამოქვეყნების პარამეტრები ვერ გადამოწმდა; შესრულების შესაძლებლობას ვერ ვადასტურებთ." },
}

function DeliveryRow({ item }: { item: DeliveryItem }) {
  return <article className={`delivery-row${item.attention ? " delivery-needs-attention" : ""}`}>
    <div className="delivery-row-heading"><h3>{item.channel === "facebook" ? "Facebook" : "Instagram"} · {item.accountName} · პოსტი {item.postKey.slice(1)}</h3><span className={`delivery-badge delivery-${item.state}`}>{states[item.state].label}</span></div>
    <p>{states[item.state].detail}</p><p>განრიგით: <time dateTime={item.publishAt}>{displayDate(item.publishAt, { year: "numeric", hour: "2-digit" })}</time>{item.publishedAt ? <> · გამოქვეყნდა: <time dateTime={item.publishedAt}>{displayDate(item.publishedAt, { year: "numeric", hour: "2-digit" })}</time></> : null}</p>
    {item.cancelled && item.state !== "cancelled" ? <p className="brief-caution">გაუქმების ჩანაწერიც არსებობს. ის უკვე გაგზავნილი მოთხოვნის ან პუბლიკაციის გაუქმებას არ ადასტურებს.</p> : null}
    {item.state === "published" && item.unresolvedAttempt ? <p className="brief-caution">სხვა გაგზავნის მცდელობის შედეგი ჯერ გაურკვეველია. საჭიროა შესაძლო განმეორებითი გამოქვეყნების შემოწმება.</p> : null}
    <details><summary>მცდელობები და გეგმის წყარო</summary><p>{item.attempts} მცდელობა · გეგმის ვერსია {item.version} · კვირა {item.week}</p>{item.lastActivityAt ? <p>ბოლო ჩანაწერი: <time dateTime={item.lastActivityAt}>{displayDate(item.lastActivityAt, { year: "numeric", hour: "2-digit" })}</time></p> : null}<Link className="ws-text-link" href={`/workspace/content?week=${item.week}`}>ამ კვირის კონტენტი და ვერსიები ↗</Link></details>
  </article>
}

export function DeliveryStatus({ snapshot, week }: { snapshot: DeliverySnapshot; week?: string }) {
  if (snapshot.availability === "unavailable") return <section className="brief-caution" aria-label="გამოქვეყნების მდგომარეობა"><h2>გამოქვეყნების მდგომარეობა ვერ გადამოწმდა</h2><p>ჩანაწერების მიღება ვერ მოხერხდა. ეს ცარიელ განრიგს ან წარმატებულ გამოქვეყნებას არ ნიშნავს. განაახლეთ გვერდი ხელახლა შესამოწმებლად.</p></section>
  const items = snapshot.items.filter((item) => !week || item.week === week)
  const attention = items.filter((i) => i.attention)
  const published = items.filter((i) => i.state === "published")
  const pending = items.filter((i) => !i.attention && i.state !== "published" && i.state !== "cancelled")
  const history = items.filter((i) => !i.attention)
  return <section className="ws-card brief-panel delivery-panel" aria-label="გამოქვეყნების მდგომარეობა">
    <p className="ws-eyebrow">UNDA-ში შენახული განრიგი · {week ? `${week}-ის კვირა` : "ყველა პერიოდი"}</p><h2>გამოქვეყნების მდგომარეობა</h2>
    {!items.length ? <p>{week ? "ამ კვირის პოსტებისთვის გამოქვეყნების ზუსტი განრიგი ჯერ არ არის შენახული." : "გამოქვეყნების ზუსტი განრიგი ჯერ არ არის შენახული."} გეგმის ან ტექსტის დადასტურება თავისთავად გამოქვეყნებას არ იწყებს.</p> : <div className="delivery-totals"><span><strong>{published.length}</strong> დადასტურებული გამოქვეყნება</span><span><strong>{pending.length}</strong> დაგეგმილი ან მიმდინარე</span><span><strong>{attention.length}</strong> შესამოწმებელი</span></div>}
    {snapshot.publishingEnabled === false ? <p className="brief-caution">გამოქვეყნების სერვისი გამორთულია. მისი ჩართვა ცალკე ოპერაციული ნაბიჯია.</p> : snapshot.publishingEnabled === null ? <p className="brief-caution">გამოქვეყნების პარამეტრები ვერ გადამოწმდა.</p> : null}
    {attention.length ? <details className="delivery-issues" open><summary>შესამოწმებელი გამოქვეყნებები · {attention.length}</summary>{attention.map((item) => <DeliveryRow key={item.id} item={item} />)}</details> : null}
    {history.length ? <details className="delivery-history"><summary>განრიგი და დასრულებული ჩანაწერები · {history.length}</summary>{history.map((item) => <DeliveryRow key={item.id} item={item} />)}</details> : null}
    <small>ჩანაწერები წაკითხულია <time dateTime={snapshot.checkedAt}>{displayDate(snapshot.checkedAt, { hour: "2-digit" })}</time>. ნაჩვენებია შენახული შედეგები; გარე პოსტები და არხების უწყვეტი მონიტორინგი ამ ხედვაში არ შედის.</small>
  </section>
}
