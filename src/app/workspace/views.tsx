import Link from "next/link"
import type { ReactNode } from "react"
import { displayDate, knowledgeList, knowledgeText, safeSourceUrl, shiftWeek, weekLabel, type DashboardBrand, type DashboardSource, type WeeklyBrief } from "../../application/dashboard/model"
import { ObjectiveEditor } from "./controls"
import { Icon, type IconName } from "./icons"

export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="ws-page-heading"><div><p className="ws-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{children}</div>
}

function EmptyState({ icon, title, children, compact = false }: { icon: IconName; title: string; children: ReactNode; compact?: boolean }) {
  return <div className={`ws-empty ${compact ? "ws-empty-compact" : ""}`}><span className="ws-empty-icon"><Icon name={icon} /></span><h3>{title}</h3>{children}</div>
}

export function WeekView({ brand, sources, week, today, brief }: { brand: DashboardBrand; sources: DashboardSource[]; week: string; today: string; brief: WeeklyBrief }) {
  const current = week === today
  return <>
    <PageHeading eyebrow="თქვენი კვირა, ერთი შეხედვით" title={current ? "კარგი კვირა აქ იწყება." : "კვირის სამუშაო სივრცე"} description={`${brand.name} · ${current ? "მიმდინარე კვირის მიზანი და შემდეგი ნაბიჯები" : "არჩეული კვირის მიზანი და კონტენტი"}`}>
      <div className="ws-week-picker"><Link href={`/workspace?week=${shiftWeek(week, -1)}`} aria-label="წინა კვირა"><Icon name="chevron" style={{ transform: "rotate(180deg)" }} /></Link><span><Icon name="week" />{weekLabel(week)}</span><Link href={`/workspace?week=${shiftWeek(week, 1)}`} aria-label="შემდეგი კვირა"><Icon name="chevron" /></Link></div>
    </PageHeading>
    {!current ? <Link className="ws-back-current" href="/workspace">მიმდინარე კვირაზე დაბრუნება <Icon name="arrow" /></Link> : null}
    <div className="ws-work-grid"><div className="ws-work-primary">
      <section className="ws-operator-status" aria-labelledby="operator-status-title">
        <div className="ws-status-top"><span className="ws-status-label"><span />საწყისი ეტაპი</span><span className="ws-status-code">01 / 05</span></div>
        <div className="ws-status-body"><div><h2 id="operator-status-title">ბრენდი მზადაა.<br />წინ პირველი კვირაა.</h2><p>ბრენდის საწყისი ინფორმაცია შენახულია.<br />შემდეგი ნაბიჯია კვირის გეგმა და პირველი კონტენტი.</p></div><span className="ws-status-symbol"><Icon name="spark" /></span></div>
        <div className="ws-status-footer"><span><Icon name="check" />ბრენდის საფუძველი შექმნილია</span><Link href="/workspace/brand">ბრენდის ნახვა <Icon name="arrow" /></Link></div>
      </section>
      <ObjectiveEditor key={`${brand.id}:${week}`} brandId={brand.id} week={week} brief={brief} />
      <section className="ws-card ws-workflow" aria-labelledby="workflow-title"><div className="ws-card-heading"><h2 id="workflow-title">კვირის სამუშაო ციკლი</h2><span className="ws-subtle">გეგმიდან გამოქვეყნებამდე</span></div>
        <ol>{["გეგმა", "მომზადება", "განხილვა", "დაგეგმვა", "გამოქვეყნება"].map((step, index) => <li key={step} className={index === 0 ? "is-next" : ""}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong><small>{index === 0 ? "შემდეგი ნაბიჯი" : "ჯერ არ დაწყებულა"}</small></li>)}</ol>
      </section>
      <section className="ws-card ws-week-content"><div className="ws-card-heading"><h2>ამ კვირის კონტენტი <span className="ws-count">0</span></h2><Link className="ws-text-link" href="/workspace/content">ყველა კონტენტი <Icon name="arrow" /></Link></div>
        <EmptyState icon="content" title="პირველი პოსტები ჯერ წინ არის" compact><p>ამ კვირისთვის კონტენტი ჯერ არ შექმნილა.<br />გეგმის მომზადების შემდეგ აქ გამოჩნდება პოსტები და მათი მდგომარეობა.</p><span className="ws-availability-note">გეგმის ავტომატური მომზადება ჯერ არ არის ჩართული.</span></EmptyState>
      </section>
    </div><aside className="ws-context-rail" aria-label="შემდეგი ნაბიჯები და აქტივობა">
      <section className="ws-attention"><span className="ws-rail-label"><Icon name="check" />თქვენგან ამ ეტაპზე</span><h2>გადასაწყვეტი<br />არაფერია.</h2><p>განსახილველი გეგმა ან პოსტი ჯერ არ არის. მნიშვნელოვანი გადაწყვეტილება აქ გამოჩნდება.</p><div className="ws-attention-bottom">შეგიძლიათ კვირის მიზანი დაამატოთ.</div></section>
      <section className="ws-rail-section"><div className="ws-rail-heading"><h2>შემდეგი ნაბიჯი</h2><Icon name="arrow" /></div><div className="ws-next-step"><span className="ws-step-dot" /><div><h3>პირველი კვირის გეგმა</h3><p>მიზანი, კონტენტის მიმართულებები და თითოეული პოსტის როლი.</p><span className="ws-subtle">ჯერ არ მომზადებულა</span></div></div></section>
      <section className="ws-rail-section"><div className="ws-rail-heading"><h2>ბრენდის საფუძველი</h2><Icon name="brand" /></div><div className="ws-foundation-row"><span>შეთავაზება</span><Icon name="check" /></div><div className="ws-foundation-row"><span>კონტენტის ენა</span><Icon name="check" /></div><div className="ws-foundation-row"><span>წყაროები</span><strong>{sources.length}</strong></div><Link className="ws-text-link" href="/workspace/brand?view=sources">ცოდნისა და წყაროების ნახვა <Icon name="arrow" /></Link></section>
      <section className="ws-rail-section"><div className="ws-rail-heading"><h2>ბოლო მოქმედებები</h2><Icon name="clock" /></div><ol className="ws-activity">{brief ? <li><span /><div><h3>კვირის მიზანი შეინახეთ</h3><time dateTime={brief.updatedAt}>{displayDate(brief.updatedAt, { hour: "2-digit", minute: "2-digit" })}</time></div></li> : null}<li><span /><div><h3>ბრენდის საფუძველი შეიქმნა</h3><p>{sources.length} წყარო შენახულია</p><time dateTime={brand.createdAt}>{displayDate(brand.createdAt)}</time></div></li></ol></section>
    </aside></div>
  </>
}

