import { readFile } from "node:fs/promises"
import path from "node:path"
import { root, hash, json, save, baselineEnvironment } from "./common.mjs"
import { numberCandidates, weeklyBody } from "./weekly.mjs"
const users = await json("user-inputs.json"), reference = await json("user-reference.json")
const files = ["experiments/jev-request-routing-phase-7e/weekly.mts","experiments/jev-request-routing-phase-7e/transport-v2.mts","experiments/jev-request-routing-phase-7e/router.mts",
 "experiments/jev-request-routing-phase-7e/common.mts","experiments/jev-request-routing-phase-7e/run-weekly.mts",
 "experiments/jev-request-routing-phase-7e/user-inputs.json","experiments/jev-request-routing-phase-7e/user-reference.json",
 "src/infrastructure/models/brand-reasoning.ts","src/infrastructure/models/runtime-policy.ts","src/application/contextual-notes/model.ts","src/infrastructure/postgres/contextual-notes-store.ts"]
const codeHashes = Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(path.join(root,f)))])))
const cases = users.items.map((c: {id:string;text:string},i:number)=>({...c,reference:reference.items[i],candidates:numberCandidates(c.text),body:weeklyBody(c.text),
 baselineInput:{message:c.text,context:{brandId:"isolated-phase7e",section:"week",week:"not supplied",postKey:null,channel:null,runId:null,target:null},screenData:{calendar_reference:null,baseline_counts:null},selectedTarget:null,selectedPost:null,plan:null,brand:null,strategy:null,recentConversation:[]}}))
const payload={sampleId:"unda-user-weekly-constraints-v1",createdAt:new Date().toISOString(),referenceStatus:reference.status,codeHashes,cases,runs:3,baselineRuns:1,
 baselineModel:(await baselineEnvironment()).model,
 limits:{weeklyLogicalCalls:15,baselineLogicalCalls:5},comparison:"Interpretation/preparation stage only, minimal controlled context; no plan regeneration or end-to-end user latency measured.",
 design:"Five prospective human-authored requests; references confirmed before outputs. All eleven choices declared before calls; required fields vs engineering negatives reported separately. No production thresholds.",
 missing:{actualPlan:true,baselineCounts:true,calendarReference:true,independentFinalContentQualityLabels:true}}
const sampleHash=hash(JSON.stringify(payload))
await save("weekly-sample.json",{...payload,sampleHash},true)
console.log(JSON.stringify({sampleHash,cases:5,weeklyRuns:3,baselineRuns:1,referenceStatus:reference.status}))
