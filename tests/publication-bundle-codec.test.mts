import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import test from "node:test"
import { decodeSocialPublicationBundle, encodeSocialPublicationBundle } from "../src/application/publishing/publication-bundle-codec"
import { approvedPublicationFixture } from "./publication-bundle-fixture"

test("publication bundle version 1 round-trips and historical fixture remains readable", () => {
  const original = approvedPublicationFixture().bundle
  const encoded = encodeSocialPublicationBundle(original)
  assert.equal(encoded.schema, "unda.social-publication-input")
  assert.equal(encoded.version, 1)
  assert.deepEqual(decodeSocialPublicationBundle(encoded.schema, encoded.version, structuredClone(encoded.bundle)), original)
})

test("unknown publication bundle versions fail before any downstream access", () => {
  const original = approvedPublicationFixture().bundle
  assert.throws(() => decodeSocialPublicationBundle("unda.social-publication-input", 99, original), /publicationBundleUnsupportedVersion/)
})

test("frozen version two bundles remain readable without acquiring new approval evidence", () => {
  const historical = JSON.parse(readFileSync(new URL("./fixtures/publication-v2-facebook.json", import.meta.url), "utf8"))
  const decoded = decodeSocialPublicationBundle(historical.schema, historical.version, historical.bundle)
  assert.deepEqual(decoded, historical.bundle)
  assert.ok("weeklyReview" in decoded && decoded.weeklyReview.version === 1 && !("binding" in decoded.approval))
})
