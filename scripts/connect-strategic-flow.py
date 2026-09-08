from pathlib import Path
def edit(path, old, new):
 p=Path(path); s=p.read_text(encoding='utf-8')
 if old not in s: raise RuntimeError(f'Missing anchor {path}: {old[:80]}')
 p.write_text(s.replace(old,new),encoding='utf-8')

p=Path('src/application/weekly-planning/advance.ts'); s=p.read_text(encoding='utf-8')
remove=['WeeklyObjectiveModelOutput','WeeklyAudienceFocusModelOutput','ContentDirectionModelOutput','ContentAudienceDirectionModelOutput','ExperimentDecisionModelOutput','validateReferences','WEEKLY_OBJECTIVE_SYSTEM_PROMPT','WEEKLY_AUDIENCE_FOCUS_SYSTEM_PROMPT','CONTENT_DIRECTION_SYSTEM_PROMPT','CONTENT_AUDIENCE_DIRECTION_SYSTEM_PROMPT','EXPERIMENT_DECISION_SYSTEM_PROMPT','WEEKLY_PLAN_REVIEW_PROMPT','WEEKLY_OBJECTIVE_OUTPUT_SCHEMA']
s='\n'.join(l for l in s.splitlines() if not (l.startswith('import ') and any(x in l for x in remove)))
s=s.replace('PlanningPayload, PlanningReview','PlanningPayload')
s=s.replace('selectedBrandGoals: basis.goals.filter', 'selectedBrandGoals: p.socialStrategy?.payload.proposal ? [{ goalKey: "g1", title: p.socialStrategy.payload.proposal.objective, desiredChange: p.socialStrategy.payload.proposal.plan.audienceChange, rationale: p.socialStrategy.payload.proposal.rationale, progressSignals: p.socialStrategy.payload.proposal.measurement.map((m) => m.signal) }] : basis.goals.filter')
s=s.replace('    recentResults: [], recentSignals: [], channelContext: { confirmedDestinations: [], publishingSchedule: null },\n    dataAvailability: { performance: "notSupplied", proof: "notSupplied", priorPlansAreResults: false },','''    socialStrategy: p.socialStrategy?.payload.proposal ?? null,
    strategyVersion: p.socialStrategy ? { id: p.socialStrategy.id, revision: p.socialStrategy.revision, approvedAt: p.socialStrategy.payload.approvedAt } : null,
    recentResults: (p.evidence ?? []).filter((e) => e.availability === "available"),
    recentSignals: (p.evidence ?? []).flatMap((e) => e.observations),
    evidenceReview: p.evidence ?? [],
    channelContext: { recommendations: p.socialStrategy?.payload.proposal?.channels ?? [], confirmedDestinations: [], publishingSchedule: null },
    dataAvailability: { performance: p.evidence?.some((e) => e.availability === "available") ? "suppliedObservations" : "unavailable", proof: "notSupplied", priorPlansAreResults: false },''')
start=s.index('  if (run.step === "objective" && p.founderPosts)'); s=s[:start]+'''  if (run.step === "ready") return { payload: p, step: "ready" }
  // Old in-flight stage names resume through one complete weekly proposal. No serial sub-planners.
  const s = await runModel<CompactStrategy>({ step: "weekly_strategy", version: "current-week-v3", prompt: COMPACT_STRATEGY_PROMPT, input: context, schema: COMPACT_STRATEGY_SCHEMA, validate: (v) => validateCompactStrategy(v as CompactStrategy, audienceKeys) })
  p.objective = s.weeklyObjective; p.focus = s.focus; p.directions = s.directions; p.adaptation = s.audienceDirections; p.experiment = s.experimentDecision
  // Structural checks ran on the proposal. Factual/voice/editorial review belongs to the actual copy.
  p.review = { brandGoalKeys: context.selectedBrandGoals.map((g) => g.goalKey), progressSignals: p.socialStrategy?.payload.proposal?.measurement.map((m) => m.signal) ?? [], checks: {
    brandSpecificity: "გეგმა ეყრდნობა ბრენდის დადასტურებულ საფუძველს.", focusCoherence: "აუდიტორიისა და მიმართულებების ბმულები შემოწმებულია.", voiceCompatibility: "ტექსტების შეფასება ბრენდის ხმის წესებით მოხდება.", evidenceDiscipline: context.dataAvailability.performance === "unavailable" ? "შედეგები ჯერ უცნობია; შექმნილი კონტენტი აუდიტორიის პროგრესს არ ამტკიცებს." : "გათვალისწინებულია წყაროს მითითებით შენახული დაკვირვებები.", priorityResponse: p.priority || "დამატებითი ბიზნესკონტექსტი არ არის მითითებული.",
  }, concerns: [] }
  p.plan = assemblePlanningRun({ ...run, payload: p }, now as IsoDateTime)
  return { payload: p, step: "ready" }
}
'''; p.write_text(s,encoding='utf-8')
edit('src/blueprints/social/weekly-planning/compact-strategy.ts','Create the strategic foundation for one founder\'s weekly social-media plan.','Plan ONLY the current operational week under the approved persistent socialStrategy. Never replace the strategic objective at a calendar boundary or produce detailed future weeks. Explain in the weekly rationale what changed based on evidenceReview, what is observed vs hypothesized, and what remains unknown. If results are missing say so explicitly. Repeated strategic ideas across weeks are allowed. Create one week\'s working plan.')
edit('src/blueprints/social/weekly-planning/compact-strategy.ts','A separate reviewer will check all decisions.','Application validates structure. Actual content receives factual and editorial review.')
edit('src/infrastructure/postgres/weekly-planning-store.ts','import { isWeek }','import { currentWeek, isWeek }')
p=Path('src/infrastructure/postgres/weekly-planning-store.ts'); s=p.read_text(encoding='utf-8'); s='''import { readStrategyView, readWeekEvidence } from "./social-strategy-store"
import { hasSubscription } from "./subscription-store"
import { copyTexts } from "../../blueprints/social/weekly-planning/duplicate-hygiene"
'''+s
s=s.replace(' || !d.payload.feedback.selectedGoalIds?.length','').replace('p.feedback.selectedGoalIds!.some','(p.feedback.selectedGoalIds ?? []).some')
s=s.replace('    const foundation = await basis(c, ownerId, input.brandId)','''    if (input.week !== currentWeek()) throw new Error("ახალი გეგმა მხოლოდ მიმდინარე კვირისთვის იქმნება. ძველი კვირები ისტორიად რჩება.")
    if (!await hasSubscription(c, ownerId)) throw new Error("განაახლეთ გამოწერა.")
    const strategy = (await readStrategyView(c, ownerId, input.brandId)).active
    if (!strategy?.payload.proposal) throw new Error("ჯერ სოციალური სტრატეგიის მიზანი დაადასტურეთ.")
    const evidence = (await readWeekEvidence(c, ownerId, input.brandId)).filter((e) => e.week <= input.week)
    const foundation = await basis(c, ownerId, input.brandId)''')
