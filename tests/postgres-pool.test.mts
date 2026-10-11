import assert from "node:assert/strict"
import test from "node:test"
import { createPostgresPool, postgresFailure } from "../src/infrastructure/postgres/pool"
import { postModelConfiguration } from "../src/infrastructure/models/runtime-policy"

test("an idle PostgreSQL termination is handled without logging the client or stopping the process", async () => {
  const failures: unknown[] = []
  const pool = createPostgresPool({ connectionString: "postgres://private-password@localhost/test", role: "ai", onIdleError: failure => { failures.push(failure) } })
  try {
    const error = Object.assign(Error("private database detail"), { code: "57P01", client: { password: "private-password" } })
    assert.doesNotThrow(() => pool.emit("error", error, error.client))
    assert.deepEqual(failures, [{ code: "57P01" }])
    assert.doesNotMatch(JSON.stringify(failures), /private|password|client/)
    assert.equal(pool.options.connectionTimeoutMillis, 5000)
  } finally { await pool.end() }
})

test("a failed error sink cannot make an idle pool error uncaught", async () => {
  const pool = createPostgresPool({ connectionString: "postgres://localhost/test", onIdleError: () => { throw Error("sink failed") } })
  try { assert.doesNotThrow(() => pool.emit("error", Object.assign(Error("lost"), { code: "ECONNRESET" }))) }
  finally { await pool.end() }
  assert.deepEqual(postgresFailure({ code: "secret-connection-string" }), { code: "unknown" })
})

test("startup post configuration uses specific overrides and excludes unrelated environment", () => {
  const result = postModelConfiguration({ OPENAI_PLANNING_MODEL: "gpt-6.1-sol", OPENAI_POST_PLANNER_MODEL: "gpt-5.6-terra", OPENAI_POST_WRITER_MODEL: "gpt-6.1-sol", OPENAI_POST_REVIEW_MODEL: "gpt-6.1-sol", OPENAI_POST_PLANNER_REASONING_EFFORT: "medium", OPENAI_POST_WRITER_REASONING_EFFORT: "medium", OPENAI_API_KEY: "private-api-key", DATABASE_URL: "private-database-url" })
  assert.deepEqual(result, { outline: { model: "gpt-5.6-terra", reasoningEffort: "medium" }, writing: { model: "gpt-6.1-sol", reasoningEffort: "medium" }, review: { model: "gpt-6.1-sol", reasoningEffort: "low" } })
  assert.doesNotMatch(JSON.stringify(result), /private|API_KEY|DATABASE_URL/)
})
