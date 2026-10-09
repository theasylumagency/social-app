import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { socialDeliveryFixture } from "./social-delivery-fixture"
import { subscribeFixture } from "./strategic-integration-fixture"
import { operatorQueues } from "../src/worker/operator-queues"

test("queue selection is bounded, fair between brands, excludes active jobs and requires verified subscription", async t => {
  const { pool } = await socialDeliveryFixture(t)
  await subscribeFixture(pool, "owner")
  await pool.query("INSERT INTO brands(id,created_at,workspace_id) SELECT 'second-brand',now(),workspace_id FROM brands WHERE id='brand'")
  const ids = Array.from({ length: 5 }, () => randomUUID())
  for (let i = 0; i < ids.length; i++) await pool.query("INSERT INTO brand_discovery_sessions(id,owner_user_id,brand_id,status,step,payload,updated_at) VALUES($1,'owner',$2,'queued','sources','{}',now()+($3*interval '1 second'))", [ids[i], i < 3 ? "brand" : "second-brand", i])
  const queues = operatorQueues(pool, 2), discovery = queues.find(q => q.name === "discovery")!
  const selected = await discovery.select(2, [])
  assert.deepEqual(selected.map(j => j.id), [ids[0], ids[3]])
  assert.equal((await discovery.select(1, [ids[0]!]))[0]!.id, ids[1])
  for (const q of queues.filter(q => q !== discovery)) assert.deepEqual(await q.select(2, []), []) // Validate every query against the real schema.
  await pool.query('UPDATE auth_user SET "emailVerified"=false WHERE id=\'owner\'')
  assert.deepEqual(await discovery.select(2, []), [])
})
