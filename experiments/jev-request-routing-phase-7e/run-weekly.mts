import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { root, experiment, json, hash, save, environment, baselineEnvironment } from "./common.mjs"
import { nativeRequest } from "./transport-v2.mjs"
import { validateWeekly, weeklyObservation } from "./weekly.mjs"
import { RoutingProviderError } from "./router.mjs"
import { createBrandReasoner, type BrandModelRun } from "../../src/infrastructure/models/brand-reasoning"
import { INTERPRETER_PROMPT, INTERPRETATION_SCHEMA, decideNote, type Interpretation, type NoteContext } from "../../src/application/contextual-notes/model"
const mode=process.argv[2];if(!mode||!["jev","baseline"].includes(mode))throw Error("MODE_REQUIRED")
const sample=await json("weekly-sample.json"),{sampleHash,...payload}=sample
if(hash(JSON.stringify(payload))!==sampleHash)throw Error("FROZEN_SAMPLE_CHANGED")
for(const [f,h]of Object.entries(sample.codeHashes as Record<string,string>))if(hash(await readFile(path.join(root,f)))!==h)throw Error("FROZEN_PROTOCOL_CHANGED")
const {jevKey}=await environment(), {apiKey,model}=await baselineEnvironment()
if(mode==="baseline"&&model!==sample.baselineModel)throw Error("FROZEN_MODEL_CHANGED")
if(mode==="jev"&&!jevKey || mode==="baseline"&&!apiKey)throw Error("KEY_MISSING")
const prefix="results/weekly-"+mode
await mkdir(path.join(experiment,prefix),{recursive:true})
await save(prefix+"/run-start.json",{sampleHash,mode,model:mode==="jev"?sample.cases[0].body.model:model,startedAt:new Date().toISOString(),noDatabaseOrProductionWrites:true},true)
let logicalRequests=0,stop=false
const append=async(value:unknown)=>writeFile(path.join(experiment,prefix,"requests.jsonl"),JSON.stringify(value)+"\n",{flag:"a",mode:0o600})
for(let run=1;run<=(mode==="jev"?sample.runs:sample.baselineRuns);run++) {
 for(const c of sample.cases) {
  const started=performance.now();let raw:unknown=null,result:unknown=null,failure:unknown=null;const receipts:BrandModelRun[]=[]
  try {
   if(mode==="jev") {
    raw=await nativeRequest(c.body,jevKey!,AbortSignal.timeout(3000))
    const parsed=validateWeekly(raw,c.text)
    result={...parsed,observation:weeklyObservation(c.text,parsed.answers)}
   } else {
    const reason=createBrandReasoner(async r=>{receipts.push(r)},{apiKey:apiKey!,model,requestTimeoutMs:40000})
    const interpretation=await reason<Interpretation>({step:"contextual_notes",version:"contextual-notes-v1",prompt:INTERPRETER_PROMPT,schema:INTERPRETATION_SCHEMA,input:c.baselineInput,
     validate:v=>(v as Interpretation).statements.some(s=>!c.text.includes(s.quote))?["Every quote must be an exact excerpt of the current user message, not history."]:[]})
    result={interpretation,diagnosticDecision:decideNote(interpretation,c.baselineInput.context as NoteContext),productionPlanGate:"Not evaluated; no actual plan provided; no execution",qualityStatus:"Final response quality requires independent human comparison"}
   }
  } catch(e) {
   failure=e instanceof RoutingProviderError?{code:e.code,httpStatus:e.httpStatus??null}:{code:e instanceof Error && ["TimeoutError","AbortError"].includes(e.name)?"timeout":"providerException"}
   if(e instanceof RoutingProviderError&&(e.code==="schema"||e.httpStatus===401||e.httpStatus===422))stop=true
  }
  await append({sampleHash,caseId:c.id,run,mode,requestedDecisions:mode==="jev"?11:null,latencyMs:performance.now()-started,raw,result,failure,receipts,noExecution:true});logicalRequests++
  console.log(JSON.stringify({mode,caseId:c.id,run,failed:failure!==null,logicalRequests}))
  if(stop)break
 }
 if(stop)break
}
await save(prefix+"/execution.json",{sampleHash,mode,logicalRequests,stoppedForProtocolFailure:stop,completedAt:new Date().toISOString(),productionStateChanged:false},true)
if(stop)process.exitCode=1
