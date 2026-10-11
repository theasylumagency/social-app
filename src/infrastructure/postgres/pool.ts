import { Pool, type PoolConfig } from "pg"

export type PostgresPoolFailure = { code: string }
export type PostgresPoolOptions = Pick<
  PoolConfig,
  "connectionString" | "max" | "connectionTimeoutMillis" | "idleTimeoutMillis"
> & { role?: "application" | "ai" | "delivery" | "analytics"; onIdleError?: (failure: PostgresPoolFailure) => void }

/** Never log a pg Error wholesale: it can carry a Client and connection details. */
export function postgresFailure(error: unknown): PostgresPoolFailure {
  const code = (error as { code?: unknown } | null)?.code
  return { code: typeof code === "string" && /^(?:[A-Z0-9]{5}|E[A-Z_]{2,40})$/.test(code) ? code : "unknown" }
}

export function createPostgresPool({
  connectionString,
  max = 5,
  connectionTimeoutMillis = 5_000,
  idleTimeoutMillis = 30_000,
  role = "application",
  onIdleError = failure => console.error("PostgreSQL idle connection lost", { at: new Date().toISOString(), role, ...failure }),
}: PostgresPoolOptions): Pool {
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("A PostgreSQL connection string is required")
  }

  const pool = new Pool({
    connectionString,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
  })
  // pg removes the failed idle client; the next query can open a new connection.
  // Active query failures still reject normally and remain the caller's responsibility.
  pool.on("error", error => {
    try { onIdleError(postgresFailure(error)) } catch { /* A log sink must not crash the process. */ }
  })
  return pool
}
