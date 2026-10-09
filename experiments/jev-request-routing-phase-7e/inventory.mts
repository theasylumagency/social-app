import pg from "pg"
import ts from "typescript"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { environment, root, hash, save } from "./common.mjs"
const knownTexts = new Set<string>()
for (const file of ["tests/contextual-notes.test.mts", "tests/contextual-notes.live.test.mts", "tests/contextual-notes.integration.test.mts", ".local/notes-preview.mts", ".local/notes-http-check.mts"]) {
 let text: string; try { text = await readFile(path.join(root, file), "utf8") } catch { continue }
 const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
 const walk = (node: ts.Node) => { if (ts.isStringLiteralLike(node) && /[\u10a0-\u10ff]/u.test(node.text)) knownTexts.add(node.text.trim()); ts.forEachChild(node, walk) }
 walk(ast)
}
const { databaseUrl } = await environment()
if (!databaseUrl) throw Error("DATABASE_CONFIG_MISSING")
const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, max: 1 })
const client = await pool.connect()
try {
 await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
 await client.query("SET LOCAL statement_timeout = '8s'")
 const groups = (await client.query("SELECT context->>'section' AS section,input_source,status,count(*)::int AS count FROM contextual_notes GROUP BY 1,2,3 ORDER BY 1,2,3")).rows
 const rows = (await client.query("SELECT id::text,raw_text,input_source,context,status,interpretation,decision,created_at,updated_at FROM contextual_notes ORDER BY created_at,id LIMIT 100")).rows as { id: string; raw_text: string; input_source: string; context: Record<string, unknown>; status: string; interpretation: unknown; decision: unknown; created_at: Date; updated_at: Date }[]
 const runs = (await client.query("SELECT note_id::text,id::text,payload,created_at FROM contextual_note_model_runs ORDER BY created_at,id LIMIT 500")).rows as { note_id: string; id: string; payload: { step?: string; model?: string; durationMs?: number; usage?: { input_tokens?: number; output_tokens?: number }; validationErrors?: unknown[] }; created_at: Date }[]
 const sources = rows.map((r, i) => {
  const related = runs.filter(run => run.note_id === r.id), native = related.filter(run => (run.payload.usage?.input_tokens ?? 0) > 0)
  const fixtureTextMatch = knownTexts.has(r.raw_text.trim())
  const c = r.context
  const context = { section: c.section, postKey: c.postKey ?? null, channel: c.channel ?? null, runId: c.runId ?? null, postVersion: c.postVersion ?? null,
   target: c.target && typeof c.target === "object" ? { type: (c.target as Record<string, unknown>).type, id: (c.target as Record<string, unknown>).id, version: (c.target as Record<string, unknown>).version, hash: (c.target as Record<string, unknown>).hash } : null }
  return { sourceId: r.id, itemId: "N" + String(i + 1).padStart(3, "0"), sourceRevision: hash(JSON.stringify({ text: r.raw_text, context, updatedAt: r.updated_at })), createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(), text: r.raw_text, textHash: hash(r.raw_text), inputSource: r.input_source, status: r.status,
   context, provenance: { fixtureTextMatch, nativeModelRunCount: native.length, humanOriginVerified: false, classification: fixtureTextMatch ? "knownControlledTextMatch" : "storedNoteHumanOriginUnverified" },
   historical: { interpretation: r.interpretation, decision: r.decision, runs: related.map(run => ({ id: run.id, createdAt: run.created_at.toISOString(), step: run.payload.step ?? null, model: run.payload.model ?? null, durationMs: run.payload.durationMs ?? null, inputTokens: run.payload.usage?.input_tokens ?? null, outputTokens: run.payload.usage?.output_tokens ?? null, validationFailures: run.payload.validationErrors?.length ?? null })) } }
 })
 await save("source-inventory.json", { createdAt: new Date().toISOString(), readOnly: true, sourceLimit: 100, groups, storedNotes: rows.length, modelRuns: runs.length,
  knownControlledTextMatches: sources.filter(s => s.provenance.fixtureTextMatch).length, nativeProcessedNotes: sources.filter(s => s.provenance.nativeModelRunCount).length,
  humanOriginVerified: 0, sourceStatus: "Historical stored notes are not automatically treated as verified human-authored production requests; provenance needs independent confirmation." }, true)
 await save("source-candidates.json", { sourceStatus: "Minimized historical candidates, not gold; not yet evaluation sample", sources }, true)
 console.log(JSON.stringify({ storedNotes: rows.length, modelRuns: runs.length, groups, controlledMatches: sources.filter(s => s.provenance.fixtureTextMatch).length, nativeProcessed: sources.filter(s => s.provenance.nativeModelRunCount).length }))
} finally { await client.query("ROLLBACK"); client.release(); await pool.end() }
