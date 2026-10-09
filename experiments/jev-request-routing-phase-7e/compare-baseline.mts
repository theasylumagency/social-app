import { readFile } from "node:fs/promises"
import path from "node:path"
import { json,save,hash,experiment } from "./common.mjs"
type Usage={input_tokens?:number;output_tokens?:number;input_tokens_details?:{cached_tokens?:number};output_tokens_details?:{reasoning_tokens?:number}}
type Receipt={model:string;durationMs:number;usage:Usage;validationErrors:string[]}
type Baseline={caseId:string;run:number;sampleHash:string;latencyMs:number;failure:unknown;receipts:Receipt[];result:{interpretation:unknown;diagnosticDecision:{mode:string;action:string;message:string}}|null}
type Jev={caseId:string;run:number;sampleHash:string;latencyMs:number;failure:unknown}
const readRows=async<T,>(f:string):Promise<T[]> => (await readFile(path.join(experiment,f),"utf8")).trim().split("\n").filter(Boolean).map(s=>JSON.parse(s) as T)
export function latencyStats(values:number[]) {
 if(!values.length||values.some(v=>!Number.isFinite(v)||v<0))throw Error("INVALID_LATENCY_RECEIPTS")
 const sorted=[...values].sort((a,b)=>a-b)
 return {n:values.length,min:sorted[0]!,mean:values.reduce((a,b)=>a+b,0)/values.length,p50:sorted[Math.ceil(values.length*.5)-1]!,p95:sorted[Math.ceil(values.length*.95)-1]!,max:sorted.at(-1)!,quantileMethod:"nearestRank"}
}
const sample=await json("weekly-sample.json"),sample2=await json("weekly-sample-v2.json")
const baseline=await readRows<Baseline>("results/weekly-baseline/requests.jsonl"),jev1=await readRows<Jev>("results/weekly-jev/requests.jsonl"),jev2=await readRows<Jev>("results/weekly-jev-v2/requests.jsonl")
const expectedIds=["U01","U02","U03","U04","U05"]
if(baseline.length!==5||new Set(baseline.map(b=>b.caseId)).size!==5||baseline.some(b=>!expectedIds.includes(b.caseId)||b.run!==1||b.sampleHash!==sample.sampleHash))throw Error("BASELINE_RECEIPT_SET")
if(jev1.some(r=>r.sampleHash!==sample.sampleHash)||jev2.some(r=>r.sampleHash!==sample2.sampleHash))throw Error("JEV_SAMPLE_HASH_MISMATCH")
const assessment=await json("baseline-assessment-v1.json")
function resolve(obj:unknown,p:string):unknown {
 return p.replace(/\[(\d+)\]/g,".$1").split(".").reduce<unknown>((value,key)=>value&&typeof value==="object"?(value as Record<string,unknown>)[key]:undefined,obj)
}
for(const c of assessment.cases) {
 const result=baseline.find(b=>b.caseId===c.caseId)!.result
 const validateEvidence=(e:{path:string;quote:string})=>{const v=resolve(result,e.path);if(typeof v!=="string"||!v.includes(e.quote))throw Error("ASSESSMENT_EVIDENCE_NOT_GROUNDED:"+c.caseId+":"+e.path)}
 for(const r of c.requirements)for(const e of Array.isArray(r.evidence)?r.evidence:[r.evidence])validateEvidence(e)
 if(c.contextHandling?.evidence)validateEvidence(c.contextHandling.evidence)
 if(c.extraMeaning?.evidence)validateEvidence(c.extraMeaning.evidence)
}
const receipts=baseline.flatMap(b=>b.receipts)
const byCase=expectedIds.map(id=>{
 const b=baseline.find(r=>r.caseId===id)!,j1=latencyStats(jev1.filter(r=>r.caseId===id).map(r=>r.latencyMs)),j2=latencyStats(jev2.filter(r=>r.caseId===id).map(r=>r.latencyMs))
 return {caseId:id,baselineMs:b.latencyMs,baselineRuns:1,baselineNetworkRequests:b.receipts.length,jevV1:j1,jevV2:j2,observedStageMsDifference:b.latencyMs-j2.p50,baselineDecision:b.result?.diagnosticDecision??null}
})
const result={
 status:"AuthorizedBaselineComparisonCompleted",
 authorization:await json("authorization-baseline.json"),
 referenceStatus:"Already human-confirmed meanings; engineering source review only. Independent blind final-content quality remains unmeasured.",
 hashes:{baselineSample:sample.sampleHash,jevSupplementSample:sample2.sampleHash,
  baselineResponses:hash(await readFile(path.join(experiment,"results/weekly-baseline/requests.jsonl"))),
  engineeringAssessment:hash(await readFile(path.join(experiment,"baseline-assessment-v1.json")))},
 baseline:{configuredModel:sample.baselineModel,logicalTasks:baseline.length,completeRuns:1,actualNetworkRequests:receipts.length,technicalFailures:baseline.filter(b=>b.failure!==null).length,
  validationRepairAttempts:receipts.filter(r=>r.validationErrors.length).length,extraNetworkRequests:receipts.length-baseline.length,
  latencyMs:latencyStats(baseline.map(b=>b.latencyMs)),totalRecordedStageMs:baseline.reduce((n,b)=>n+b.latencyMs,0),
  inputTokens:receipts.reduce((n,r)=>n+(r.usage.input_tokens??0),0),outputTokens:receipts.reduce((n,r)=>n+(r.usage.output_tokens??0),0),
  reasoningTokens:receipts.reduce((n,r)=>n+(r.usage.output_tokens_details?.reasoning_tokens??0),0),cachedInputTokens:receipts.reduce((n,r)=>n+(r.usage.input_tokens_details?.cached_tokens??0),0),
  nativeUsageReceipts:receipts.length,monetaryCostUsd:null,costStatus:"Native token usage available; invoice or confirmed model rate not provided. Do not invent a dollar cost."},
 jevV1:{completeRuns:3,requests:jev1.length,decisionsPerRequest:11,latencyMs:latencyStats(jev1.map(r=>r.latencyMs))},
 jevV2:{completeRuns:3,requests:jev2.length,decisionsPerRequest:12,latencyMs:latencyStats(jev2.map(r=>r.latencyMs))},
 byCase,engineeringAssessment:assessment,
 limits:["Only five distinct prospective user tasks.","Baseline has one run per case; Jev has three per protocol.","Calls were not interleaved/randomized across providers.","Identical user texts and minimal context, but closed decisions and generative interpretation have different depth/output responsibilities.","No actual plan/baseline cadence/calendar reference; clarification is not automatically a quality failure.","No planner/Safety/DB/user-facing completion latency or final plan quality was measured.","No production route or provider thresholds activated."],
 recommendation:"Disabled shadow role for channel/mode/grounded quantity/counting basis; app owns real context, arithmetic, period, fidelity checks and authority. Keep broader strategy and generation on the existing interpreter/planner.",
 productionStateChanged:false
}
await save("results/comparison-v1.json",result,true)
console.log(JSON.stringify({baseline:result.baseline,jevV1:result.jevV1,jevV2:result.jevV2,byCase:byCase.map(c=>({caseId:c.caseId,baselineMs:c.baselineMs,jevMedianMs:c.jevV2.p50})),evidenceGroundingVerified:true},null,2))
