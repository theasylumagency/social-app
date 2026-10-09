import assert from "node:assert/strict"
import test from "node:test"
import { optimizationGate, type OptimizationEvidence } from "../src/application/evaluation/optimization-gate"
const evidence: OptimizationEvidence = { distinctCases: 30, sameInputsAndContext: true, currentPipeline: true, sameResponsibilities: true,
  independentQualityReference: true, criticalRegressions: 0, requiredMeaningRegressions: 0, languageVoiceScoreChange: 0,
  falseBlockerRateChange: 0, firstPassAcceptanceRateChange: 0, fullTimeReduction: .2, totalCostReduction: null }

test("a faster closed-choice stage cannot establish a full workflow benefit or model quality", () => {
  const gate = optimizationGate({ ...evidence, distinctCases: 5, currentPipeline: false, sameResponsibilities: false,
    independentQualityReference: false, criticalRegressions: null, fullTimeReduction: null })
  assert.equal(gate.decision, "shadowOnly")
  for (const reason of ["insufficientDistinctCases", "historicalPipeline", "differentResponsibilities", "missingIndependentQualityReference", "criticalSafetyNotEstablished", "fullBenefitNotMeasured"]) assert.ok(gate.reasons.includes(reason))
  assert.equal(gate.automaticActivation, false)
})

test("quality regressions, missing metrics and non-finite scores block even a cheaper candidate", () => {
  assert.equal(optimizationGate(evidence).decision, "eligibleForLimitedPilotReview")
  for (const partial of [{ criticalRegressions: 1 }, { requiredMeaningRegressions: 1 }, { languageVoiceScoreChange: -.3 }, { falseBlockerRateChange: .03 },
    { firstPassAcceptanceRateChange: -.03 }, { fullTimeReduction: NaN }, { fullTimeReduction: 2 }, { languageVoiceScoreChange: 6 }, { falseBlockerRateChange: -2 }, { independentQualityReference: false }, { sameInputsAndContext: false }]) {
    assert.equal(optimizationGate({ ...evidence, ...partial }).decision, "shadowOnly")
  }
  assert.equal(optimizationGate({ ...evidence, fullTimeReduction: null, totalCostReduction: .2 }).decision, "eligibleForLimitedPilotReview")
  assert.equal(optimizationGate({ ...evidence, fullTimeReduction: null, totalCostReduction: null }).decision, "shadowOnly")
})
