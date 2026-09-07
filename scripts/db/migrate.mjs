import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "pg"

const connectionString = process.env.DATABASE_URL
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error("DATABASE_URL is required to run migrations")
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const migrationDirectory = join(scriptDirectory, "..", "..", "db", "migrations")
const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort()

const client = new Client({ connectionString })
await client.connect()
let applied = 0
let skipped = 0
process.stdout.write(`Found ${migrationFiles.length} migration files. Checking database…\n`)

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  for (const migrationFile of migrationFiles) {
    const existing = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [migrationFile],
    )
    if (existing.rowCount !== 0) {
      skipped++
      continue
    }

    const sql = await readFile(join(migrationDirectory, migrationFile), "utf8")
    await client.query("BEGIN")
    try {
      await client.query(sql)
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [
        migrationFile,
      ])
      await client.query("COMMIT")
      applied++
      process.stdout.write(`Applied ${migrationFile}\n`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  }
  process.stdout.write(`Migrations complete: ${applied} applied, ${skipped} already applied. Latest file: ${migrationFiles.at(-1) ?? "none"}.\n`)
} finally {
  await client.end()
}
