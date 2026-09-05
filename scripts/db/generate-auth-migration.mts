import { writeFile } from "node:fs/promises"
import { Pool } from "pg"
import { getMigrations } from "better-auth/db/migration"
import { createAuth } from "../../src/lib/auth/create-auth"

// Compile only: apply the reviewed SQL with the project's normal migration runner.
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const auth = createAuth({ pool, origin: "http://localhost:3000", secret: "migration-schema-only-not-a-runtime-secret", providers: {}, sendEmail: async () => {} })
  const migration = await getMigrations(auth.options)
  const sql = await migration.compileMigrations()
  if (!sql.trim()) throw new Error("No auth schema changes to generate")
  const output = process.argv[2]
  if (!output) throw new Error("Provide the destination SQL file")
  await writeFile(output, `-- Generated from Better Auth 1.7.2; review before applying.\n${sql}\n`, { flag: "wx" })
  console.log("Auth migration written")
} finally { await pool.end() }
