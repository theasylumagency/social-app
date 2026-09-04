import { Pool, type PoolConfig } from "pg"

export type PostgresPoolOptions = Pick<
  PoolConfig,
  "connectionString" | "max" | "connectionTimeoutMillis" | "idleTimeoutMillis"
>

export function createPostgresPool({
  connectionString,
  max = 5,
  connectionTimeoutMillis = 5_000,
  idleTimeoutMillis = 30_000,
}: PostgresPoolOptions): Pool {
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("A PostgreSQL connection string is required")
  }

  return new Pool({
    connectionString,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
  })
}
