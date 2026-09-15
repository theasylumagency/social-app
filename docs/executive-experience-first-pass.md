# Executive experience — first implementation

September 15, 2026

The two reframing documents were evaluated as proposals. This implements the
agreed first step: a concise executive experience over the existing operating
system. It does not adopt the documents as an unrestricted implementation mandate.

## Resulting behavior

- `/workspace` opens a current-week briefing. `/workspace/week` opens planning.
  Old `/workspace?week=YYYY-MM-DD` bookmarks redirect to the corresponding week;
  historical weeks remain read-only. Brand switching returns to the briefing.
- The briefing separates actual approval decisions from work requiring a user
  action. It projects saved strategy, plan, post-review and connection state.
  Blockers, failed work, stale foundations and missing selected-channel access
  cannot become an approval-ready message. It does not poll or start model work.
- No pending plan/content decision is a deliberately scoped statement. A read
  timestamp and the coverage limitations remain visible. Required data-read
  failures reach the existing error boundary rather than becoming an empty queue.
- Brand opens with the business summary, positioning, audience hypotheses,
  confirmation date and knowledge limitations. Optional questions and the full
  existing dossier expand on demand. Sources, quotations and history remain
  accessible. The onboarding confirmation and refinement flow is preserved.
- The weekly objective, intended audience and progress signals precede execution
  quantities. Deeper rationale and quantity controls expand on demand. Blocking
  plan concerns remain visible before the report. Existing state-changing revision,
  approval, repair and cadence operations retain their behavior.
- Results opens with the availability of saved observations and a suggested next
  analytical step. Full metric snapshots remain available, including unavailable
  versus measured-zero values. The count groups repeated snapshots by publication
  and historical provider binding; it does not total overlapping metrics.
  Manual observations, source attribution and business context remain editable.
- User-facing Operator wording becomes UNDA Social/team. Internal identifiers,
  worker names and domain boundaries retain their existing names.

## Product decisions

The default reader supervises the work rather than inspecting every artifact.
One progressively disclosed view serves that reader; separate Executive, Manager
and Full modes are not introduced. Approval and an operational follow-up remain
different kinds of attention. Prepared or approved content never implies delivery.
Results does not manufacture a learning or a strategy-change recommendation.

## Intentionally unchanged

No migrations, publication permissions, model contracts, model calls, billing
behavior, autonomous publishing, or worker topology changed. No actual publication
was requested. Existing owner and subscription checks still protect reads/writes.
This first pass does not remove review gates or change automatic content volume.

## Remaining work

1. Define an explicit publishing authority policy before changing review gates.
2. Durable delivery visibility is now implemented in the [next phase](delivery-visibility.md).
   Worker heartbeat and ingestion health remain outstanding. A stored connected
   account is not proof of current provider health; the briefing does not claim
   that the entire social operation needs no attention.
3. Support external publications end to end. The current analytics store accepts
   only observations linked to UNDA provider requests; it cannot yet reconcile
   the whole social environment or distinguish external editorial decisions.
4. Build evidence-backed interpretation and a stable observation-to-policy path.
   The Results first pass presents observations, not an implemented learning engine.
5. Extend contextual conversation across screens. Existing Brand and Week revision
   forms modify saved state; there is no new general conversation/voice interface.
6. Refresh brand sources and represent material changes explicitly. The displayed
   confirmation/read timestamps are not claims of continuous monitoring.

## Verification

- TypeScript check and production build.
- ESLint: no errors; existing unused-variable warnings remain.
- Fixture tests cover review eligibility, blockers, stale/failed/in-progress work,
  selected-channel connection requirements, revisions, preservation of Brand
  evidence, plan-before-quantity ordering, metric zero/unavailable distinction,
  and the existing post progress/repair/history interactions.
- Browser visual checks use synthetic fixtures rendered with the actual components
  and built CSS, including a 390px viewport. They do not establish authenticated
  database or provider end-to-end coverage.

Run the focused suite:

```text
node --import tsx --test tests/executive-briefing.test.mts tests/social-results-ui.test.mts tests/weekly-posts-ux.test.mts
```

The existing progress-dialog test now uses the current workspace week instead of
a hard-coded September 7 date, preserving its intended active-versus-history check.
