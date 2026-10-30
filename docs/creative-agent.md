# Creative exploration and critique

New post batches explore 4–6 creative directions before the editorial planner
prepares briefs. The planner selects a direction for each new post; the normal
Writer receives that idea alongside its existing brand, task, voice and factual
boundaries. A separate Creative Critic checks whether the mechanism survives in
each channel's caption, frames or script, considering planned visuals as plans.

## Boundaries and choices

- `src/blueprints/social/creative` owns the social contracts, minimal input
  projection, prompts, selection validation and semantic assessment vocabulary.
- `src/application/weekly-planning/creative.ts` calls the existing reasoner.
  `src/worker/weekly-posts.ts` owns execution and model configuration. No generic
  core contracts, Brand Brain mutations, new framework or database migration.
- Exploration receives only the business summary, audience names/situations and
  supported platforms. It receives no voice rules, sources, proof, envelope,
  operating rules, founder notes, strategic directions or Writer constraints.
  The projector can run immediately after discovery, without a weekly plan.
- In this first version orchestration runs just before post planning, after the
  existing weekly strategy is ready. Moving it into discovery would require a
  second job lifecycle and invalidation policy; the independent input/contract
  leaves that future move possible without coupling ideas to strategy.
- Existing strategy direction keys and new creative direction keys are separate.
  A concept's business implications never authorize facts or publication. The
  planner may adapt the manifestation; the Writer must preserve the recognizable
  idea while respecting its normal boundaries.
- The critic sees only the selected idea, actual audience, platform, copy and
  planned visual. It returns `strong`, `acceptable`, `diluted` or `lost`, a reason
  and an actionable repair direction when needed. It does not rewrite or score.

## Persistence, repairs and compatibility

An exploration has an application-generated UUID and stable local concept keys.
Its input and ideas live in the existing batch JSON, outside factual knowledge.
Selection is stored on each post. These references support future preference
learning without treating a selected idea as evidence or brand knowledge.

Exploration is checkpointed under the existing `outline` step, releasing the
claim before planning. A planner outage retries planning without regenerating
saved concepts. Each sequential call gets a fresh lease/reserve; critic, safety
and editorial review run concurrently within the existing review stage.

`diluted`/`lost` requests join the same **one automatic Writer repair** used by
the other reviews. Only affected posts are rewritten; initial drafts and repair
directions are retained. The next review evaluates the resulting copy. Unresolved
creative criticism stays advisory: subjective originality creates no new
approval blocker and no second rewrite loop. Existing factual/editorial blockers
retain their authority. A failed critic call is a retryable failed batch, never a
fabricated successful assessment.

Old batches with no selected concept keep the existing Writer/review path. Cadence
changes preserve concepts and selections on retained posts; exploration covers
both supported channels even if one is currently paused. Adding posts reuses the
saved pool. Strategy or foundation regeneration starts a new batch as before.

## Configuration and rollout

New explorations are on by default. `SOCIAL_CREATIVE_ENABLED=false` disables them
for batches without an exploration. An already saved selection continues to be
honored, including review/repair, so a toggle cannot erase a draft's intent.

`OPENAI_CREATIVE_MODEL` defaults to the configured post Writer model;
`OPENAI_CREATIVE_CRITIC_MODEL` defaults to the configured post review model.
Both use the existing structured-output adapter, low reasoning effort, bounded
timeouts/retries and model audit records. Existing model environment values are
unchanged. Expect one added exploration call per batch and one added critic call
per review pass; latency/cost depend on the configured models and repair needs.

Deploy the normal build and restart the persistent operator worker. No migration
or re-discovery is needed. Existing ready/approved content is not regenerated.

## Evaluation

`npm run test:creative` covers input isolation, selection/channel consistency,
review coverage, shared repair limits, legacy compatibility and blinding.
`npm run test:planning` includes the real worker with mocked provider responses
and an isolated PostgreSQL schema: a planner failure after exploration must
retain the same exploration UUID and must not repeat the exploration call.

`npm run eval:creative -- --preview` writes a local payload preview with no model
calls. `npm run eval:creative -- --judge` generates one paired comparison for each
of two small existing real-brand regression cases: Almost Another (Facebook) and
Total Charm Dent (Instagram). `--case <id>` runs just one; `--out <directory>`
controls the output folder. The default folder is git-ignored `.local/creative-eval`.

This is a controlled Writer-level ablation, not an end-to-end production trial:
both versions use the same Writer prompt/model/parameters, fixed brief, format
and factual authority. The treatment adds one selected concept. A separate
selection call chooses a concept that fits that fixed task. Production instead
lets the existing planner make that selection while creating the brief.

`--repair-from <previous-output-directory>` loads saved comparisons, reassesses
the candidate and exercises the shared `applyPostReview` budget with at most
one Writer repair. It preserves the original baseline and A/B labels, records
the original draft and both critiques, and writes to a new output directory.
Use this separately from the first-draft ablation: it involves extra candidate
compute. It does not regenerate exploration or the baseline to select a winner.

The case mappings reuse existing source/voice and golden test material. They are
not fresh discovery, verified audience research or current medical guidance.
Outputs are unapproved drafts; the evaluation does not publish or write to the
production database and does not run the production repair loop.

Each `.md`/`.blind.json` file randomly labels the two versions A/B. Human readers
choose which has a clearer idea, feels less generic, earns attention and would
be preferred for publication (A/B/tie/neither, with reasons). `.reveal.json`
separately records the treatment mapping, concepts and preservation assessment.
Read that file only after choosing. `--judge` adds the same blind comparison by
a model; `CREATIVE_EVAL_JUDGE_MODEL` can override the review-model default. A
model preference is diagnostic, not proof of audience performance or publishability.
No numeric creativity score or automatic quality-success threshold is used.

The initial live comparison ran on 2026-10-30 after the founder approved sending
the two fixture payloads and resulting drafts to OpenAI. Findings and limitations
are recorded in [the evaluation report](creative-evaluation.md).
