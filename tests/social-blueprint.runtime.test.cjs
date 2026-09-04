const assert = require("node:assert/strict")
const test = require("node:test")

const {
  SOCIAL_BLUEPRINT,
  SOCIAL_CONTENT_MODES,
  SOCIAL_EXTRACTION_PROFILES,
  SOCIAL_GEORGIAN_CLAIM_LEXICON,
  SOCIAL_KNOWLEDGE_PATHS,
  SOCIAL_TASK_POLICIES,
  SOCIAL_TASK_TYPES,
  evaluateSocialMinimumViableBrand,
  scanGeorgianClaimSignals,
} = require("../dist/blueprints/social/index.js")

test("social blueprint registries contain unique canonical entries", () => {
  assert.equal(SOCIAL_BLUEPRINT.id, "social")
  assert.equal(SOCIAL_BLUEPRINT.version, "1")

  const paths = Object.values(SOCIAL_KNOWLEDGE_PATHS)
  assert.equal(new Set(paths).size, paths.length)
  assert.equal(SOCIAL_BLUEPRINT.knowledgePaths.length, paths.length)
  assert.equal(
    new Set(SOCIAL_BLUEPRINT.knowledgePaths.map((policy) => policy.path)).size,
    paths.length,
  )
  assert.equal(
    paths.some((path) => path.startsWith("proof.") || path.startsWith("businessFacts.")),
    false,
  )

  const taskTypes = SOCIAL_TASK_POLICIES.map((policy) => policy.taskType)
  assert.equal(new Set(taskTypes).size, taskTypes.length)
  assert.equal(taskTypes.includes(SOCIAL_TASK_TYPES.publishContent), true)
})

test("extraction profiles route by semantic domains rather than canonical paths", () => {
  assert.equal(
    new Set(SOCIAL_EXTRACTION_PROFILES.map((profile) => profile.sourceKind)).size,
    SOCIAL_EXTRACTION_PROFILES.length,
  )
  for (const profile of SOCIAL_EXTRACTION_PROFILES) {
    assert.equal("allowedPaths" in profile, false)
    assert.equal(profile.semanticDomains.length > 0, true)
    assert.equal(new Set(profile.semanticDomains).size, profile.semanticDomains.length)
  }
})

test("minimum viable brand requires offer and language but may use operator voice", () => {
  assert.deepEqual(
    evaluateSocialMinimumViableBrand({
      usablePaths: new Set([
        SOCIAL_KNOWLEDGE_PATHS.offerPrimaryServices,
        SOCIAL_KNOWLEDGE_PATHS.identityLanguages,
      ]),
    }),
    {
      usableOffer: true,
      contentLanguage: true,
      usableVoice: true,
      satisfied: true,
    },
  )

  assert.equal(
    evaluateSocialMinimumViableBrand({
      usablePaths: new Set([
        SOCIAL_KNOWLEDGE_PATHS.offerProducts,
        SOCIAL_KNOWLEDGE_PATHS.identityLanguages,
      ]),
      allowOperatorVoiceDefault: false,
    }).satisfied,
    false,
  )
})

test("social content modes keep proof-led work separate from ordinary education", () => {
  assert.notEqual(SOCIAL_CONTENT_MODES.educational, SOCIAL_CONTENT_MODES.proofLed)
  const proofPolicy = SOCIAL_BLUEPRINT.contentModePolicies.find(
    (policy) => policy.mode === SOCIAL_CONTENT_MODES.proofLed,
  )
  assert.equal(proofPolicy.risk, "high")
  assert.equal(
    proofPolicy.requirements.some(
      (requirement) => requirement.criticality === "required",
    ),
    true,
  )
})

test("Georgian claim scanner supports exact, stem, phrase, and regex rules", () => {
  assert.deepEqual(
    new Set(SOCIAL_GEORGIAN_CLAIM_LEXICON.map((rule) => rule.match)),
    new Set(["exact", "stem", "phrase", "regex"]),
  )

  const signals = scanGeorgianClaimSignals(
    "ჩვენ საუკეთესო შედეგს 100%-იანი გარანტიით, ტკივილის გარეშე გთავაზობთ.",
  )
  assert.equal(signals.some((signal) => signal.type === "social.superlative"), true)
  assert.equal(signals.some((signal) => signal.type === "social.guarantee"), true)
  assert.equal(signals.some((signal) => signal.type === "social.clinicalOutcome"), true)
  assert.equal(signals.some((signal) => signal.type === "social.numeric"), true)
})

test("price wording is low signal until a structured price assertion appears", () => {
  const informational = scanGeorgianClaimSignals("ფასების შესახებ დაგვიკავშირდით")
  assert.equal(
    informational.some(
      (signal) => signal.type === "social.price" && signal.signalStrength === "high",
    ),
    false,
  )
  assert.equal(
    informational.some(
      (signal) => signal.type === "social.price" && signal.signalStrength === "low",
    ),
    true,
  )

  const asserted = scanGeorgianClaimSignals("კონსულტაცია იწყება 99 ლარიდან")
  assert.equal(
    asserted.some(
      (signal) => signal.type === "social.price" && signal.signalStrength === "high",
    ),
    true,
  )
})

test("comparative Georgian morphology is detected", () => {
  const signals = scanGeorgianClaimSignals("ჩვენი მიდგომა კონკურენტებზე უკეთესია")
  assert.equal(signals.some((signal) => signal.type === "social.comparative"), true)
})
