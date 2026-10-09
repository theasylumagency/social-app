/** A gate for admitting a candidate to a limited, separately approved pilot; never a model switch. */
export type OptimizationEvidence = {
  distinctCases: number
  sameInputsAndContext: boolean
  currentPipeline: boolean
  sameResponsibilities: boolean
  independentQualityReference: boolean
  criticalRegressions: number | null
  requiredMeaningRegressions: number | null
  languageVoiceScoreChange: number | null // fixed 1–5 rubric
  falseBlockerRateChange: number | null
  firstPassAcceptanceRateChange: number | null
  fullTimeReduction: number | null // includes queue, all attempts, fallback and persistence
  totalCostReduction: number | null // confirmed rate/invoice, all attempts and fallback
}
export const OPTIMIZATION_THRESHOLDS = { minimumDistinctCases: 30, minimumBenefit: .15, maximumVoiceLoss: .2, maximumFalseBlockerIncrease: .02, maximumFirstPassLoss: .02 } as const
export function optimizationGate(evidence: OptimizationEvidence) {
  const reasons: string[] = []
  if (!Number.isSafeInteger(evidence.distinctCases) || evidence.distinctCases < OPTIMIZATION_THRESHOLDS.minimumDistinctCases) reasons.push("insufficientDistinctCases")
  if (!evidence.sameInputsAndContext) reasons.push("differentInputsOrContext")
  if (!evidence.currentPipeline) reasons.push("historicalPipeline")
  if (!evidence.sameResponsibilities) reasons.push("differentResponsibilities")
  if (!evidence.independentQualityReference) reasons.push("missingIndependentQualityReference")
  const valid = (value: number | null): value is number => value !== null && Number.isFinite(value)
  const bounded = (value: number | null, minimum: number, maximum: number): value is number => valid(value) && value >= minimum && value <= maximum
  if (!valid(evidence.criticalRegressions) || evidence.criticalRegressions !== 0) reasons.push("criticalSafetyNotEstablished")
  if (!valid(evidence.requiredMeaningRegressions) || evidence.requiredMeaningRegressions !== 0) reasons.push("meaningFidelityNotEstablished")
  if (!bounded(evidence.languageVoiceScoreChange, -4, 4) || evidence.languageVoiceScoreChange < -OPTIMIZATION_THRESHOLDS.maximumVoiceLoss) reasons.push("languageOrVoiceNotEstablished")
  if (!bounded(evidence.falseBlockerRateChange, -1, 1) || evidence.falseBlockerRateChange > OPTIMIZATION_THRESHOLDS.maximumFalseBlockerIncrease) reasons.push("falseBlockersNotEstablished")
  if (!bounded(evidence.firstPassAcceptanceRateChange, -1, 1) || evidence.firstPassAcceptanceRateChange < -OPTIMIZATION_THRESHOLDS.maximumFirstPassLoss) reasons.push("firstPassQualityNotEstablished")
  if (!(bounded(evidence.fullTimeReduction, -Infinity, 1) && evidence.fullTimeReduction >= OPTIMIZATION_THRESHOLDS.minimumBenefit)
    && !(bounded(evidence.totalCostReduction, -Infinity, 1) && evidence.totalCostReduction >= OPTIMIZATION_THRESHOLDS.minimumBenefit)) reasons.push("fullBenefitNotMeasured")
  return { decision: reasons.length ? "shadowOnly" : "eligibleForLimitedPilotReview", reasons, thresholds: OPTIMIZATION_THRESHOLDS,
    automaticActivation: false, statisticalEquivalenceEstablished: false }
}
