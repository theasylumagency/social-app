import { readFile,writeFile,mkdir } from "node:fs/promises"
import path from "node:path"
import { root,experiment,json,hash,save,environment } from "./common.mjs"
import { nativeRequest } from "./transport-v2.mjs"
import { validateWeeklyV2 } from "./weekly-v2.mjs"
import { RoutingProviderError } from "./router.mjs"
const sample=await json("weekly-sample-v2.json"),{sampleHash,...payload}=sample
if(hash(JSON.stringify(payload))!==sampleHash)throw Error("FROZEN_SAMPLE_CHANGED")
for(const [f,h]of Object.entries(sample.codeHashes as Record<string,string>))if(hash(await readFile(path.join(root,f)))!==h)throw Error("FROZEN_PROTOCOL_CHANGED")
const {jevKey}=await environment();if(!jevKey)throw Error("KEY_MISSING")
const prefix="results/weekly-jev-v2";await mkdir(path.join(experiment,prefix),{recursive:true})
await save(prefix+"/run-start.json",{sampleHash,startedAt:new Date().toISOString(),maxRequests:15,noProductionWrites:true},true)
let count=0,stop=false
for(let run=1;run<=sample.runs;run++) {
 for(const c of sample.cases) {
  let raw:unknown=null,result:unknown=null,failure:unknown=null;const start=performance.now()
  try{raw=await nativeRequest(c.body,jevKey,AbortSignal.timeout(3000));result=validateWeeklyV2(raw,c.text)}
  catch(e){failure=e instanceof RoutingProviderError?{code:e.code,httpStatus:e.httpStatus??null}:{code:e instanceof Error&&["TimeoutError","AbortError"].includes(e.name)?"timeout":"providerException"};if(e instanceof RoutingProviderError&&(e.code==="schema"||e.httpStatus===401||e.httpStatus===422))stop=true}
  await writeFile(path.join(experiment,prefix,"requests.jsonl"),JSON.stringify({sampleHash,caseId:c.id,run,requestedDecisions:12,latencyMs:performance.now()-start,raw,result,failure,noExecution:true})+"\n",{flag:"a",mode:0o600});count++
  if(stop)break
 }
 console.log(JSON.stringify({completedPass:stop?null:run,requests:count}));if(stop)break
}
await save(prefix+"/execution.json",{sampleHash,requests:count,stoppedForProtocolFailure:stop,completedAt:new Date().toISOString(),productionStateChanged:false},true)
if(stop)process.exitCode=1
