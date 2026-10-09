import { readFile } from "node:fs/promises"
import path from "node:path"
import { json,save,experiment } from "./common.mjs"
// Dynamic offline diagnostics; provider outputs were validated by the frozen adapter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row=Record<string,any>
const rows=async(f:string):Promise<Row[]> => (await readFile(path.join(experiment,f),"utf8")).trim().split("\n").filter(Boolean).map(s=>JSON.parse(s))
const stats=(xs:number[])=>{const sorted=[...xs].sort((a,b)=>a-b);return{n:xs.length,min:sorted[0]??null,mean:xs.reduce((a,b)=>a+b,0)/xs.length,p50:sorted[Math.ceil(xs.length*.5)-1]??null,p95:sorted[Math.ceil(xs.length*.95)-1]??null,max:sorted.at(-1)??null}}
const first=await json("results/analysis.json"),sample=await json("weekly-sample-v2.json"),rr=await rows("results/weekly-jev-v2/requests.jsonl")
const fields:Record<string,{correct:number;total:number}>={},errors:Row[]=[],cases:Row[]=[]
for(const c of sample.cases) {
 const runRows=rr.filter(r=>r.caseId===c.id),variants:Row[]=[]
 for(const r of runRows) {
  const selected=r.result?Object.fromEntries(Object.entries(r.result.answers).map(([k,a])=>[k,(a as Row).choice])):null
  let requiredCorrect=0;const caseErrors:Row[]=[]
  for(const kind of ["required","engineeringNegatives"])for(const[k,e]of Object.entries(c.reference[kind])) {
   if(kind==="required"){fields[k]??={correct:0,total:0};fields[k].total++}
   if(selected?.[k]===e){if(kind==="required"){fields[k]!.correct++;requiredCorrect++}}else{
    const er={caseId:c.id,run:r.run,field:k,expected:e,actual:selected?.[k]??null,reference:kind,
     taxonomy:["duration","horizon","cadenceBasis","futureVideo"].includes(k)?"temporal-state error":k.endsWith("Quantity")?"entity/binding error":"family confusion",
     downstreamImpact:"Possible added/missed planning intent; diagnostic only; no execution",
     nativeConfidence:r.result?.answers[k].confidence??null,selectedProbability:r.result?.answers[k].probabilities[selected?.[k]??""]??null}
    errors.push(er);caseErrors.push(er)
   }
  }
  variants.push({run:r.run,selected,observation:r.result?.observation??null,requiredCorrect,requiredTotal:Object.keys(c.reference.required).length,requiredCompleteCorrect:requiredCorrect===Object.keys(c.reference.required).length,errors:caseErrors})
 }
 const ranges:Row[]=[]
 for(const k of Object.keys(c.body.questions))for(const o of Object.keys(c.body.questions[k].criteria)) {
  const vs=runRows.filter(r=>r.result).map(r=>r.result.answers[k].probabilities[o]);if(!vs.length)continue
  const mean=vs.reduce((a,b)=>a+b,0)/vs.length;ranges.push({key:k,option:o,min:Math.min(...vs),max:Math.max(...vs),variance:vs.reduce((a,b)=>a+(b-mean)**2,0)/vs.length})
 }
 cases.push({caseId:c.id,variants,exactChoiceStable:runRows.length===sample.runs&&new Set(variants.map(v=>JSON.stringify(v.selected))).size===1,requiredFieldsStable:new Set(variants.map(v=>JSON.stringify(Object.keys(c.reference.required).map(k=>v.selected?.[k]??null)))).size===1,maxProbabilityRange:Math.max(0,...ranges.map(v=>v.max-v.min)),probabilityVariance:ranges})
}
const usages=rr.map(r=>r.result?.usage??r.raw?.usage).filter(Boolean),inputTokens=usages.reduce((n,u)=>n+u.input_tokens,0)
const weeklyV2={sampleHash:sample.sampleHash,requestedDecisions:rr.length*12,decisionsPerRequest:12,requests:rr.length,technicalFailures:rr.filter(r=>r.failure).length,latencyMs:stats(rr.map(r=>r.latencyMs)),inputTokens,outputTokens:usages.reduce((n,u)=>n+u.output_tokens,0),estimatedCostUsd:inputTokens*.042/1e6,fields,errors,cases,
 requiredCorrectRequests:cases.flatMap(c=>c.variants).filter(v=>v.requiredCompleteCorrect).length,allTwelveCorrectRequests:cases.flatMap(c=>c.variants).filter(v=>!v.errors.length).length,
 exactChoiceStableCases:cases.filter(c=>c.exactChoiceStable).length,requiredStableCases:cases.filter(c=>c.requiredFieldsStable).length,nativeConfidence:stats(rr.filter(r=>r.result).flatMap(r=>Object.values(r.result.answers).map(a=>(a as Row).confidence)))}
const parts=[first.controlled.haltedV1,first.controlled.allMetrics,first.weekly.metrics,weeklyV2]
const total={jevRequests:parts.reduce((n,p)=>n+(p.requests??0),0),requestedSemanticDecisions:parts.reduce((n,p)=>n+(p.requestedSemanticDecisions??p.requestedDecisions??0),0),inputTokens:parts.reduce((n,p)=>n+p.inputTokens,0),outputTokens:parts.reduce((n,p)=>n+p.outputTokens,0),estimatedCostUsd:parts.reduce((n,p)=>n+p.estimatedCostUsd,0),technicalFailures:parts.reduce((n,p)=>n+p.technicalFailures,0),baselineRequests:0}
const source=await json("source-candidates.json")
const historical=source.sources.filter((s:Row)=>s.historical.modelRuns?.some((r:Row)=>r.usage?.input_tokens)).map((s:Row)=>({id:s.itemId,runs:s.historical.modelRuns}))
await save("results/summary.json",{...first,weeklyV2,total,historical,baseline:first.baseline,qualityLimitations:["Five prospective messages only; not independent content-quality gold.","No actual selected plan, baseline cadence or calendar reference.","No fresh paired existing-model call; automatic approval review blocked external export.","No end-to-end completed-plan or user-response latency measured.","Semantic basis supplement is separate and retains all prior results/errors."]},true)
console.log(JSON.stringify({weeklyV2:{...weeklyV2,cases:cases.map(c=>({caseId:c.caseId,stable:c.exactChoiceStable,requiredStable:c.requiredFieldsStable,maxProbabilityRange:c.maxProbabilityRange})),errors},total},null,2))
