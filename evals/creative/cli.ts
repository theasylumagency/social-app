import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { createBrandReasoner, type BrandModelRun } from "../../src/infrastructure/models/brand-reasoning"
import { creativeStageModel, postStageModel, modelFailure } from "../../src/infrastructure/models/runtime-policy"
import { creativeEvaluationCases } from "./cases"
import { PAIRWISE_PROMPT, PAIRWISE_SCHEMA, runCreativePair, repairCreativePair } from "./run"
import type { PostCopy } from "../../src/blueprints/social/weekly-planning/posts"

const arg = (name: string) => { const at = process.argv.indexOf(name); return at < 0 ? undefined : process.argv[at + 1] }
const output = path.resolve(arg("--out") ?? `.local/creative-eval/${new Date().toISOString().replaceAll(":", "-")}`)
const render = (copy: PostCopy) => copy.variants.map(v => [v.channel, v.caption, ...v.frames.map((f, i) => `კადრი ${i + 1}: ${f.heading}\n${f.body}`), v.script, ...v.onScreenText].filter(Boolean).join("\n\n")).join("\n\n")

async function main() {
  const cases = creativeEvaluationCases.filter(c => !arg("--case") || c.id === arg("--case"))
  if (!cases.length) throw Error("Unknown evaluation case")
  if (process.argv.includes("--preview")) {
    await mkdir(output, { recursive: true })
    await writeFile(path.join(output, "input-preview.json"), JSON.stringify({ destination: "https://api.openai.com/v1/responses", purpose: "Two anonymous drafts per case, creative critique and optional blind preference judgment. No publication or production database writes.", cases }, null, 2))
    console.log(`Local input preview only; no model calls: ${output}`)
    return
  }
  const audit: BrandModelRun[] = []
  const reason = (model: string) => createBrandReasoner(async run => { audit.push(run) }, { model, reasoningEffort: "low" })
  const reasons = { creative: reason(creativeStageModel("exploration")), writer: reason(postStageModel("writing")), critic: reason(creativeStageModel("critic")) }
  await mkdir(output, { recursive: true })
  try {
    for (const item of cases) {
      console.log(`Comparing ${item.id}`)
      const saved = arg("--repair-from")
      const result = saved ? await repairCreativePair(item, {
        blind: JSON.parse(await readFile(path.join(saved, `${item.id}.blind.json`), "utf8")),
        reveal: JSON.parse(await readFile(path.join(saved, `${item.id}.reveal.json`), "utf8")),
      }, reasons) : await runCreativePair(item, reasons)
      const prefix = path.join(output, item.id)
      await writeFile(`${prefix}.blind.json`, JSON.stringify(result.blind, null, 2))
      await writeFile(`${prefix}.reveal.json`, JSON.stringify(result.reveal, null, 2))
      await writeFile(`${prefix}.md`, `# ${item.id}\n\nშედარების მონახაზები — გამოქვეყნებისთვის არ შემოწმებულა.\n\nდავალება: ${result.blind.job}\n\nაუდიტორია: ${result.blind.audiences.map(a => a.situation).join("; ")}\n\n## A\n\n${render(result.blind.A)}\n\n## B\n\n${render(result.blind.B)}\n\n## არჩევანი\n\nთითოეულზე მონიშნეთ A / B / თანაბარი / არცერთი და მოკლე მიზეზი:\n\n- რომელს აქვს უფრო მკაფიო იდეა?\n- რომელია ნაკლებად შაბლონური?\n- რომელი მიიქცევდა ამ აუდიტორიის ყურადღებას?\n- რომელს აირჩევდით გამოსაქვეყნებლად?\n\nარჩევანამდე არ გახსნათ reveal ფაილი.\n`)
      if (process.argv.includes("--judge")) {
        const judge = await reason(process.env.CREATIVE_EVAL_JUDGE_MODEL?.trim() || creativeStageModel("critic"))({ step: "creative_pairwise", version: "creative-pairwise-v1", prompt: PAIRWISE_PROMPT, input: result.blind, schema: PAIRWISE_SCHEMA })
        await writeFile(`${prefix}.judge.json`, JSON.stringify(judge, null, 2))
      }
      console.log(`Saved comparison for ${item.id}`)
    }
  } finally {
    await writeFile(path.join(output, "audit.json"), JSON.stringify(audit, null, 2))
  }
  console.log(`Evaluation files: ${output}`)
}
main().catch(error => { console.error("Creative evaluation failed", modelFailure(error)); process.exitCode = 1 })
