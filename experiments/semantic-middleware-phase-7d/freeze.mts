import { Client } from "pg"
import { readFile } from "node:fs/promises"
import path from "node:path"
import type { PostCopy, PostsReview } from "../../src/blueprints/social/weekly-planning/posts"
import { environment, json, root, save, sha256 } from "./common.mjs"
import { SELECTION_VERSION,selectSample,sampleInputs,type SourceItem } from "./sample.mjs"
if(!(await json("smoke/summary.json")).passed)throw Error("SMOKE_GATE")
const {databaseUrl,settings,rateSource}=await environment()
if(!settings.enabled)throw Error("CONFIGURATION_GATE")
const client=new Client({connectionString:databaseUrl,connectionTimeoutMillis:5000,application_name:"semantic_middleware_phase7d_readonly"})
const items:SourceItem[]=[]
let rawCount=0,unverifiedCount=0
try {
 await client.connect();await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await client.query("SET LOCAL statement_timeout=10000")
 const rows=await client.query<{run_id:string;post_key:string;copy:PostCopy;source_kind:"savedCopy"|"repairDraft";created_at:Date;updated_at:Date;review:PostsReview|null;service_names:string[];writer_receipts:SourceItem["writerReceipts"]}>(`
  SELECT r.id run_id,c.key post_key,c.value copy,c.source_kind,r.created_at,p.updated_at,p.payload->'review' review,
   coalesce((SELECT jsonb_agg(o->>'name') FROM jsonb_array_elements(coalesce(r.payload#>'{basis,payload,understanding,offers}','[]'::jsonb)) o),'[]'::jsonb) service_names,
   coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'step',m.step,'promptVersion',m.prompt_version,'model',m.model,'createdAt',m.created_at,'inputHash',m.input_hash)) FROM weekly_planning_model_runs m
    WHERE m.run_id=r.id AND m.step=('post_writer_'||c.key) AND m.model NOT ILIKE '%mock%' AND coalesce((m.usage->>'input_tokens')::bigint,0)>0),'[]'::jsonb) writer_receipts
  FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id
  CROSS JOIN LATERAL (SELECT key,value,'savedCopy' source_kind FROM jsonb_each(coalesce(p.payload->'copies','{}'::jsonb))
   UNION ALL SELECT key,value,'repairDraft' source_kind FROM jsonb_each(coalesce(p.payload->'repairDrafts','{}'::jsonb))) c
  ORDER BY r.created_at,r.id,c.key,c.source_kind`)
 rawCount=rows.rowCount??0
 for(const row of rows.rows) {
  if(!row.writer_receipts.length){unverifiedCount++;continue}
  if(!row.copy||!Array.isArray(row.copy.variants)||!row.copy.variants.length)continue
  const copy:PostCopy={variants:row.copy.variants.map(v=>({channel:v.channel,caption:v.caption,script:v.script,frames:v.frames.map(f=>({heading:f.heading,body:f.body})),onScreenText:v.onScreenText}))}
  items.push({sourceId:"weekly_post_batches:"+row.run_id+"/"+row.source_kind+"/"+row.post_key,sourceRevision:sha256(JSON.stringify(copy)),createdAt:row.created_at.toISOString(),sourceKind:row.source_kind,
   runId:row.run_id,postKey:row.post_key,copy,serviceMentions:row.service_names.filter(s=>typeof s==="string"),writerReceipts:row.writer_receipts,review:row.review&&typeof row.review.summary==="string"&&Array.isArray(row.review.issues)?row.review:null})
 }
 await client.query("ROLLBACK")
} finally{await client.end()}
const selected=selectSample(items),frozenInputs=selected.items.map(item=>({itemId:item.itemId,cohort:item.cohort,inputs:sampleInputs(item)}))
const createdAt=new Date().toISOString(),sampleId="unda-semantic-phase7d-real-v1"
const repeatCandidates=frozenInputs.flatMap(item=>item.inputs.filter(i=>i.task).map(input=>({itemId:item.itemId,cohort:item.cohort,sourceId:input.source.sourceId,propositionId:input.task!.propositionId,tags:selected.items.find(i=>i.itemId===item.itemId)!.selectionTags})))
const repeatSubset:typeof repeatCandidates=[]
for(const tag of ["easyPositive","negative","negation","temporal","branch","contrastOrEllipsis"]) {
 const pick=repeatCandidates.find(c=>!repeatSubset.some(r=>r.sourceId===c.sourceId)&&(tag==="easyPositive"||c.tags.includes(tag)))
 if(pick)repeatSubset.push(pick)
}
const codeFiles=["src/infrastructure/models/jev-semantic-shadow.ts","src/infrastructure/models/semantic-shadow-config.ts","src/application/semantic-middleware/collect-shadow.ts","src/application/semantic-middleware/adapt-shadow.ts","src/blueprints/social/semantic-middleware/shadow.ts","src/blueprints/social/semantic-middleware/shadow-task.ts","src/blueprints/social/semantic-middleware/check-contract.ts","src/blueprints/social/semantic-middleware/profile.ts","experiments/semantic-middleware-phase-7d/sample.mts"]
const codeHashes:Record<string,string>={};for(const file of codeFiles)codeHashes[file]=sha256(await readFile(path.join(root,file)))
const selection={version:SELECTION_VERSION,cohortA:"First 50 unique saved complete Georgian post copies ordered by run creation time then immutable internal source ID; no signal filtering. Require a matching non-mock writer run with nonzero native input usage.",
 cohortB:"First 25 additional unique real historical repair/development copies matching the fixed textual signal/negation/time/branch/contrast rules, in the same chronological order; disjoint from A. No synthetic quota filling.",deduplication:"Exact public textual surfaces, channel and surface order; first source wins.",
 requested:{A:50,B:25},available:{rawSavedAndRepairCopies:rawCount,excludedUnverifiedWriterProvenance:unverifiedCount,verifiedSources:selected.eligibleSourcePool,uniqueContent:selected.uniqueContentPool},
 sourceLimitations:["Only the configured local UNDA database was available as a verifiable complete-post source.","Archived sequence evaluations contain reviewer scenarios/plans, not verifiable new complete writer output, and were excluded.","Original independent Safety output is not persisted separately; consolidated per-post review is linked where available."],noProviderOutputUsedForSelection:true}
