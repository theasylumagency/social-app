import { readFile } from "node:fs/promises"
import path from "node:path"
import { root,hash,json,save } from "./common.mjs"
import { weeklyBodyV2 } from "./weekly-v2.mjs"
const first=await json("weekly-sample.json"),{sampleHash:previousHash,...payload}=first
if(hash(JSON.stringify(payload))!==previousHash)throw Error("ORIGINAL_SAMPLE_CHANGED")
for(const [f,h]of Object.entries(first.codeHashes as Record<string,string>))if(hash(await readFile(path.join(root,f)))!==h)throw Error("ORIGINAL_PROTOCOL_CHANGED")
const basis=["currentWeekTotal","notSpecified","perWeekAcrossRange","notSpecified","currentWeekTotal"]
const revised={...payload,sampleId:"unda-user-weekly-constraints-v2",createdAt:new Date().toISOString(),previousSampleHash:previousHash,
 supplementReason:"Frozen v1 did not encode the per-week vs aggregate counting basis confirmed for U03. Add one missing semantic axis. Every v1 question/reference and every observed error remains preserved; this is not prompt tuning to fix observed errors.",
 cases:first.cases.map((c:{text:string;reference:{required:Record<string,string>;engineeringNegatives:Record<string,string>};body:unknown},i:number)=>({...c,reference:{...c.reference,
  ...(i===1||i===3?{engineeringNegatives:{...c.reference.engineeringNegatives,cadenceBasis:basis[i]}}:{required:{...c.reference.required,cadenceBasis:basis[i]}})},body:weeklyBodyV2(c.text)})),
 codeHashes:{...first.codeHashes,...Object.fromEntries(await Promise.all(["weekly-v2.mts","run-weekly-v2.mts"].map(async f=>{const relative="experiments/jev-request-routing-phase-7e/"+f;return[relative,hash(await readFile(path.join(root,relative)))]})))},
 limits:{weeklyLogicalCalls:15,baselineLogicalCalls:0},baselineRuns:0}
const sampleHash=hash(JSON.stringify(revised));await save("weekly-sample-v2.json",{...revised,sampleHash},true)
console.log(JSON.stringify({sampleHash,previousHash,decisionsPerRequest:12,cases:5,runs:3}))
