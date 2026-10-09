import { writeFile,mkdir } from "node:fs/promises"
import path from "node:path"
import { collectSemanticShadow } from "../../src/application/semantic-middleware/collect-shadow"
import type { ShadowCollectionInput } from "../../src/application/semantic-middleware/collect-shadow"
import type { ShadowTrace } from "../../src/blueprints/social/semantic-middleware/shadow"
import { createJevShadowInterpreter } from "../../src/infrastructure/models/jev-semantic-shadow"
import { semanticShadowMetrics } from "../../src/blueprints/social/semantic-middleware/shadow-metrics"
import { environment,experiment,json,save } from "./common.mjs"
import { verifyFrozen } from "./review.mjs"
const {manifest,prepared}=await verifyFrozen()
if(!(await json("smoke/summary.json")).passed)throw Error("SMOKE_GATE")
const {settings}=await environment();if(!settings.enabled||settings.metadata.configurationRef!==manifest.configuration.configurationRef)throw Error("FROZEN_CONFIGURATION_GATE")
const destination=path.join(experiment,"results/primary")
await mkdir(destination,{recursive:true})
await writeFile(path.join(destination,"run-start.json"),JSON.stringify({sampleHash:manifest.sampleHash,startedAt:new Date().toISOString(),mode:"primaryOnePass",configuration:settings.metadata})+"\n",{flag:"wx",mode:0o600})
const records:{itemId:string;cohort:"A"|"B";trace:ShadowTrace}[]=[],native:unknown[]=[]
const captureFetch:typeof fetch=async(url,init)=>{
 const response=await fetch(url,init)
 if(response.ok){try{const raw=await response.clone().json();native.push({model:typeof raw.model==="string"?raw.model:null,answers:Object.fromEntries(Object.entries(raw.answers??{}).map(([key,value])=>{const a=value as {type?:unknown;noul?:unknown};return[key,{type:typeof a?.type==="string"?a.type:null,noul:typeof a?.noul==="number"?a.noul:null}]})),usage:{input_tokens:raw.usage?.input_tokens??null,output_tokens:raw.usage?.output_tokens??null},httpStatus:response.status})}catch{native.push({httpStatus:response.status,nonJson:true})}}
 else native.push({httpStatus:response.status})
 return response
}
const interpreter=createJevShadowInterpreter(settings.apiKey,settings.metadata.model,captureFetch)
for(const item of prepared.items as {itemId:string;cohort:"A"|"B";inputs:ShadowCollectionInput[]}[]) {
 const sink={async append(trace:ShadowTrace){const record={itemId:item.itemId,cohort:item.cohort,trace};records.push(record);await writeFile(path.join(destination,"traces.jsonl"),JSON.stringify({sampleHash:manifest.sampleHash,...record})+"\n",{flag:"a",mode:0o600})}}
 await collectSemanticShadow(item.inputs,{enabled:true,configuration:settings.metadata,interpreter,sink,inputUsdPerMillion:settings.inputUsdPerMillion,outputUsdPerMillion:settings.outputUsdPerMillion},settings.budgetMs)
}
await save("results/primary/native-responses.json",native,true)
await save("results/primary/normalized-observations.json",records.filter(r=>r.trace.observation).map(r=>({itemId:r.itemId,cohort:r.cohort,sourceId:r.trace.source.sourceId,observation:r.trace.observation,contractValidation:r.trace.contractValidation})),true)
const cohortMetrics=Object.fromEntries((["A","B"]as const).map(cohort=>{
 const items=prepared.items.filter((i:{cohort:string})=>i.cohort===cohort) as {itemId:string;inputs:ShadowCollectionInput[]}[],cohortRecords=records.filter(r=>r.cohort===cohort),traces=cohortRecords.map(r=>r.trace),metrics=semanticShadowMetrics(traces)
 const eligibleItems=items.filter(i=>i.inputs.some(p=>p.task)).length,invokedItems=new Set(cohortRecords.filter(r=>r.trace.providerRequests).map(r=>r.itemId)).size
 const knownTotalCost=metrics.requestsWithUnknownCost?null:metrics.knownCostUsd
 return[cohort,{contentItems:items.length,eligibleItems,invokedItems,noCallItems:items.length-invokedItems,noPreparedTaskItems:items.length-eligibleItems,textSurfaces:items.reduce((n,i)=>n+i.inputs.length,0),traceRecords:traces.length,
  providerMetrics:metrics,technicalFailureRate:metrics.providerRequests?metrics.providerFailures/metrics.providerRequests:null,decisionsPerRequest:metrics.providerRequests?metrics.semanticDecisions/metrics.providerRequests:null,
  totalCostUsd:knownTotalCost,costPerContentItem:items.length&&knownTotalCost!==null?knownTotalCost/items.length:null,costPerEligibleItem:eligibleItems&&knownTotalCost!==null?knownTotalCost/eligibleItems:null,
  costPerUsefulObservation:null,usefulObservationMetricStatus:"pendingBlindHumanReference",qualityMetricStatus:"pendingBlindHumanReference"}]
}))
const summary={sampleId:manifest.sampleId,sampleHash:manifest.sampleHash,completedAt:new Date().toISOString(),configuration:settings.metadata,cohorts:cohortMetrics,
 requiredTextSurfaces:prepared.items.reduce((n:number,i:{inputs:unknown[]})=>n+i.inputs.length,0),recordedTextSurfaces:records.length,traceComplete:records.length===prepared.items.reduce((n:number,i:{inputs:unknown[]})=>n+i.inputs.length,0),
 primaryOnePass:true,humanReferenceUsedForSelection:false,providerOutputUsedForSelection:false,productionBehaviorChanged:false}
await save("results/primary/summary.json",summary,true)
const repeatRecords:unknown[]=[]
for(let pass=1;pass<=manifest.repeatPasses;pass++)for(const target of manifest.repeatSubset as {itemId:string;sourceId:string}[]) {
 const item=prepared.items.find((i:{itemId:string})=>i.itemId===target.itemId) as {itemId:string;cohort:string;inputs:ShadowCollectionInput[]},input=item.inputs.find(i=>i.source.sourceId===target.sourceId)!
 await collectSemanticShadow([input],{enabled:true,configuration:settings.metadata,interpreter,sink:{async append(trace){repeatRecords.push({pass,itemId:item.itemId,cohort:item.cohort,trace})}},inputUsdPerMillion:settings.inputUsdPerMillion,outputUsdPerMillion:settings.outputUsdPerMillion},settings.budgetMs)
}
await save("results/repeatability/records.json",repeatRecords,true)
await save("results/repeatability/summary.json",{sampleHash:manifest.sampleHash,plannedPasses:manifest.repeatPasses,subsetAnchors:manifest.repeatSubset.length,actualRequests:repeatRecords.length,
 status:manifest.repeatSubset.length?"recordedPendingAnalysis":"notDemonstratedNoEligibleRealAnchors",reason:manifest.repeatSubset.length?null:"The fixed real sample contains no application-prepared anchors; controlled smoke cases were not substituted.",labelFlips:null,bindingFlips:null,probabilityVariance:null},true)
console.log(JSON.stringify({sampleHash:manifest.sampleHash,cohorts:cohortMetrics,traceComplete:summary.traceComplete,repeatSubsetAnchors:manifest.repeatSubset.length}))
