# Brand voice fidelity

## Failure path

The live founder-post workflow uses `application/weekly-planning/posts.ts`, not the older generic content-draft evaluation adapter. Before this correction, `compileBusinessContext` reduced Discovery voice to traits and principles and discarded the source examples. `postsContext` then supplied every selected brand goal, every audience profile, the shared envelope and planning history to each Writer. The Writer also inherited managerial planning instructions. That combination allowed epistemic openness and explanatory goals to dominate rhetorical delivery. The live `post_review` call mixed safety and editorial judgment without an explicit voice assessment.

The supplied report demonstrates the distinctive identity and includes source quotations. The task quotes three flattening fragments; it does not include the complete generated Facebook post. The fixture explicitly labels this limitation and does not reconstruct a purported original post.

## Correction and contracts

- `brand-voice.ts`: optional, cited voice behaviors distinguish epistemic stance, rhetorical stance, argument structure, rhythm, explanation and prohibited flattening. New Discovery output requires an array, which may be empty. Every citation is validated against captured source text. Generation rechecks citations and preserves at most three style references. No brand-specific rules or intensity defaults are introduced.
- `post-context.ts`: a deterministic compiler selects the post's actual audience and direction. The brief owns the job. Broad goals, audience communication goals, suggested content angles, envelope rationale and history are absent from Writer context. Planned frame order remains available. Positioning and audience guidance are internal calibration; style references confer no public-fact authority. This workflow has no supplied public fact/proof registry, so those lists remain empty.
- Outline planning retains only goals selected by the approved weekly review and audiences in weekly focus. Goal keys retain their original identity.
- `post-editorial.ts`: a separate editorial call evaluates task-scoped copy using semantic bands. Material voice issues must cite exact draft text and a supplied voice expectation; every weak dimension requires actionable repair feedback. The application validates coverage and evidence references, retains the editorial assessment and consolidates its issues with safety feedback.
- `applyPostReview`: safety and editorial feedback use the existing single automatic Writer repair. Unresolved issues remain blocking in the existing approval flow. Both independent review calls run within the existing worker stage budget, and a failure cannot become a safety-only acceptance.

`src/core` and `app/` are unchanged. Provider execution remains under the worker. The separate existing direct-publishing domain gate still requires acceptable quality; founder-post publishing remains disabled.

## Compatibility

No database migration or automatic rediscovery is needed. Existing dossiers without `voice.behaviors` retain their traits, principles and verified examples; they do not acquire invented behavior dimensions. New discovery supplies the richer representation. `PostsReview.editorial` is additive and optional for historical records. Existing review issues, UI and approval consumers continue to work. Previously generated copy is not silently regenerated.

## Validation and limits

Focused deterministic tests cover distinctive and ordinary brands, legacy dossiers, source citation rejection, task relevance, Writer context, editorial evidence validation, safety/quality separation, failed editorial analysis and one consolidated repair. The Almost Another fixture uses the supplied report and explicitly labelled failure fragments. Semantic reviewer responses in these tests are test doubles, not live model evaluations.

Typecheck, domain compilation and the full Next.js production build pass. Lint passes with five pre-existing warnings in golden evaluators. The local `tsx` runner cannot read the Windows user profile in the sandbox; the same 30 focused tests pass when bundled with the installed esbuild and executed by Node inside the sandbox. Another 48 existing quality, evaluation, repair-loop and publish-eligibility runtime tests pass (78 tests total). The database-backed integration fixture was updated for the additional review call but was not executed in this run.

Live-model voice quality still requires an end-to-end sample. No claim of a measured improvement on the absent complete Facebook post is made. The correction adds one separate editorial model call per batch review, including the review after a repair.
