import { Client } from "pg"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { environment,root,save } from "./common.mjs"
const {databaseUrl}=await environment()
const client=new Client({connectionString:databaseUrl,connectionTimeoutMillis:5000,application_name:"semantic_middleware_phase7d_readonly"})
const report:Record<string,unknown>={readOnly:true}
try {
 await client.connect();await client.query("BEGIN READ ONLY");await client.query("SET LOCAL statement_timeout=10000")
 report.columns=(await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_name IN ('weekly_planning_runs','weekly_post_batches','weekly_planning_model_runs','weekly_planning_events') AND table_schema='public' ORDER BY table_name,ordinal_position")).rows
 report.copies=(await client.query("SELECT r.id,r.created_at,r.updated_at,r.version,p.status,p.step,c.key AS post_key,jsonb_array_length(c.value->'variants')::int variant_count,p.payload->'review' IS NOT NULL has_consolidated_review,coalesce((SELECT jsonb_agg(jsonb_build_object('step',m.step,'promptVersion',m.prompt_version,'model',m.model,'inputTokens',m.usage->'input_tokens')) FROM weekly_planning_model_runs m WHERE m.run_id=r.id AND m.step=('post_writer_'||c.key)),'[]'::jsonb) writer_receipts FROM weekly_post_batches p JOIN weekly_planning_runs r ON r.id=p.run_id CROSS JOIN LATERAL jsonb_each(coalesce(p.payload->'copies','{}'::jsonb)) c ORDER BY r.created_at,r.id,c.key")).rows
 report.events=(await client.query("SELECT kind,jsonb_object_keys(payload) payload_key FROM weekly_planning_events WHERE kind LIKE '%post%' ORDER BY created_at")).rows
 await client.query("ROLLBACK")
} finally {await client.end()}
const offline:unknown[]=[]
for(const file of [".local/post-planner-terra.json",".local/planning-qa.json",".local/dashboard-preview.json","evals/results/weekly-sequence/ordinary-generation.json"]) {
 try {const value=JSON.parse(await readFile(path.join(root,file),"utf8"));offline.push({file,keys:Object.keys(value),payloadKeys:value.payload?Object.keys(value.payload):[],copyCount:value.copies?Object.keys(value.copies).length:0,hasCopyCaptions:JSON.stringify(value).includes('"caption"'),writerSteps:(value.modelRuns??value.runs??[]).map((r:{step?:string})=>r.step).filter((s:string)=>s?.startsWith("post_writer"))})}catch{offline.push({file,notAvailable:true})}
}
report.offline=offline
await save("source-provenance-audit.json",report,true)
console.log(JSON.stringify(report,null,2))
