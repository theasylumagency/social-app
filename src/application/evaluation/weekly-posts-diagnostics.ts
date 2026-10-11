import type { PoolClient } from "pg"

/** One explicitly selected run; no prompts, copies, source material or connection details. */
export async function weeklyPostsDiagnostics(client: Pick<PoolClient, "query">, runId: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(runId)) throw Error("VALID_RUN_ID_REQUIRED")
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
  try {
    await client.query("SET LOCAL statement_timeout='10s'")
    if ((await client.query("SHOW transaction_read_only")).rows[0]?.transaction_read_only !== "on") throw Error("READ_ONLY_REQUIRED")
    const planning = await client.query(`SELECT id,to_char(week_start,'YYYY-MM-DD') AS week,version,status,step,updated_at,
      payload->'cadence' AS requested_cadence,
      CASE WHEN jsonb_typeof(payload->'directions')='array' THEN jsonb_array_length(payload->'directions') ELSE 0 END AS direction_count,
      payload ? 'publicKnowledge' AS has_public_knowledge
      FROM weekly_planning_runs WHERE id=$1`, [runId])
    const batch = await client.query(`SELECT status,step,updated_at,lease_until,
      lease_until>now() AS lease_active,
      CASE WHEN jsonb_typeof(payload->'outline'->'posts')='array' THEN jsonb_array_length(payload->'outline'->'posts') ELSE 0 END AS outline_post_count,
      CASE WHEN jsonb_typeof(payload->'copies')='object' THEN (SELECT count(*)::int FROM jsonb_object_keys(payload->'copies')) ELSE 0 END AS completed_copy_count
      FROM weekly_post_batches WHERE run_id=$1`, [runId])
    const hasTelemetry = (await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='weekly_planning_model_runs' AND column_name='telemetry'")).rowCount === 1
    const receipts = await client.query(`SELECT created_at,step,prompt_version,model,duration_ms,
      usage->'input_tokens' AS input_tokens,usage->'output_tokens' AS output_tokens,
      usage->'output_tokens_details'->'reasoning_tokens' AS reasoning_tokens,
      (SELECT jsonb_agg(left(message,600)) FROM (SELECT message FROM jsonb_array_elements_text(validation_errors) AS errors(message) LIMIT 12) limited) AS validation_errors,
      ${hasTelemetry ? "telemetry->'reasoningEffort' AS reasoning_effort,telemetry->'outcome' AS outcome,telemetry->'requestOrdinal' AS request_ordinal,telemetry->'validationAttempt' AS validation_attempt,telemetry->'responseModel' AS response_model" : "NULL AS reasoning_effort,NULL AS outcome,NULL AS request_ordinal,NULL AS validation_attempt,NULL AS response_model"}
      FROM weekly_planning_model_runs WHERE run_id=$1 AND step LIKE 'post\\_%' ESCAPE '\\' ORDER BY created_at DESC,id DESC LIMIT 21`, [runId])
    return { version: 1, capturedAt: new Date().toISOString(), runId, readOnly: true, planning: planning.rows[0] ?? null,
      posts: batch.rows[0] ?? null, attempts: receipts.rows.slice(0, 20), attemptsTruncated: receipts.rows.length > 20,
      telemetryAvailable: hasTelemetry, productionWrites: false, providerRequests: 0,
      limitation: "This is one run's stored metadata. CLI environment may differ from an already-running PM2 worker; use its timestamped startup configuration to establish active settings." }
  } finally { await client.query("ROLLBACK") }
}
