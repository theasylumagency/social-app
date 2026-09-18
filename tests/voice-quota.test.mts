import assert from "node:assert/strict"
import test from "node:test"
import type { Pool } from "pg"
import { reserveVoiceRequest } from "../src/infrastructure/postgres/contextual-notes-store"

class VoiceRequestPool {
  readonly rows: { ownerId: string; sessionId: string }[] = []
  async connect() {
    return {
      release() {},
      query: async (sql: string, values: unknown[] = []) => {
        if (sql.startsWith("SELECT 1 FROM contextual_voice_requests")) {
          const [ownerId, sessionId] = values as [string, string]
          return { rowCount: this.rows.some(row => row.ownerId === ownerId && row.sessionId === sessionId) ? 1 : 0, rows: [] }
        }
        if (sql.startsWith("SELECT count(*)")) {
          const [ownerId] = values as [string]
          return { rowCount: 1, rows: [{ n: this.rows.filter(row => row.ownerId === ownerId).length }] }
        }
        if (sql.startsWith("INSERT INTO contextual_voice_requests")) {
          const [ownerId, sessionId] = values as [string, string]
          this.rows.push({ ownerId, sessionId })
        }
        return { rowCount: 0, rows: [] }
      },
    }
  }
}

test("voice quota reserves once per owner/session and separately for a new session", async () => {
  const fake = new VoiceRequestPool()
  const pool = fake as unknown as Pool
  await reserveVoiceRequest(pool, "owner-1", "session-1")
  await reserveVoiceRequest(pool, "owner-1", "session-1")
  await reserveVoiceRequest(pool, "owner-1", "session-2")
  assert.deepEqual(fake.rows, [{ ownerId: "owner-1", sessionId: "session-1" }, { ownerId: "owner-1", sessionId: "session-2" }])
})

test("voice quota still rejects the 31st distinct session in an hour", async () => {
  const fake = new VoiceRequestPool()
  const pool = fake as unknown as Pool
  for (let index = 0; index < 30; index++) await reserveVoiceRequest(pool, "owner-1", `session-${index}`)
  await assert.rejects(() => reserveVoiceRequest(pool, "owner-1", "session-31"), /ლიმიტი/)
})
