import assert from "node:assert/strict"
import { access, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { phase7aShadowInputs } from "../../tests/fixtures/semantic-shadow"
import { evaluateSemanticShadow, collectSemanticShadow } from "../../src/application/semantic-middleware/collect-shadow"
import { createJevShadowInterpreter } from "../../src/infrastructure/models/jev-semantic-shadow"
import { createShadowJsonlSink } from "../../src/infrastructure/semantic-shadow/jsonl-trace-store"
import { semanticShadowMetrics } from "../../src/blueprints/social/semantic-middleware/shadow-metrics"
import type { ShadowTrace } from "../../src/blueprints/social/semantic-middleware/shadow"
import { environment, experiment, save, sha256 } from "./common.mjs"

try { await access(path.join(experiment,"smoke/summary.json")); throw Error("SMOKE_ALREADY_RECORDED") }
catch(error){if(!error||typeof error!=="object"||!("code" in error)||error.code!=="ENOENT")throw error}
await mkdir(path.join(experiment,"smoke"),{recursive:true})
await writeFile(path.join(experiment,"smoke/run-start.json"),JSON.stringify({startedAt:new Date().toISOString(),controlledIntegrationOnly:true})+"\n",{flag:"wx",mode:0o600})
const { settings, rateSource } = await environment()
if (!settings.enabled) { await save("smoke/summary.json", { passed:false, issue:"missing-or-invalid-provider-configuration", evaluationStopped:true }, true); throw Error("SMOKE_CONFIGURATION_STOP") }
const inputs = phase7aShadowInputs().filter(i => ["exactPrice", "deniedDiscount", "unavailable"].includes(i.source.sourceId) || (i.source.sourceId === "branchPrices" && i.task?.propositionId.endsWith("p2")))
assert.equal(inputs.length,4)
const native: unknown[] = []
const captureFetch: typeof fetch = async (url, init) => {
  const response = await fetch(url, init)
  if (response.ok) {
    try { const raw = await response.clone().json(); native.push({ model:raw.model, answers:raw.answers, usage:raw.usage, httpStatus:response.status }) }
    catch { native.push({ httpStatus:response.status, nonJson:true }) }
  } else native.push({ httpStatus:response.status })
  return response
}
const interpreter = createJevShadowInterpreter(settings.apiKey, settings.metadata.model, captureFetch)
const traces: ShadowTrace[] = []
const sink = createShadowJsonlSink(path.join(experiment, "smoke/traces.jsonl"))
let issue: string | null = null
await mkdir(path.join(experiment,"smoke"),{recursive:true})
// Fail immediately on the first invalid/failed live result. No real-content evaluation follows.
for (const input of inputs) {
  const trace = await evaluateSemanticShadow(input, { enabled:true, configuration:settings.metadata, interpreter, sink, inputUsdPerMillion:settings.inputUsdPerMillion, outputUsdPerMillion:settings.outputUsdPerMillion })
  traces.push(trace); await sink.append(trace,new AbortController().signal)
  if (trace.invocation !== "returned" || trace.contractValidation.status !== "structurallyValid") { issue = trace.technicalErrors[0]?.code ?? "contractInvalid"; break }
  assert.deepEqual(trace.observation!.observation.sourceSpans,input.task!.spans)
  assert.equal(trace.observation!.observation.observationId,input.task!.observationId)
  assert.equal(trace.observation!.observation.propositionId,input.task!.propositionId)
  assert.ok(trace.decisions.every(d => typeof d.probabilityYes === "number" && d.derived === "notDerived"))
  assert.deepEqual(JSON.parse(JSON.stringify(trace)).decisions,trace.decisions)
}
let isolationVerified = false
if (!issue) {
  const input = inputs[0]!, original = sha256(JSON.stringify(input))
  for (const failure of ["exception","timeout","schema"]) {
    const result = await evaluateSemanticShadow(input,{enabled:true,configuration:{...settings.metadata,timeoutMs:20},sink,interpreter:{ async interpret() {
      if(failure==="exception")throw Error("SECRET_MUST_NOT_BE_RECORDED")
      if(failure==="timeout")return new Promise<never>(()=>{})
      return {provider:"jev",model:settings.metadata.model,probabilities:{},inputTokens:0,outputTokens:0}
    }}})
    assert.ok(result.invocation==="technicalFailure" || result.invocation==="timeout")
    assert.equal(sha256(JSON.stringify(input)),original)
    assert.ok(!JSON.stringify(result).includes("SECRET_MUST_NOT_BE_RECORDED"))
  }
  await collectSemanticShadow([input],{enabled:true,configuration:{...settings.metadata,timeoutMs:20},interpreter:{async interpret(){throw Error("isolated")}},sink:{async append(){throw Error("storage failure")}}},200)
  isolationVerified=true
}
await save("smoke/native-responses.json",native,true)
await save("smoke/summary.json",{passed:!issue,issue,completedLiveCases:traces.length,plannedLiveCases:inputs.length,authenticationVerified:!issue,batchedKeyParsingVerified:!issue,rawProbabilitySerializationVerified:!issue,applicationIdentityVerified:!issue,isolationVerified,
  configuration:settings.metadata,rateSource,metrics:semanticShadowMetrics(traces),evaluationStopped:!!issue,syntheticIsolationChecksAreNotQualityEvidence:true},true)
console.log(JSON.stringify({passed:!issue,issue,completedLiveCases:traces.length,metrics:semanticShadowMetrics(traces),evaluationStopped:!!issue}))
if(issue)process.exitCode=1
