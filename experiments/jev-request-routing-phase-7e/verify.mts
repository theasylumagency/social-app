import { readFile } from "node:fs/promises"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { parseEnv } from "node:util"
import { root,hash,json,save } from "./common.mjs"
import { semanticShadowSettings } from "../../src/infrastructure/models/semantic-shadow-config"
const baseline=await json("integrity/baseline.json") as {repositories:Record<string,{files:Record<string,string>;head:string}>}
const repositories={unda:root,benchmark:path.resolve(root,"../unda-semantic-benchmark")},results=[]
for(const[name,directory]of Object.entries(repositories)) {
 const before=baseline.repositories[name]!,changed=[]
 for(const[f,h]of Object.entries(before.files)){try{if(hash(await readFile(path.join(directory,f)))!==h)changed.push(f)}catch{changed.push(f)}}
 const git=(...args:string[])=>execFileSync("git",["-c","safe.directory="+directory,"-C",directory,...args],{windowsHide:true}).toString("utf8")
 const names=[...new Set(git("ls-files","--cached","--others","--exclude-standard","-z").split("\0").filter(Boolean))]
 const added=names.filter(f=>!(f in before.files)),outside=added.filter(f=>name!=="unda"||!f.startsWith("experiments/jev-request-routing-phase-7e/"))
 results.push({repository:name,originalFilesChecked:Object.keys(before.files).length,originalFileChanges:changed,headUnchanged:git("rev-parse","HEAD").trim()===before.head,newFilesOutsideScope:outside,isolatedNewFiles:added.length,createdFiles:added.sort()})
}
const frozen=[]
for(const file of ["sample.json","sample-v2.json","weekly-sample.json","weekly-sample-v2.json"]) {
 const sample=await json(file),{sampleHash,...payload}=sample
 const hashMatches=hash(JSON.stringify(payload))===sampleHash,changed=[]
 for(const[f,h]of Object.entries(sample.codeHashes as Record<string,string>))if(hash(await readFile(path.join(root,f)))!==h)changed.push(f)
 frozen.push({file,sampleHash,hashMatches,changedProtocolFiles:changed})
}
const enabled=semanticShadowSettings(parseEnv(await readFile(path.join(root,".env.local"),"utf8")),root).enabled
const passed=!enabled&&results.every(r=>!r.originalFileChanges.length&&r.headUnchanged&&!r.newFilesOutsideScope.length)&&frozen.every(f=>f.hashMatches&&!f.changedProtocolFiles.length)
await save("integrity/verification.json",{checkedAt:new Date().toISOString(),passed,productionShadowEnabled:enabled,results,frozen,
 coverage:"Original tracked/nonignored files plus environment file hashes; runtime caches and unrelated external state are not claimed immutable.",
 noProductionRouting:true,noDatabaseWritesByExperiment:true})
console.log(JSON.stringify({passed,productionShadowEnabled:enabled,results:results.map(r=>({...r,createdFiles:undefined})),frozen}));if(!passed)process.exitCode=1
