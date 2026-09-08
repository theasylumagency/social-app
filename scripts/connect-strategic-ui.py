from pathlib import Path
def edit(path,old,new):
 p=Path(path); s=p.read_text(encoding='utf-8')
 if old not in s: raise RuntimeError(f'Missing {path}: {old[:60]}')
 p.write_text(s.replace(old,new),encoding='utf-8')

edit('src/application/dashboard/model.ts','["week", "content",','["week", "strategy", "content",')
edit('src/app/workspace/shell.tsx','week: "კვირა",','week: "კვირა", strategy: "სტრატეგია",')
edit('src/app/workspace/shell.tsx','<Icon name={item} />','<Icon name={item === "strategy" ? "week" : item} />')
p=Path('src/app/workspace/[[...section]]/page.tsx'); s=p.read_text(encoding='utf-8'); s='''import Link from "next/link"
import { readStrategyView, readWeekEvidence } from "../../../infrastructure/postgres/social-strategy-store"
import { StrategyClient } from "../strategy-client"
import { EvidenceClient } from "../evidence-client"
import "../strategy.css"
'''+s
s=s.replace('ContentView, ResultsView, SettingsView','ContentView, SettingsView')
s=s.replace('planning, accounts] =','planning, accounts, strategy, evidence] =')
anchor='    section === "connections" ? readConnectionAccounts(new PostgresSocialConnectionsStore(pool), { ownerId: session.user.id, brandId: brand.id }) : Promise.resolve([]),'
s=s.replace(anchor,anchor+'\n    readStrategyView(pool, session.user.id, brand.id),\n    section === "results" ? readWeekEvidence(pool, session.user.id, brand.id) : Promise.resolve([]),')
s=s.replace('    {section === "week" ? <WeekView','''    {section === "strategy" || ((section === "week" || section === "content") && !strategy.active && !planning?.run) ? <StrategyClient key={brand.id} brandId={brand.id} initial={strategy} /> : null}
    {(section === "week" || section === "content") && strategy.active ? <section className="ws-card strategy-banner"><p className="eyebrow">მოქმედი სოციალური სტრატეგიული მიზანი</p><h2>{strategy.active.payload.proposal?.objective}</h2><p>{strategy.active.payload.proposal?.horizon}</p><Link className="ws-text-link" href="/workspace/strategy">სტრატეგია, არხები და გაზომვის კრიტერიუმები →</Link></section> : null}
    {section === "week" && (strategy.active || planning?.run) ? <WeekView''')
s=s.replace('{section === "content" ? <ContentView','{section === "content" && (strategy.active || planning?.run) ? <ContentView').replace('{section === "results" ? <ResultsView /> : null}','{section === "results" ? <EvidenceClient key={brand.id} brandId={brand.id} initial={evidence} /> : null}')
p.write_text(s,encoding='utf-8')
p=Path('src/app/workspace/weekly-planning-client.tsx'); s=p.read_text(encoding='utf-8').replace('import { displayDate }','import { currentWeek, displayDate }')
anchor='  const plan = p.plan!'; s=s.replace(anchor,anchor+'\n  const strategic = p.socialStrategy?.payload.proposal')
s=s.replace('{alignedGoals.map((g) => <strong key={g.id}>{g.title}</strong>)}','{strategic ? <strong>{strategic.objective}</strong> : <span>ისტორიული გეგმა · მოქმედი სოციალური სტრატეგია ჯერ არ იყო დადგენილი.</span>}{!strategic ? alignedGoals.map((g) => <strong key={g.id}>{g.title}</strong>) : null}')
s=s.replace('  return <div className="wp-report">','''  return <div className="wp-report">
    <section className="ws-card"><h3>რა მონაცემს დაეყრდნო ეს კვირა</h3>{p.evidence?.map((e) => <article key={e.week}><strong>{e.week} · {e.availability === "available" ? "დაკვირვებები ხელმისაწვდომია" : "შედეგები უცნობია"}</strong>{e.execution.map((v) => <p key={v}>{v}</p>)}{e.observations.map((o, i) => <p key={i}>{o.observation} · წყარო: {o.source}</p>)}{e.unknowns.map((v) => <p key={v}>{v}</p>)}</article>) ?? <p>ძველი გეგმა: შედეგების გამოყენების ჩანაწერი არ არის.</p>}</section>''')
# prevent generation via future and archived week UI; existing plans remain visible
anchor=next(l for l in s.splitlines() if 'async function action(' in l)
s=s.replace(anchor,anchor+'\n    if (week !== currentWeek()) { setError("ახალი სამუშაო მხოლოდ მიმდინარე კვირისთვის მზადდება. არჩეული კვირა ისტორიად რჩება."); return }')
s=s.replace('stages[run.step]','stages[run.step]')
s=s.replace('მიზანი → ფოკუსი → მიმართულებები → ადაპტაცია → ექსპერიმენტი → შემოწმება','მოქმედი სტრატეგია → მიმდინარე კვირის გეგმა')
p.write_text(s,encoding='utf-8')
# Keep saved legacy selection state restored, but remove all goal-selection UI.
edit('src/app/brand-dossier.tsx','const [goalIds]','const [goalIds, setGoalIds]')
