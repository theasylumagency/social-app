const assert = require("node:assert/strict")
const test = require("node:test")

const {
  discoverWebsite,
  extractWebsiteDiscovery,
  WebsiteDiscoveryError,
} = require("../dist/infrastructure/web/website-discovery.js")

const websiteHtml = Buffer.from(`
  <!doctype html>
  <html lang="ka">
    <head>
      <title>სტუდიო მზე | ინტერიერის დიზაინი</title>
      <meta property="og:site_name" content="სტუდიო მზე">
      <meta property="og:description" content="ვქმნით მშვიდ და ფუნქციურ სივრცეებს.">
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "სტუდიო მზე",
          "industry": "ინტერიერის დიზაინი",
          "logo": "/assets/logo.png",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "თბილისი",
            "addressCountry": "საქართველო"
          },
          "sameAs": ["https://www.facebook.com/studiomze"],
          "makesOffer": [
            {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "ინტერიერის კონცეფცია"}},
            {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "ავტორის ზედამხედველობა"}}
          ]
        }
      </script>
    </head>
    <body><h1>სტუდიო მზე</h1></body>
  </html>
`)

test("website discovery extracts editable brand candidates from metadata", () => {
  const result = extractWebsiteDiscovery(
    websiteHtml,
    "https://example.ge/",
    "https://example.ge/about",
  )

  assert.equal(result.businessName, "სტუდიო მზე")
  assert.equal(result.description, "ვქმნით მშვიდ და ფუნქციურ სივრცეებს.")
  assert.equal(result.industry, "ინტერიერის დიზაინი")
  assert.equal(result.location, "თბილისი, საქართველო")
  assert.equal(result.language, "ka")
  assert.equal(result.logoUrl, "https://example.ge/assets/logo.png")
  assert.equal(result.facebookPage, "https://www.facebook.com/studiomze")
  assert.deepEqual(result.services, [
    "ინტერიერის კონცეფცია",
    "ავტორის ზედამხედველობა",
  ])
})

test("website discovery checks a public address before reading HTML", async () => {
  let requestedUrl
  const result = await discoverWebsite("example.ge", {
    resolveAddresses: async () => ["93.184.216.34"],
    fetchPage: async (url) => {
      requestedUrl = url.toString()
      return new Response(websiteHtml, {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    },
  })

  assert.equal(requestedUrl, "https://example.ge/")
  assert.equal(result.businessName, "სტუდიო მზე")
})

test("website discovery blocks local and private network targets", async () => {
  await assert.rejects(
    () => discoverWebsite("http://127.0.0.1"),
    (error) =>
      error instanceof WebsiteDiscoveryError && error.code === "privateAddress",
  )
  await assert.rejects(
    () =>
      discoverWebsite("https://private.example", {
        resolveAddresses: async () => ["192.168.1.20"],
      }),
    (error) =>
      error instanceof WebsiteDiscoveryError && error.code === "privateAddress",
  )
})
