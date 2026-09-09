import assert from "node:assert/strict"
import { createServer } from "node:http"
import { inspect } from "node:util"
import test from "node:test"
import { createZernioClient, ZernioClientError } from "../src/infrastructure/zernio/client"
import { readZernioEnvironment } from "../src/infrastructure/zernio/environment"

const key = Buffer.alloc(32, 9).toString("base64")
const production: NodeJS.ProcessEnv = { NODE_ENV: "production", BETTER_AUTH_URL: "https://app.unda.pro", SOCIAL_PUBLISHING_ENABLED: "true",
  ZERNIO_API_KEY: "secret-api-key", ZERNIO_WEBHOOK_SECRET: "secret-webhook", SOCIAL_CONNECTION_CONTEXT_KEY: key }

test("environment defaults disable publishing and require no provider credentials", () => {
  const config = readZernioEnvironment({ NODE_ENV: "test" })
  assert.equal(config.publishingEnabled, false)
  assert.equal(config.apiKey, null)
  assert.equal(config.apiBaseUrl, "https://zernio.com/api/v1")
  assert.throws(() => createZernioClient(config), /ZERNIO_API_KEY is required/)
})

test("enabled configuration fails closed on missing secrets and invalid origins", () => {
  assert.equal(readZernioEnvironment(production).publishingEnabled, true)
  for (const name of ["ZERNIO_API_KEY", "ZERNIO_WEBHOOK_SECRET", "SOCIAL_CONNECTION_CONTEXT_KEY", "BETTER_AUTH_URL"]) {
    assert.throws(() => readZernioEnvironment({ ...production, [name]: "" }))
  }
  for (const value of ["1", "yes", "TRUE", "", "false "]) {
    assert.throws(() => readZernioEnvironment({ ...production, SOCIAL_PUBLISHING_ENABLED: value }), /must be true or false/)
  }
  for (const value of ["http://zernio.com/api/v1", "https://evil.test/api/v1", "http://localhost:3000/api/v1",
    "https://zernio.com/api/v1?token=secret", "https://secret@zernio.com/api/v1", "not-a-url"]) {
    assert.throws(() => readZernioEnvironment({ ...production, ZERNIO_API_BASE_URL: value }))
  }
  for (const value of ["http://app.unda.pro", "https://app.unda.pro/path", "https://secret:password@app.unda.pro", "invalid"]) {
    assert.throws(() => readZernioEnvironment({ ...production, BETTER_AUTH_URL: value }), /BETTER_AUTH_URL/)
  }
  for (const value of ["not-base64", Buffer.alloc(31).toString("base64"), key.slice(0, -1)]) {
    assert.throws(() => readZernioEnvironment({ ...production, SOCIAL_CONNECTION_CONTEXT_KEY: value }), /32-byte/)
  }
})

test("configuration errors do not echo secrets or credential-bearing URLs", () => {
  for (const env of [{ ...production, ZERNIO_API_KEY: "secret\r\nvalue" },
    { ...production, BETTER_AUTH_URL: "https://username:super-secret@evil.test" },
    { ...production, ZERNIO_API_BASE_URL: "super-secret-invalid-url" },
    { ...production, SOCIAL_CONNECTION_CONTEXT_KEY: "super-secret-invalid-key" }]) {
    assert.throws(() => readZernioEnvironment(env), (e: unknown) => {
      assert.ok(e instanceof Error)
      assert.doesNotMatch(inspect(e), /super-secret|username|secret\r\nvalue/)
      return true
    })
  }
})

