import { Client } from "pg"
import { readdir } from "node:fs/promises"
import path from "node:path"
import { environment, json, root, save } from "./common.mjs"
if (!(await json("smoke/summary.json")).passed) throw Error("SMOKE_GATE")
const { databaseUrl } = await environment()
if (!databaseUrl) throw Error("NO_DATABASE_CONFIGURATION")
const client = new Client({ connectionString:databaseUrl,connectionTimeoutMillis:5000,application_name:"semantic_middleware_phase7d_readonly" })
const inventory: Record<string,unknown> = {createdAt:new Date().toISOString(),queriesReadOnly:true}
try {
  await client.connect(); await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); await client.query("SET LOCAL statement_timeout=10000")
  const tables = await client.query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'weekly_%' OR table_name LIKE '%content%draft%' OR table_name LIKE '%evaluation%') ORDER BY table_name")
  inventory.tables = tables.rows.map(r=>r.table_name)
  const counts: Record<string,number> = {}
  for (const {table_name} of tables.rows) { const found = await client.query<{n:number}>('SELECT count(*)::int n FROM "'+table_name.replaceAll('"','""')+'"'); counts[table_name]=found.rows[0]!.n }
  inventory.counts=counts
  if(tables.rows.some(r=>r.table_name==="weekly_post_batches")) {
    const batches = await client.query("SELECT status,count(*)::int batches,sum((SELECT count(*) FROM jsonb_each(coalesce(payload->'copies','{}'::jsonb))))::int saved_post_copies,sum((SELECT count(*) FROM jsonb_each(coalesce(payload->'repairDrafts','{}'::jsonb))))::int repair_drafts FROM weekly_post_batches GROUP BY status ORDER BY status")
    inventory.weeklyPostAvailability=batches.rows
  }
  if(tables.rows.some(r=>r.table_name==="weekly_planning_events")) inventory.eventKinds=(await client.query("SELECT kind,count(*)::int n FROM weekly_planning_events WHERE kind LIKE '%post%' GROUP BY kind ORDER BY kind")).rows
  if(tables.rows.some(r=>r.table_name==="weekly_planning_model_runs")) inventory.modelRunSteps=(await client.query("SELECT step,count(*)::int n FROM weekly_planning_model_runs WHERE step LIKE 'post_%' GROUP BY step ORDER BY step")).rows
  await client.query("ROLLBACK")
} catch(error) {inventory.databaseFailure = {code:error && typeof error==="object" && "code" in error ? String(error.code):"connectionFailure"} }
finally {await client.end().catch(()=>{})}
const outputs: string[] = []
const scan = async (dir:string) => {for(const entry of await readdir(dir,{withFileTypes:true}).catch(()=>[])) {const file=path.join(dir,entry.name);if(entry.isDirectory())await scan(file);else if(entry.isFile()&&/\.(json|jsonl|md)$/.test(entry.name))outputs.push(path.relative(root,file).replaceAll("\\","/"))}}
await scan(path.join(root,"evals/results")); inventory.savedDevelopmentOutputs=outputs
await save(process.argv.includes("--database-online") ? "source-inventory-db.json" : "source-inventory.json",inventory,true)
console.log(JSON.stringify(inventory,null,2))