const filters = [{ id: "all", label: "ყველა" }, { id: "review", label: "განსახილველი" }, { id: "approved", label: "დამტკიცებული" }, { id: "scheduled", label: "დაგეგმილი" }, { id: "published", label: "გამოქვეყნებული" }, { id: "draft", label: "მონახაზი" }]

export function ContentView({ filter, view, week }: { filter: string; view: string; week: string }) {
  const selected = filters.find((item) => item.id === filter) ?? filters[0]!
  const calendar = view === "calendar"
  return <><PageHeading eyebrow="შექმნა · განხილვა · გამოქვეყნება" title="თქვენი კონტენტი" description="ყველა პოსტი, თავისი მიზნითა და მდგომარეობით." />
    <div className="ws-content-toolbar"><nav className="ws-tabs ws-filter-tabs" aria-label="კონტენტის მდგომარეობა">{filters.map((item) => <Link key={item.id} aria-current={selected.id === item.id ? "page" : undefined} href={`/workspace/content?filter=${item.id}&view=${calendar ? "calendar" : "list"}&week=${week}`}>{item.label}{selected.id === item.id ? <span className="ws-count">0</span> : null}</Link>)}</nav><nav className="ws-view-toggle" aria-label="კონტენტის ხედი"><Link aria-current={!calendar ? "page" : undefined} href={`/workspace/content?filter=${selected.id}&view=list&week=${week}`} aria-label="სია"><Icon name="content" /></Link><Link aria-current={calendar ? "page" : undefined} href={`/workspace/content?filter=${selected.id}&view=calendar&week=${week}`} aria-label="კალენდარი"><Icon name="week" /></Link></nav></div>
    <section className="ws-card">{calendar ? <><div className="ws-card-heading"><h2>{weekLabel(week)}</h2><div className="ws-calendar-navigation"><Link aria-label="წინა კვირა" href={`/workspace/content?view=calendar&filter=${selected.id}&week=${shiftWeek(week, -1)}`}><Icon name="chevron" style={{ transform: "rotate(180deg)" }} /></Link><Link aria-label="შემდეგი კვირა" href={`/workspace/content?view=calendar&filter=${selected.id}&week=${shiftWeek(week, 1)}`}><Icon name="chevron" /></Link></div></div><div className="ws-calendar">{["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"].map((day, i) => { const date = new Date(`${week}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + i); return <div key={day}><span>{day}</span><strong>{date.getUTCDate()}</strong><small>პოსტები არ არის</small></div> })}</div></> : null}
      <EmptyState icon="content" title={selected.id === "all" ? "აქ დაიწყება თქვენი კონტენტის ისტორია" : `${selected.label} პოსტები ჯერ არ არის`}><p>პოსტების შექმნის შემდეგ აქ შეძლებთ მათი მიზნის, ტექსტის,<br />განხილვისა და გამოქვეყნების მდგომარეობის ნახვას.</p><Link className="ws-button ws-button-green" href="/workspace">კვირის სამუშაო სივრცე <Icon name="arrow" /></Link></EmptyState>
    </section><div className="ws-info-line"><Icon name="info" /><p>კონტენტის გენერაცია და სოციალურ ქსელებში გამოქვეყნება ჯერ არ არის ჩართული.</p></div>
  </>
}

export function ResultsView() {
  return <><PageHeading eyebrow="შედეგიდან — შემდეგ გადაწყვეტილებამდე" title="რას ვსწავლობთ" description="რა გავაკეთეთ, რა მოხდა და რას შევცვლით შემდეგ." /><section className="ws-card ws-results-empty"><EmptyState icon="results" title="შედეგები ჯერ არ დაგროვებულა"><p>პირველი პოსტების გამოქვეყნებისა და სოციალური ანგარიშების<br />დაკავშირების შემდეგ აქ გამოჩნდება გაზომილი შედეგები.</p><Link className="ws-button ws-button-green" href="/workspace/connections">კავშირების ნახვა <Icon name="arrow" /></Link></EmptyState></section>
    <div className="ws-learning-grid">{[{ icon: "target", title: "რა მოხდა?", text: "თითოეული პოსტის შედეგი მის მიზანთან ერთად შეფასდება." }, { icon: "brand", title: "რა ვისწავლეთ?", text: "დასკვნებისთვის საკმარისი მონაცემი გვჭირდება. ერთი პოსტი წესს არ ქმნის." }, { icon: "arrow", title: "რას შევცვლით?", text: "დასაბუთებული დასკვნა შემდეგი კვირის გადაწყვეტილებაში აისახება." }].map((item) => <section className="ws-card" key={item.title}><Icon name={item.icon as IconName} /><h2>{item.title}</h2><p>{item.text}</p></section>)}</div>
  </>
}

const toneLabels: Record<string, string> = { clear: "მარტივი", calm: "მშვიდი", professional: "პროფესიონალური", friendly: "მეგობრული", energetic: "ენერგიული" }

function KnowledgeSection({ title, items, fallback, defaultVoice = false }: { title: string; items: string[]; fallback: string; defaultVoice?: boolean }) {
  return <section className="ws-card ws-knowledge-card"><div className="ws-card-heading"><h2>{title}</h2><Icon name="brand" /></div>{items.length ? <><ul>{items.map((item, i) => <li key={`${item}:${i}`}>{item}</li>)}</ul><span className="ws-provenance"><Icon name="check" />თქვენ მიერ მითითებული ინფორმაცია</span></> : <><p className="ws-muted">{fallback}</p>{defaultVoice ? <span className="ws-provenance">UNDA-ს საწყისი სტილი</span> : <span className="ws-subtle">არ არის მითითებული · მუშაობას არ ბლოკავს</span>}</>}</section>
}

export function SourcesList({ sources }: { sources: DashboardSource[] }) {
  return <div className="ws-source-list">{sources.map((source) => <div className="ws-source-row" key={source.id}><span className="ws-source-icon"><Icon name={source.url ? "globe" : "content"} /></span><div><h3>{source.url ? "ვებსაიტი" : "ბრენდის საწყისი ინფორმაცია"}</h3>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.url} ↗</a> : <p>თქვენ მიერ გადამოწმებული და შენახული პასუხები</p>}<small>{source.capturedAt ? `ბოლოს წაკითხულია: ${displayDate(source.capturedAt, { year: "numeric" })}` : "ჯერ არ წაკითხულა"}</small></div><span className="ws-badge"><Icon name="check" />შენახულია</span></div>)}</div>
}

export function BrandView({ brand, sources, view }: { brand: DashboardBrand; sources: DashboardSource[]; view: string }) {
  const k = brand.knowledge
  const active = ["sources", "history"].includes(view) ? view : "knowledge"
  const description = knowledgeText(k, "identityShortDescription")
  const website = safeSourceUrl(knowledgeText(k, "identityWebsite"))
  return <><PageHeading eyebrow="თქვენი ბრენდის საფუძველი" title={brand.name} description="რა ვიცით, საიდან ვიცით და რას ვეყრდნობით." /><nav className="ws-tabs ws-brand-tabs" aria-label="ბრენდის ინფორმაცია">{[{ id: "knowledge", label: "ბრენდის ცოდნა" }, { id: "sources", label: "წყაროები" }, { id: "history", label: "ისტორია" }].map((item) => <Link href={`/workspace/brand?view=${item.id}`} key={item.id} aria-current={active === item.id ? "page" : undefined}>{item.label}{item.id === "sources" ? <span className="ws-count">{sources.length}</span> : null}</Link>)}</nav>
    {active === "sources" ? <section className="ws-card"><div className="ws-card-heading"><h2>საიდან ვიცით ბრენდის შესახებ</h2></div><SourcesList sources={sources} /><p className="ws-card-note">წყაროს შენახული ვერსია გამოყენებულია ბრენდის საწყისი ინფორმაციისთვის. ავტომატური ხელახალი შემოწმება ჯერ არ არის ჩართული.</p></section> : active === "history" ? <section className="ws-card ws-history"><span className="ws-history-check"><Icon name="check" /></span><div><time dateTime={brand.createdAt}>{displayDate(brand.createdAt, { year: "numeric" })}</time><h2>შეიქმნა ბრენდის საწყისი საფუძველი</h2><p>თქვენ მიერ გადამოწმებული ინფორმაცია შენახულია. საფუძველი ეყრდნობა {sources.length} წყაროს.</p><Link className="ws-text-link" href="/workspace/brand?view=sources">წყაროების ნახვა <Icon name="arrow" /></Link></div></section> : <>
      <section className="ws-card ws-brand-profile"><span className="ws-profile-avatar">{brand.name.slice(0, 1)}</span><div><h2>{brand.name}</h2>{description ? <p>{description}</p> : null}<div className="ws-brand-metadata">{knowledgeText(k, "identityIndustry") ? <span>{knowledgeText(k, "identityIndustry")}</span> : null}{knowledgeList(k, "identityLocations").map((item) => <span key={item}>{item}</span>)}{website ? <a href={website} target="_blank" rel="noreferrer"><Icon name="globe" />{new URL(website).hostname} ↗</a> : null}</div></div><span className="ws-badge"><Icon name="check" />საფუძველი მზადაა</span></section>
      <div className="ws-knowledge-grid"><KnowledgeSection title="რას ვთავაზობთ" items={knowledgeList(k, "offerPrimaryServices")} fallback="მომსახურება ჯერ არ არის მითითებული." /><KnowledgeSection title="ვის ვესაუბრებით" items={knowledgeList(k, "audiencePrimarySegments")} fallback="აუდიტორია ჯერ არ არის დაზუსტებული. კონკრეტული ასაკი ან ინტერესები არ არის ნავარაუდევი." /><KnowledgeSection title="ხმა და სტილი" items={knowledgeList(k, "voicePrimaryTone").map((tone) => toneLabels[tone] ?? tone)} fallback="მარტივი, მშვიდი და პროფესიონალური კომუნიკაცია." defaultVoice /><KnowledgeSection title="საკომუნიკაციო მიზნები" items={knowledgeList(k, "contentGoals")} fallback="კონკრეტული კვირის პრიორიტეტის დამატება კვირის გვერდიდან შეგიძლიათ." /><KnowledgeSection title="შეზღუდვები" items={knowledgeList(k, "constraintsSensitiveTopics")} fallback="დამატებითი შეზღუდვები არ არის მითითებული." /><KnowledgeSection title="კონტენტის ენა" items={knowledgeList(k, "identityLanguages").map((language) => language === "ka" ? "ქართული" : language === "en" ? "ინგლისური" : language)} fallback="ენა ჯერ არ არის მითითებული." /></div>
      <div className="ws-info-line"><Icon name="info" /><p>აქ ნაჩვენებია ბრენდის შექმნისას დადასტურებული ინფორმაცია. ცოდნის დაზუსტება და ახალი წყაროების დამატება შემდეგ ეტაპზე გახდება ხელმისაწვდომი.</p></div>
    </>}
  </>
}

export function ConnectionsView({ sources }: { sources: DashboardSource[] }) {
  const websiteSources = sources.filter((source) => source.url)
  return <><PageHeading eyebrow="ბრენდის კავშირები" title="სად მუშაობს Operator" description="სოციალური ანგარიშები და წვდომა თქვენს წყაროებზე." /><section className="ws-card ws-connection-card"><div className="ws-card-heading"><h2>სოციალური ანგარიშები</h2><span className="ws-subtle">0 დაკავშირებული</span></div>{[{ icon: "facebook", name: "Facebook", text: "გვერდზე გამოქვეყნება და პოსტების შედეგები" }, { icon: "instagram", name: "Instagram", text: "კონტენტის გამოქვეყნება და აუდიტორიის რეაქცია" }].map((channel) => <div className="ws-channel-row" key={channel.name}><span className={`ws-channel-icon ws-${channel.icon}`}><Icon name={channel.icon as IconName} /></span><div><h3>{channel.name}</h3><p>{channel.text}</p></div><span className="ws-neutral-badge">არ არის დაკავშირებული</span></div>)}<div className="ws-connection-note"><Icon name="info" /><p>სოციალური ანგარიშების დაკავშირება ჯერ არ არის ხელმისაწვდომი. ანგარიშის ბმულის დამატება გამოქვეყნების უფლებას არ იძლევა.</p></div></section><section className="ws-card"><div className="ws-card-heading"><h2>ვებსაიტის წყაროები</h2><Link className="ws-text-link" href="/workspace/brand?view=sources">ყველა წყარო <Icon name="arrow" /></Link></div>{websiteSources.length ? <SourcesList sources={websiteSources} /> : <EmptyState icon="globe" title="ვებსაიტის წყარო ჯერ არ არის შენახული" compact><p>ბრენდის საფუძველი თქვენს მიერ შევსებულ ინფორმაციას ეყრდნობა.</p></EmptyState>}</section></>
}

export function SettingsView({ brand, user, brandCount }: { brand: DashboardBrand; user: { name: string; email: string }; brandCount: number }) {
  return <><PageHeading eyebrow="თქვენი სამუშაო გარემო" title="პარამეტრები" description="სამუშაო სივრცე, ანგარიში და წვდომა." /><div className="ws-settings-grid"><section className="ws-card"><div className="ws-card-heading"><h2>სამუშაო სივრცე</h2><Icon name="brand" /></div><dl className="ws-settings-list"><div><dt>მიმდინარე ბრენდი</dt><dd>{brand.name}</dd></div><div><dt>ბრენდების რაოდენობა</dt><dd>{brandCount}</dd></div><div><dt>ინტერფეისის ენა</dt><dd>ქართული</dd></div><div><dt>კვირის დროის სარტყელი</dt><dd>თბილისი · UTC+4</dd></div></dl></section><section className="ws-card"><div className="ws-card-heading"><h2>ჩემი ანგარიში</h2><Icon name="settings" /></div><div className="ws-settings-body"><h3>{user.name}</h3><p>{user.email}</p><Link className="ws-button ws-button-outline" href="/account">ანგარიშის მართვა <Icon name="arrow" /></Link><small>პაროლი, Google-ით შესვლა და აქტიური სესიები.</small></div></section><section className="ws-card ws-plan-note"><Icon name="info" /><div><h2>ტარიფი და საცდელი პერიოდი</h2><p>ტარიფები და საცდელი პერიოდის ათვლა ჯერ არ არის გააქტიურებული. თქვენი ბრენდის ინფორმაცია ინახება სამუშაო სივრცეში.</p></div></section></div></>
}
