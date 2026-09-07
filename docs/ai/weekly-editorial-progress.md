# Weekly editorial progress correction

## Diagnosis

The founder path uses `beginWeeklyPlanning` → compact strategy → strategy review → post schedule → writers → safety/editorial reviews. The older six-step strategy path remains supported. Both use the same planning context.

History previously selected only approved plans, retained three direction titles per typical week, and discarded direction purposes and post briefs. Two generated but unapproved weeks had no shared history. The standalone direction prompt also allowed recurrence merely because the territory remained relevant. Goal and audience selection were strategically consistent; the missing distinction was how content contributes to that goal.

Direction validation compared exact direction strings. Post validation compared exact titles. The strategy review had a general distinctness explanation but no required semantic comparisons. Finished-copy editorial checks assessed each post against its own brief. Three individually well-executed briefs could therefore repeat recent intellectual work and pass.

## Correction and ownership

- Capture the latest ready/approved version of each of up to three preceding weeks, within 28 days, including direction purposes and post jobs, takeaways and supporting points. Exclude current/future weeks and rejected/superseded versions. The application snapshots history when planning starts; title-only snapshots remain readable.
- Expose that memory throughout strategy and scheduling as editorial intentions, never proof, published content, performance or Brand Knowledge. The captured brand foundation is unchanged.
- Clarify that one goal permits several useful content roles, without a role quota, rotating goals, widening the subject or strengthening an ordinary voice.
- Reject exactly repeated job/takeaway pairs deterministically. Use one Social-specific semantic assessment before writing to compare every within-week pair and each post against the recent set. Require the closest historical reference and a substantive/incidental/none added-value assessment, independent of the relationship label.
- Application code owns coverage checks and blockers. A small addition to predominantly repeated work does not become acceptable merely because the reviewer calls it an overlap or advance. A context-grounded necessary recurrence can remain valid across weeks.
- Persist the review and allow one outline repair. Each generation/review runs under a separate existing worker lease; no new database stage or generic service is introduced. Cadence additions preserve retained jobs/copies/assets. Existing written jobs are not silently replanned. Unresolved sequence issues block approval and cannot be cleared by copy repair.

`PlanOutline` gains optional history fields. `PostsPayload` gains optional sequence review, feedback, repair count and retained count. Existing JSON payloads need no database migration. Existing completed plans are not retroactively rewritten; legacy batches that resume writing/review receive the sequence check. A cadence subset receives a fresh sequence assessment before any further writing/review.

The Writer and brand-voice contracts are unchanged. New semantic policy lives in `src/blueprints/social/weekly-planning/sequence.ts`, never `src/core`.

## Regression validation

`tests/weekly-sequence-fixture.ts` extracts Georgian jobs and copy directly from the supplied `task02/week1.md` and `week2.md`. Deterministic tests cover history projection, scope, legacy support, exact repetition, review coverage, added-value gates, bounded repair and retained-copy protection. Database tests cover history before approval, version selection, durable review across a writer failure, approval and copy-repair guards.

`npm run eval:weekly-sequence` explicitly runs live model evaluations and writes `evals/results/weekly-sequence/latest.json`. It tests the supplied cross-week repetition, combining semantically overlapping posts within one week, substantive Almost Another alternatives, paraphrased item-repair repetition within/across weeks, useful narrow-subject continuations, and an explicitly requested repeat. Mocked tests verify application behavior; they do not establish semantic detection accuracy. Live evaluation is separate from routine tests.

Validation completed on 2026-09-08:

- 227 existing domain tests and 34 focused planning, voice, model-runtime and database tests passed.
- Type checking, domain compilation, production build and lint for changed files passed. Full-project lint remains blocked by the pre-existing internal-link error in `src/app/workspace/connections-client.tsx`.
- All seven cases in `latest.json` passed with the revised semantic contract; all three supplied cross-week posts were flagged. The additional requested-repeat case passed in `ordinary-requested-repeat.json`.
- The initial live evaluation is retained in `initial-v1.json`: it exposed the reviewer accepting a predominantly repeated classification because one category had been added. The added-value contract and deterministic gate close that specific acceptance path.
- `scripts/weekly-sequence-generation-eval.mts` ran the synthetic ordinary brand through actual compact strategy, strategy review, schedule generation, sequence assessment and one outline repair. `ordinary-generation.json` records the result: two practical posts within the same repair subject, covering seam-adjacent condition and prioritizing multiple damage concerns, with no role quota or stronger voice.

## Limits

Semantic judgments remain model-dependent. This is bounded recent editorial memory, not a lifetime novelty index or a publication log. Posts outside the weekly-planning store are not observed. A schedule that still lacks distinct useful jobs after one repair needs a plan revision rather than an unlimited retry loop.