const sampleHash=sha256(JSON.stringify({sampleId,version:1,createdAt,selection,items:selected.items,configuration:settings.metadata,codeHashes,repeatSubset,repeatPasses:3,frozenInputs}))
await save("sample.json",{sampleId,version:1,sampleHash,items:selected.items},true)
await save("prepared-tasks.json",{sampleHash,items:frozenInputs},true)
await save("sample-manifest.json",{sampleId,version:1,createdAt,sampleHash,selection,configuration:settings.metadata,rateSource,codeHashes,repeatSubset,repeatPasses:3,
 cohorts:{A:selected.items.filter(i=>i.cohort==="A").length,B:selected.items.filter(i=>i.cohort==="B").length},items:selected.items.map(i=>({itemId:i.itemId,cohort:i.cohort,sourceId:i.sourceId,sourceRevision:i.sourceRevision,contentHash:i.contentHash,selectionTags:i.selectionTags,texts:i.surfaces.map(s=>({surface:s.surface,channel:s.channel,textHash:s.textHash}))})),
 hashPayload:{sampleId,version:1,createdAt,selection,configuration:settings.metadata,codeHashes,repeatSubset,repeatPasses:3}},true)
const queue={referenceStatus:"Phase 7D engineering reference; not benchmark gold",sampleId,sampleHash,items:selected.items.map(i=>({itemId:i.itemId,cohort:i.cohort,surfaces:i.surfaces.map(s=>({sourceId:i.sourceId+"/"+s.channel+"/"+s.surface,surface:s.surface,channel:s.channel,text:s.text,textHash:s.textHash,
   preparedAnchor:frozenInputs.find(p=>p.itemId===i.itemId)!.inputs.find(p=>p.source.sourceId===i.sourceId+"/"+s.channel+"/"+s.surface)?.task?.spans[0]?.excerpt??null}))}))}
await save("review/queue.json",queue,true)
await save("review/reference-template.json",{sampleId,sampleHash,referenceStatus:queue.referenceStatus,reviewer:null,completedAt:null,blindAttestation:false,items:queue.items.map(i=>({itemId:i.itemId,reviewed:false,propositions:[],notes:""}))},true)
await save("frozen-files.json",Object.fromEntries(await Promise.all(["sample.json","prepared-tasks.json","sample-manifest.json","review/queue.json"].map(async file=>[file,sha256(await readFile(path.join(root,"experiments/semantic-middleware-phase-7d",file)))]))),true)
console.log(JSON.stringify({sampleId,sampleHash,cohorts:{A:queue.items.filter(i=>i.cohort==="A").length,B:queue.items.filter(i=>i.cohort==="B").length},sourceAvailability:selection.available,eligibleAnchors:repeatCandidates.length,repeatSubset:repeatSubset.length,reviewItems:queue.items.length}))