test("HTTP foundation authenticates, bounds resources, rejects redirects, and never retries", async (t) => {
  const calls: { url: string; method: string; authorization: string; requestId: string | undefined; body: string }[] = []
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    calls.push({ url: req.url!, method: req.method!, authorization: req.headers.authorization!, requestId: req.headers["x-request-id"] as string | undefined,
      body: Buffer.concat(chunks).toString() })
    if (req.url === "/api/v1/error") { res.writeHead(429); res.end("secret-api-key secret-provider-body"); return }
    if (req.url === "/api/v1/redirect") { res.writeHead(302, { Location: "/api/v1/profiles" }); res.end(); return }
    if (req.url === "/api/v1/large") { res.end(JSON.stringify({ data: "x".repeat(5000) })); return }
    if (req.url === "/api/v1/chunked") { res.writeHead(200); res.write("x".repeat(100)); res.end("x".repeat(100)); return }
    if (req.url === "/api/v1/slow") return
    if (req.url === "/api/v1/slow-body") { res.writeHead(200); res.write('{"data":'); return }
    if (req.url === "/api/v1/invalid") { res.end("secret-invalid-json"); return }
    if (req.url === "/api/v1/empty") { res.writeHead(204); res.end(); return }
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ profiles: [{ id: "profile" }] }))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) })
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  const config = readZernioEnvironment({ NODE_ENV: "test", ZERNIO_API_KEY: "secret-api-key", ZERNIO_API_BASE_URL: `http://127.0.0.1:${address.port}/api/v1` })
  const client = createZernioClient(config)

  await t.test("GET/POST use bearer auth and correctly encoded JSON/query", async () => {
    assert.deepEqual(await client.request({ method: "GET", path: "profiles", query: { search: "A & B" } }), { status: 200, data: { profiles: [{ id: "profile" }] } })
    assert.equal(calls.at(-1)?.url, "/api/v1/profiles?search=A+%26+B")
    assert.equal(calls.at(-1)?.authorization, "Bearer secret-api-key")
    await client.request({ method: "POST", path: "profiles", body: { name: "Test" } })
    assert.equal(calls.at(-1)?.method, "POST")
    assert.equal(calls.at(-1)?.body, '{"name":"Test"}')
    assert.deepEqual(await client.request({ method: "GET", path: "empty" }), { status: 204, data: null })
    const requestId = "c04d6a5e-f8ae-4d4f-94d7-c945641d3c30"
    await client.request({ method: "GET", path: "profiles", requestId })
    assert.equal(calls.at(-1)?.requestId, requestId)
    await assert.rejects(client.request({ method: "GET", path: "profiles", requestId: "not-a-uuid" }), { code: "invalidRequest" })
  })
  await t.test("traversal and excessive request bodies fail before transport", async () => {
    const count = calls.length
    for (const path of ["https://evil.test", "/profiles", "../profiles", "%2e%2e/profiles", "profiles?token=secret", "profiles\\evil"]) {
      await assert.rejects(client.request({ method: "GET", path }), { code: "invalidRequest" })
    }
    await assert.rejects(client.request({ method: "GET", path: "profiles", body: {} }), { code: "invalidRequest" })
    await assert.rejects(createZernioClient(config, { maxRequestBytes: 100 }).request({ method: "POST", path: "profiles", body: "x".repeat(200) }), { code: "requestTooLarge" })
    assert.equal(calls.length, count)
  })
  await t.test("HTTP errors and redirects are redacted and not retried", async () => {
    for (const [path, status] of [["error", 429], ["redirect", 302]] as const) {
      const count = calls.length
      await assert.rejects(client.request({ method: "GET", path }), (error: unknown) => {
        assert.ok(error instanceof ZernioClientError)
        assert.equal(error.code, "http")
        assert.equal(error.status, status)
        assert.doesNotMatch(inspect(error), /secret|Bearer|127\.0\.0\.1/)
        return true
      })
      assert.equal(calls.length, count + 1)
    }
  })
  await t.test("declared and chunked response sizes are bounded", async () => {
    for (const path of ["large", "chunked"]) {
      await assert.rejects(createZernioClient(config, { maxResponseBytes: 150 }).request({ method: "GET", path }), { code: "responseTooLarge" })
    }
  })
  await t.test("timeout covers headers and response body", async () => {
    for (const path of ["slow", "slow-body"]) {
      await assert.rejects(createZernioClient(config, { timeoutMs: 100 }).request({ method: "GET", path }), { code: "timeout" })
    }
  })
  await t.test("invalid JSON and original transport errors never leak response/request data", async () => {
    await assert.rejects(client.request({ method: "GET", path: "invalid" }), (error: unknown) => {
      assert.ok(error instanceof ZernioClientError)
      assert.equal(error.code, "invalidResponse")
      assert.doesNotMatch(inspect(error), /secret-invalid-json/)
      return true
    })
    const broken = createZernioClient(config, { fetch: async () => { throw Error("Bearer secret-api-key secret-network-detail") } })
    await assert.rejects(broken.request({ method: "GET", path: "profiles" }), (error: unknown) => {
      assert.ok(error instanceof ZernioClientError)
      assert.equal(error.code, "transport")
      assert.doesNotMatch(inspect(error), /secret|Bearer/)
      return true
    })
  })
})
