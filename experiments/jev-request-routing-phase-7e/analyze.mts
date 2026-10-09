import { readFile } from "node:fs/promises"
import path from "node:path"
import { json, save, experiment } from "./common.mjs"
import type { ProbeCase } from "./cases.mjs"
// Dynamic offline report records only. Runtime provider responses are validated by the frozen adapters.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const rows = async (f:string):Promise<Row[]> => (await readFile(path.join(experiment,f),"utf8")).trim().split("\n").filter(Boolean).map(s=>JSON.parse(s))
const quantile=(xs:number[],p:number)=>[...xs].sort((a,b)=>a-b)[Math.max(0,Math.ceil(xs.length*p)-1)]??null
const stats=(xs:number[])=>({n:xs.length,min:xs.length?Math.min(...xs):null,mean:xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null,p50:quantile(xs,.5),p95:quantile(xs,.95),max:xs.length?Math.max(...xs):null})
function metrics(rr:Row[],decisions:number) {
 const usages=rr.map(r=>r.result?.usage??r.raw?.usage??r.native?.usage).filter(Boolean)
 const input=usages.reduce((n,u)=>n+u.input_tokens,0),output=usages.reduce((n,u)=>n+u.output_tokens,0)
 return {requests:rr.length,requestedSemanticDecisions:rr.length*decisions,decisionsPerRequest:decisions,technicalFailures:rr.filter(r=>r.failure).length,technicalFailureRate:rr.length?rr.filter(r=>r.failure).length/rr.length:0,
  latencyMs:stats(rr.map(r=>r.latencyMs)),inputTokens:input,outputTokens:output,nativeUsageReceipts:usages.length,estimatedCostUsd:input*.042/1e6,
  costStatus:"Published input rate estimate at $0.042 per million; not invoice/billed amount",quantile:"nearest rank; tiny-sample p95 is descriptive"}
}
const controlledSample=await json("sample-v2.json"), all=await rows("results/series-v2/requests.jsonl"), primary=all.filter(r=>!r.orderAudit), audit=all.filter(r=>r.orderAudit)
const errors:Row[]=[], fields:Record<string,{correct:number;total:number}>={}
const tax=(c:ProbeCase,field:string) => field==="scope"?"entity/binding error":field==="extraMeaning"||c.tags.some(t=>["localAndDurable","editAndQuestion","objectionAndPolicy","accountDelete"].includes(t))?"proposition-boundary dependency":c.tags.some(t=>["negatedAlternative","negation","აღარ","preservationConstraint"].includes(t))?"negation/polarity scope":c.tags.includes("implicitEdit")?"implicit-semantics miss":c.tags.some(t=>["embeddedInstruction","publicationAuthority","questionVsCommand","questionNegativeControl"].includes(t))?"attribution/presentation":"family confusion"
const byCase:Row[]=[], stability:Row[]=[]
for(const c of controlledSample.cases as ProbeCase[]) {
 const rr=primary.filter(r=>r.caseId===c.id), failures=rr.filter(r=>r.failure)
 const ce:Row[]=[]
 for(const r of rr) {
  if(!r.result){errors.push({caseId:c.id,run:r.run,field:"transport",failure:r.failure,taxonomy:"provider/transport/schema failure"});continue}
  const got={operation:r.result.answers.operation.choice,scope:r.result.answers.scope.choice,standaloneEdit:r.result.answers.standaloneEdit.noul>.5,extraMeaning:r.result.answers.extraMeaning.noul>.5,candidate:r.diagnostic.route==="candidateSelectedPostEdit"}
  const expected={operation:c.expected.operations,scope:c.expected.scopes,standaloneEdit:c.expected.standaloneEdit,extraMeaning:c.expected.extraMeaning,candidate:c.expected.candidate}
  for(const [f,e]of Object.entries(expected)) {
   if(e===undefined)continue
   const actual=got[f as keyof typeof got],correct=Array.isArray(e)?e.includes(actual as never):actual===e
   fields[f]??={correct:0,total:0};fields[f].total++;if(correct)fields[f].correct++
   else{const er={caseId:c.id,run:r.run,field:f,expected:e,actual,taxonomy:tax(c,f),tags:c.tags,
    downstreamImpact:f==="candidate"?(actual?"potentialIncorrectPilotRoute":"existingInterpreterFallback; latency benefit lost"):"Diagnostic semantic error; evaluate combined route separately"};ce.push(er);errors.push(er)}
  }
 }
 const results=rr.filter(r=>r.result)
 const labels=(r:Row)=>({operation:r.result.answers.operation.choice,scope:r.result.answers.scope.choice,standaloneEdit:r.result.answers.standaloneEdit.noul>.5,extraMeaning:r.result.answers.extraMeaning.noul>.5,route:r.diagnostic.route})
 const unique=new Set(results.map(r=>JSON.stringify(labels(r)))).size
 const variance:Row[]=[]
 for(const f of ["operation","scope","standaloneEdit","extraMeaning"]) {
  const options=f==="operation"||f==="scope"?Object.keys(results[0]?.result.answers[f].probabilities??{}):["noul"]
  for(const o of options){const vs=results.map(r=>o==="noul"?r.result.answers[f].noul:r.result.answers[f].probabilities[o]);if(!vs.length)continue;const mean=vs.reduce((n,p)=>n+p,0)/vs.length;variance.push({field:f,option:o,min:Math.min(...vs),max:Math.max(...vs),variance:vs.reduce((n,p)=>n+(p-mean)**2,0)/vs.length})}
 }
 byCase.push({caseId:c.id,text:c.input.text,errors:ce,firstDecisions:results[0]?labels(results[0]):null,expected:c.expected,tags:c.tags})
 stability.push({caseId:c.id,successfulRuns:results.length,technicalFailures:failures.length,exactDecisionStable:results.length===controlledSample.runs&&unique===1,uniqueDecisionVectors:unique,maxProbabilityRange:Math.max(0,...variance.map(v=>v.max-v.min)),probabilityVariance:variance})
}
const orderAudit=audit.map(r=>{const first=primary.find(p=>p.caseId===r.caseId&&p.run===1);const get=(v:Row)=>v.result?{operation:v.result.answers.operation.choice,scope:v.result.answers.scope.choice,standaloneEdit:v.result.answers.standaloneEdit.noul,extraMeaning:v.result.answers.extraMeaning.noul,route:v.diagnostic.route}:null;return{caseId:r.caseId,first:get(first!),reversed:get(r),sameChoiceLabels:!!first?.result&&!!r.result&&first.result.answers.operation.choice===r.result.answers.operation.choice&&first.result.answers.scope.choice===r.result.answers.scope.choice,sameDiagnosticRoute:first?.diagnostic.route===r.diagnostic.route}})
const v1=await rows("results/requests.jsonl")
const controlled={sampleHash:controlledSample.sampleHash,referenceStatus:controlledSample.referenceStatus??"Engineering expectations, not reviewed human gold",runs:3,primary:metrics(primary,4),orderAuditMetrics:metrics(audit,4),allMetrics:metrics(all,4),haltedV1:metrics(v1,4),
 fields,byCase,errors,stability,orderAudit,exactDecisionStableCases:stability.filter(s=>s.exactDecisionStable).length,
 falseCandidateRoutes:primary.filter(r=>r.diagnostic.route==="candidateSelectedPostEdit"&&!controlledSample.cases.find((c:ProbeCase)=>c.id===r.caseId).expected.candidate).map(r=>({caseId:r.caseId,run:r.run})),
 missedPilotCandidates:primary.filter(r=>r.diagnostic.route!=="candidateSelectedPostEdit"&&controlledSample.cases.find((c:ProbeCase)=>c.id===r.caseId).expected.candidate).map(r=>({caseId:r.caseId,run:r.run})),
 nativeConfidence:stats(primary.filter(r=>r.result).flatMap(r=>[r.result.answers.operation.confidence,r.result.answers.scope.confidence])),
 noulProbability:stats(primary.filter(r=>r.result).flatMap(r=>[r.result.answers.standaloneEdit.noul,r.result.answers.extraMeaning.noul])),
 contradictionCount:primary.filter(r=>r.result&&["shorten","moreFormal","lessFormal","removeEmoji"].includes(r.result.answers.operation.choice)&&r.result.answers.scope.choice==="selectedPost"&&r.result.answers.standaloneEdit.noul<=.5).length,
 semanticQuestionNote:"Contradiction is a diagnostic tension between local operation/scope and standaloneEdit; keyed questions are not jointly calibrated. 0.5 is descriptive only, not production threshold."}
