import "server-only"

import type { Pool } from "pg"

import { createPostgresPool } from "../../infrastructure/postgres/pool"

const globalForDatabase = globalThis as typeof globalThis & {
  undaDatabasePool?: Pool
}

export function getDatabasePool(): Pool {
  if (globalForDatabase.undaDatabasePool !== undefined) {
    return globalForDatabase.undaDatabasePool
  }

  const connectionString = process.env.DATABASE_URL
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL is required")
  }

  const pool = createPostgresPool({ connectionString })
  if (process.env.NODE_ENV !== "production") {
    globalForDatabase.undaDatabasePool = pool
  }
  return pool
}
