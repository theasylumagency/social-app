import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { phase7aShadowInputs, fixtureConfiguration, fixtureJevInterpreter } from "../tests/fixtures/semantic-shadow"
import { semanticShadowSettings } from "../src/infrastructure/models/semantic-shadow-config"
import { createJevShadowInterpreter } from "../src/infrastructure/models/jev-semantic-shadow"
import { createShadowJsonlSink } from "../src/infrastructure/semantic-shadow/jsonl-trace-store"
import { evaluateSemanticShadow } from "../src/application/semantic-middleware/collect-shadow"
import { semanticShadowMetrics } from "../src/blueprints/social/semantic-middleware/shadow-metrics"
import type { ShadowTrace } from "../src/blueprints/social/semantic-middleware/shadow"

const live = process.argv.includes("--live")
if (process.argv.some(a => a.startsWith("--") && !["--live", "--fixtures"].includes(a))) throw Error("Use --fixtures or explicitly --live")
const settings = live ? semanticShadowSettings() : null
if (live && !settings?.enabled) throw Error("Explicit live mode requires complete enabled semantic shadow configuration; no call was made")
const config = settings?.enabled ? settings.metadata : fixtureConfiguration
const tracePath = path.resolve(".local/semantic-shadow", (live ? "manual-provider-" : "local-fixtures-") + randomUUID() + ".jsonl")
const sink = createShadowJsonlSink(tracePath), traces: ShadowTrace[] = []
for (const input of phase7aShadowInputs()) {
  const interpreter = settings?.enabled ? createJevShadowInterpreter(settings.apiKey, settings.metadata.model) : fixtureJevInterpreter(input)
  const trace = await evaluateSemanticShadow(input, { enabled: true, configuration: config, interpreter, sink,
    inputUsdPerMillion: settings?.enabled ? settings.inputUsdPerMillion : null, outputUsdPerMillion: settings?.enabled ? settings.outputUsdPerMillion : null })
  traces.push(trace)
  await sink.append(trace, new AbortController().signal)
}
const summary = { executionMode: live ? "provider" : "fixture", syntheticResponses: !live, qualityEvidence: false, productionEnvironmentChanged: false,
  tracePath, metrics: semanticShadowMetrics(traces), validation: traces.map(t => ({ sourceId: t.source.sourceId, propositionId: t.anchor?.propositionId, invocation: t.invocation, contractValidation: t.contractValidation, knownCapabilityLimits: t.knownCapabilityLimits })) }
await mkdir(path.dirname(tracePath), { recursive: true })
await writeFile(tracePath + ".summary.json", JSON.stringify(summary, null, 2) + "\n")
console.log(JSON.stringify(summary, null, 2))
if (traces.some(t => t.contractValidation.status === "structurallyInvalid" || t.invocation === "technicalFailure" || t.invocation === "timeout")) process.exitCode = 1