const ws=await json("weekly-sample.json"),wr=await rows("results/weekly-jev/requests.jsonl"),wfields:Record<string,{correct:number;total:number}>={},werrors:Row[]=[],wb:Row[]=[]
for(const c of ws.cases) {
 const rr=wr.filter(r=>r.caseId===c.id), variants:Row[]=[]
 for(const r of rr) {
  const selected=r.result?Object.fromEntries(Object.entries(r.result.answers).map(([k,v])=>[k,(v as Row).choice])):null
  let correct=0
  for(const[k,e]of Object.entries(c.reference.required)){wfields[k]??={correct:0,total:0};wfields[k].total++;if(selected?.[k]===e){wfields[k].correct++;correct++}else werrors.push({caseId:c.id,run:r.run,field:k,expected:e,actual:selected?.[k]??null,status:"humanConfirmedReference",taxonomy:k.endsWith("Quantity")?"entity/binding error":["horizon","duration","futureVideo"].includes(k)?"temporal-state error":"family confusion",downstreamImpact:"Potential wrong planning constraint; no execution exists"})}
  const negativeErrors=Object.entries(c.reference.engineeringNegatives).filter(([k,e])=>selected?.[k]!==e).map(([k,e])=>({caseId:c.id,run:r.run,field:k,expected:e,actual:selected?.[k]??null,status:"engineeringNegativeControl",taxonomy:["horizon","duration","futureVideo"].includes(k)?"temporal-state error":"family confusion",downstreamImpact:"Potential added/missed planning meaning; no execution exists"}))
  werrors.push(...negativeErrors)
  variants.push({run:r.run,selected,requiredCorrect:correct,requiredTotal:Object.keys(c.reference.required).length,requiredCompleteCorrect:correct===Object.keys(c.reference.required).length,engineeringNegativeErrors:negativeErrors,observation:r.result?.observation??null})
 }
 const successful=rr.filter(r=>r.result),ranges:Row[]=[]
 for(const key of Object.keys(c.body.questions))for(const opt of Object.keys(c.body.questions[key].criteria)){const vals=successful.map(r=>r.result.answers[key].probabilities[opt]);if(!vals.length)continue;const mean=vals.reduce((n,p)=>n+p,0)/vals.length;ranges.push({key,opt,min:Math.min(...vals),max:Math.max(...vals),variance:vals.reduce((n,p)=>n+(p-mean)**2,0)/vals.length})}
 wb.push({caseId:c.id,text:c.text,candidates:c.candidates,variants,exactChoiceStable:successful.length===ws.runs&&new Set(variants.map(r=>JSON.stringify(r.selected))).size===1,maxProbabilityRange:Math.max(0,...ranges.map(v=>v.max-v.min)),probabilityVariance:ranges})
}
const weekly={sampleHash:ws.sampleHash,status:ws.referenceStatus,metrics:metrics(wr,11),requiredFields:wfields,byCase:wb,errors:werrors,requiredCompleteCorrectRequests:wb.flatMap(c=>c.variants).filter(v=>v.requiredCompleteCorrect).length,allElevenCorrectRequests:wb.flatMap(c=>c.variants).filter(v=>v.requiredCompleteCorrect&&!v.engineeringNegativeErrors.length).length,exactChoiceStableCases:wb.filter(c=>c.exactChoiceStable).length,consistencyIssues:wr.flatMap(r=>r.result?.observation.consistencyIssues??[]),nativeConfidence:stats(wr.filter(r=>r.result).flatMap(r=>Object.values(r.result.answers).map(v=>(v as Row).confidence)))}
let baseline:Row={status:"notRunAutomaticApprovalRejection",actualFreshRequests:0,costUsd:0,pairedLatencyComparisonAvailable:false}
try {
 const br=await rows("results/weekly-baseline/requests.jsonl")
 baseline={status:"run",logicalRequests:br.length,actualNetworkRequests:br.reduce((n,r)=>n+r.receipts.length,0),latencyMs:stats(br.map(r=>r.latencyMs)),failures:br.filter(r=>r.failure).length,receipts:br.flatMap(r=>r.receipts),finalContentQuality:"unreviewed"}
}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e}
await save("results/analysis.json",{createdAt:new Date().toISOString(),controlled,weekly,baseline},true)
console.log(JSON.stringify({controlled:{fields,stable:controlled.exactDecisionStableCases,falseCandidates:controlled.falseCandidateRoutes,missedCandidates:controlled.missedPilotCandidates,contradictions:controlled.contradictionCount,metrics:controlled.allMetrics,errorsByCase:byCase.filter(c=>c.errors.length).map(c=>({id:c.caseId,errors:c.errors.filter((e:Row)=>e.run===1)})),orderAudit},weekly:{metrics:weekly.metrics,fields:wfields,completeRequired:weekly.requiredCompleteCorrectRequests,allEleven:weekly.allElevenCorrectRequests,stable:weekly.exactChoiceStableCases,errors:werrors},baseline},null,2))
