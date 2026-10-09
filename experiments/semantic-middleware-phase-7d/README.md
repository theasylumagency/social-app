# Phase 7D isolated evaluation

Run commands from the UNDA Social Operator repository root. Production shadow configuration remains disabled. These scripts never modify environment files or workflow decisions. Only `smoke.mts` and `primary.mts` contain live provider paths; Jev calls were explicitly authorized for this experiment.

## Continue the user's blind review

The user owns all real semantic labels. `review/server-address.json` records the currently running local review URL. If the process has ended, start a new local server:

```powershell
node --import tsx experiments/semantic-middleware-phase-7d/review-server.mts
```

Open the printed `http://127.0.0.1` address. Read every field in each complete post. Add grounded atomic price/discount/availability propositions, or explicitly confirm none. Record the eligibility finding, save every post, enter your reviewer identifier and confirm blind review, then submit. The server serves no provider output or existing reviewer judgments. Drafts are resumable; completed references are saved once and must not be overwritten.

This is an engineering reference, not benchmark gold. Do not expose `smoke/`, `results/` or original reviewer outcomes to the human before labels are committed. The agent must not populate the actual review reference.

After the user submits, rerun the offline analysis and report:

```powershell
node --import tsx experiments/semantic-middleware-phase-7d/analyze.mts
node --import tsx experiments/semantic-middleware-phase-7d/report.mts
node --import tsx experiments/semantic-middleware-phase-7d/verify.mts
```

Analysis before submission preserves all human-dependent metrics as pending. This frozen sample has zero invoked anchors; no-call eligibility and action analysis are implemented, while interpretation metrics remain undefined. The analyzer deliberately refuses a sample containing actual invocations. A subsequent eligible sample needs its own predeclared field evaluator, including complete consumer-required correctness; do not interpret empty records as successful classifications.

## Tests and integrity

```powershell
node --import tsx --test experiments/semantic-middleware-phase-7d/phase7d.test.mts
npm run check -- --incremental false
npm run test:semantic:shadow
node --import tsx experiments/semantic-middleware-phase-7d/verify.mts
```

`integrity/baseline.json` contains only original file SHA-256 receipts and Git heads. `verify.mts` checks all original UNDA and benchmark files, detects newly added files outside this experiment, verifies frozen sample/protocol hashes, and checks that actual production shadow configuration remains disabled. It never prints environment values or credentials.

## Provenance and reproduction

The completed execution sequence was `inventory.mts`, live `smoke.mts`, local database startup, `inventory.mts --database-online`, `source-audit.mts`, `freeze.mts`, and `primary.mts`. Source queries used read-only transactions. The initial offline source inventory is preserved along with the successful inventory. Only public Georgian copy, internal source/revision references and minimal writer/review receipts were retained.

Selection aimed at 50 natural and 25 additional targeted posts, but found only three verified unique copies. A contains two chronological current saved copies; B contains one additional historical repair draft matched by frozen lexical tags. Unverified sources and plans/reviewer scenarios were excluded. All three posts share one workflow run; this cannot estimate general real-content prevalence.

The frozen sample, prepared inputs, blind queue/template and primary raw receipts are immutable by write-once guards plus hash validation. Do not rerun `freeze.mts`, `smoke.mts` or `primary.mts` in this completed directory: the smoke guard and primary run-start receipt prevent overwriting/rerunning the same evaluation. Offline `analyze.mts`, `report.mts` and integrity verification may be rerun after actual human reference completion.

To evaluate additional verified real sources or different candidate preparation, create a new versioned experiment/sample and freeze it before provider outputs. Preserve this sample, protocol hashes and results; never edit frozen files to bypass a hash mismatch. Do not fill the real cohorts with controlled fixtures, generated text or frozen benchmark candidates. No production cutoff may be tuned from this tiny sample.

`smoke/` is controlled integration evidence. `results/primary/` is one-pass real-content evidence. `results/repeatability/` documents the empty real eligible subset. `results/analysis/` links human reference and descriptive scores. Keep these denominators separate. Pricing is a published-rate estimate, not billed account cost. No real observations means useful/total and cost/useful are undefined.
