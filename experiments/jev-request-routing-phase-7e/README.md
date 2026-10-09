# Isolated Jev request-routing experiment

Read COMPARISON.md, REPORT.md, results/comparison-v1.json and integrity/verification.json together. results/summary.json is the preserved pre-baseline Jev summary. This folder is not imported by production code.

References and live request bodies were frozen before their corresponding outputs. This is not a production router.

## Offline verification

From the UNDA root:

~~~powershell
node --import tsx --test experiments/jev-request-routing-phase-7e/router.test.mts experiments/jev-request-routing-phase-7e/weekly.test.mts experiments/jev-request-routing-phase-7e/weekly-v2.test.mts
npm run check -- --incremental false
npx eslint experiments/jev-request-routing-phase-7e --max-warnings 0
node --import tsx experiments/jev-request-routing-phase-7e/verify.mts
~~~

These commands make no model calls. Integrity verification refreshes only its receipt.

## Preserved artifacts and completed comparison

- sample.json / sample-v2.json: original routing protocol and transport-only rounding correction.
- weekly-sample.json / weekly-sample-v2.json: original weekly protocol and counting-basis supplement.
- results/requests.jsonl: halted attempt, including native response rejected by old validator.
- results/series-v2/requests.jsonl: primary routing runs and order controls.
- results/weekly-jev/requests.jsonl and results/weekly-jev-v2/requests.jsonl: all weekly runs.
- results/analysis.json and results/summary.json: per-field scores, errors, probability variance, stability and estimated costs; no production thresholds.
- blocked-baseline.json: historical rejection reason; authorization-baseline.json records the subsequent explicit human permission.
- results/weekly-baseline/requests.jsonl: all five authorized existing-interpreter calls, no retries/failures.
- baseline-assessment-v1.json: engineering source review against the human-confirmed meanings; not blind final-quality gold.
- results/comparison-v1.json / COMPARISON.md: latest stage-level timing comparison, evidence-grounded semantic findings and limits.
- REPORT-before-baseline.md: original report retained before updating the main report.

Live runners create write-once run-start receipts and check frozen hashes. Re-running a completed series fails before calls. New experiments need new versioned outputs and declared expectations; do not clear results to rerun.

run-weekly.mts baseline has completed under explicit human authorization. Do not rerun or remove its write-once receipts. It used five logical tasks with no retries, database operations or production actions. compare-baseline.mts verifies every engineering assessment quote against stored responses before writing a new immutable comparison. Future experiments need new versioned outputs and independent human quality review.

Environment keys are read in memory; never copied or logged. Source inventory uses a read-only transaction and minimized historical observations, excluded as natural-user gold.

Exact created-file inventory and original hashes are in the integrity receipt. Frozen benchmark data, production thresholds, Ontology v2 activation and publication decisions remain outside this experiment.