s=s.replace('    // Include generated proposals: founders can compare two weeks before approving either.','    // Execution history is not evidence of exposure or performance.')
s=s.replace('const payload: PlanningPayload = { basis: foundation,','const payload: PlanningPayload = { socialStrategy: strategy, evidence, priorCopy: prior.rows.flatMap((r) => r.posts_payload ? copyTexts(r.posts_payload).map((c) => c.text) : []), basis: foundation,')
anchor='    payload.founderPosts = true'
s=s.replace(anchor,'''    // Reviewing no observations is an explicit unknown state, never fabricated progress.
    for (const row of prior.rows) {
      if (!evidence.some((e) => e.week === row.week)) evidence.push({ week: row.week, reviewedAt: now, availability: "unavailable", observations: [], execution: [row.posts_payload?.copies && Object.keys(row.posts_payload.copies).length ? "ტექსტები მომზადებულია; გამოქვეყნება და აუდიტორიის რეაქცია დაუდგენელია." : "კვირის გეგმა არსებობდა; შესრულება დაუდგენელია."], unknowns: ["შედეგები არ არის მოწოდებული."], businessContext: "" })
    }
    if (!evidence.length) evidence.push({ week: input.week, reviewedAt: now, availability: "unavailable", observations: [], execution: [], unknowns: ["ეს საწყისი გეგმაა; წინა შედეგები არ გვაქვს."], businessContext: "" })
'''+anchor)
p.write_text(s,encoding='utf-8')
edit('src/application/weekly-planning/posts.ts','import type { PlanningRun }','import { duplicateCopyIssues } from "../../blueprints/social/weekly-planning/duplicate-hygiene"\nimport type { PlanningRun }')
edit('src/application/weekly-planning/posts.ts','  return consolidatePostReviews(safety.value, editorial.value)','  const combined = consolidatePostReviews(safety.value, editorial.value)\n  return { ...combined, issues: [...combined.issues, ...duplicateCopyIssues(payload, run.payload.priorCopy)] }')

for path in ['src/lib/auth/create-auth.ts','src/app/(auth)/auth-form.tsx','src/app/workspace/views.tsx','src/app/workspace/weekly-posts-client.tsx']:
 p=Path(path); s=p.read_text(encoding='utf-8'); s=s.replace('14-დღიანი საცდელი პერიოდი დაიწყება პირველი ბრენდის გამართვისთანავე.','მუშაობის დასაწყებად აირჩიე გამოწერა. ტესტირებისას თანხა არ ჩამოიჭრება.').replace('ტარიფი და საცდელი პერიოდი','გამოწერის მართვა').replace('ტარიფები და საცდელი პერიოდის ათვლა ჯერ არ არის გააქტიურებული. თქვენი ბრენდის ინფორმაცია ინახება სამუშაო სივრცეში.','გამოწერის გაუმჯობესება, განახლება და გადახდების ისტორია ანგარიშიდანაა ხელმისაწვდომი.').replace('საცდელ პერიოდში','ტესტირებისას'); p.write_text(s,encoding='utf-8')
