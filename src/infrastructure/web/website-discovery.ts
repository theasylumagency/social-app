import { createHash } from "node:crypto"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { loadBuffer, type CheerioAPI } from "cheerio"

export type WebsiteDiscovery = {
  readonly requestedUrl: string
  readonly finalUrl: string
  readonly pageTitle?: string
  readonly businessName?: string
  readonly description?: string
  readonly industry?: string
  readonly location?: string
  readonly language?: "ka" | "en"
  readonly logoUrl?: string
  readonly facebookPage?: string
  readonly services: readonly string[]
  readonly warnings: readonly string[]
}

export type WebsiteDiscoveryErrorCode =
  | "invalidUrl"
  | "privateAddress"
  | "unreachable"
  | "notHtml"
  | "unsupportedImage"
  | "tooLarge"
  | "tooManyRedirects"

export class WebsiteDiscoveryError extends Error {
  readonly code: WebsiteDiscoveryErrorCode

  constructor(code: WebsiteDiscoveryErrorCode, message: string) {
    super(message)
    this.name = "WebsiteDiscoveryError"
    this.code = code
  }
}

export type WebsiteDiscoveryDependencies = {
  readonly fetchPage?: typeof fetch
  readonly resolveAddresses?: (hostname: string) => Promise<readonly string[]>
}

const MAX_RESPONSE_BYTES = 1_000_000
const MAX_IMAGE_BYTES = 3_000_000
const MAX_REDIRECTS = 3
const REQUEST_TIMEOUT_MS = 8_000
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const GENERIC_SCHEMA_TYPES = new Set([
  "thing",
  "organization",
  "localbusiness",
  "webpage",
  "website",
])

function cleanText(value: string | undefined, maxLength = 500): string | undefined {
  if (value === undefined) {
    return undefined
  }
  const cleaned = value.replace(/\s+/gu, " ").trim()
  if (cleaned.length === 0) {
    return undefined
  }
  return cleaned.slice(0, maxLength)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? cleanText(value) : undefined
}

function schemaTypes(value: unknown): readonly string[] {
  if (typeof value === "string") {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === "string" ? [item] : []))
  }
  return []
}

function collectJsonLdNodes(
  value: unknown,
  nodes: Record<string, unknown>[],
  depth = 0,
): void {
  if (depth > 8 || nodes.length >= 120) {
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdNodes(item, nodes, depth + 1)
    }
    return
  }
  if (!isRecord(value)) {
    return
  }

  nodes.push(value)
  const graph = value["@graph"]
  if (graph !== undefined) {
    collectJsonLdNodes(graph, nodes, depth + 1)
  }
}

function jsonLdNodes($: CheerioAPI): readonly Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = []
  $("script[type='application/ld+json']")
    .slice(0, 20)
    .each((_index, element) => {
      const raw = $(element).text().trim()
      if (raw.length === 0 || raw.length > 200_000) {
        return
      }
      try {
        collectJsonLdNodes(JSON.parse(raw), nodes)
      } catch {
        // Invalid third-party JSON-LD is ignored; other page metadata still applies.
      }
    })
  return nodes
}

function metaContent($: CheerioAPI, selectors: readonly string[]): string | undefined {
  for (const selector of selectors) {
    const value = cleanText($(selector).first().attr("content"))
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

function schemaOrganization(
  nodes: readonly Record<string, unknown>[],
): Record<string, unknown> | undefined {
  return nodes.find((node) => {
    const types = schemaTypes(node["@type"])
    const knownOrganization = types.some((type) => {
      const normalized = type.toLocaleLowerCase("en-US")
      return normalized === "organization" || normalized.endsWith("business")
    })
    const likelyOrganization =
      typeof node.name === "string" &&
      (node.address !== undefined ||
        node.logo !== undefined ||
        node.sameAs !== undefined) &&
      !types.some((type) =>
        ["webpage", "website", "article"].includes(
          type.toLocaleLowerCase("en-US"),
        ),
      )
    return knownOrganization || likelyOrganization
  })
}

function addressText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return cleanText(value, 200)
  }
  if (!isRecord(value)) {
    return undefined
  }

  const parts = [
    value.streetAddress,
    value.addressLocality,
    value.addressRegion,
    value.postalCode,
    value.addressCountry,
  ].flatMap((part) => (typeof part === "string" ? [part.trim()] : []))
  return cleanText(parts.filter((part) => part.length > 0).join(", "), 200)
}

function absoluteHttpUrl(value: unknown, baseUrl: string): string | undefined {
  if (typeof value !== "string") {
    if (isRecord(value)) {
      return absoluteHttpUrl(value.url ?? value.contentUrl, baseUrl)
    }
    return undefined
  }
  try {
    const url = new URL(value, baseUrl)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

function isFacebookUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLocaleLowerCase("en-US")
    return hostname === "facebook.com" || hostname.endsWith(".facebook.com")
  } catch {
    return false
  }
}

function facebookUrl(
  $: CheerioAPI,
  nodes: readonly Record<string, unknown>[],
  baseUrl: string,
): string | undefined {
  const candidates: string[] = []
  for (const node of nodes) {
    const sameAs = node.sameAs
    if (typeof sameAs === "string") {
      candidates.push(sameAs)
    } else if (Array.isArray(sameAs)) {
      candidates.push(
        ...sameAs.flatMap((item) => (typeof item === "string" ? [item] : [])),
      )
    }
  }
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href")
    if (href !== undefined && href.toLocaleLowerCase("en-US").includes("facebook.com")) {
      candidates.push(href)
    }
  })

  for (const candidate of candidates) {
    const absolute = absoluteHttpUrl(candidate, baseUrl)
    if (absolute !== undefined && isFacebookUrl(absolute)) {
      const secure = new URL(absolute)
      secure.protocol = "https:"
      return secure.toString()
    }
  }
  return undefined
}

function collectServiceNames(
  nodes: readonly Record<string, unknown>[],
): readonly string[] {
  const names = new Map<string, string>()
  const add = (value: unknown) => {
    const name = stringValue(value)
    if (name !== undefined && name.length <= 160) {
      names.set(name.toLocaleLowerCase("ka-GE"), name)
    }
  }
  const addNamedValue = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        addNamedValue(item)
      }
    } else if (isRecord(value)) {
      add(value.name)
      add(value.serviceType)
      addNamedValue(value.itemOffered)
      addNamedValue(value.itemListElement)
    }
  }

  for (const node of nodes) {
    const types = schemaTypes(node["@type"])
    if (types.some((type) => ["service", "product"].includes(type.toLocaleLowerCase("en-US")))) {
      add(node.name)
      add(node.serviceType)
    }
    add(node.serviceType)
    addNamedValue(node.makesOffer)
    addNamedValue(node.hasOfferCatalog)
    if (names.size >= 12) {
      break
    }
  }
  return [...names.values()].slice(0, 12)
}

function simplifiedTitle(title: string | undefined): string | undefined {
  if (title === undefined) {
    return undefined
  }
  const firstSegment = title.split(/\s(?:\||—|–|-|·)\s/u)[0]
  return cleanText(firstSegment ?? title, 120)
}

function pageLanguage($: CheerioAPI): "ka" | "en" | undefined {
  const language = $("html").attr("lang")?.toLocaleLowerCase("en-US")
  if (language?.startsWith("ka") === true) {
    return "ka"
  }
  if (language?.startsWith("en") === true) {
    return "en"
  }
  return undefined
}

export function extractWebsiteDiscovery(
  html: Buffer,
  requestedUrl: string,
  finalUrl = requestedUrl,
): WebsiteDiscovery {
  const $ = loadBuffer(html, {
    baseURI: finalUrl,
    encoding: { defaultEncoding: "utf-8" },
  })
  const nodes = jsonLdNodes($)
  const organization = schemaOrganization(nodes)
  const pageTitle = cleanText($("title").first().text(), 200)
  const description =
    metaContent($, [
      "meta[property='og:description']",
      "meta[name='description']",
      "meta[name='twitter:description']",
    ]) ?? stringValue(organization?.description)
  const businessName =
    metaContent($, [
      "meta[property='og:site_name']",
      "meta[name='application-name']",
    ]) ??
    stringValue(organization?.name) ??
    simplifiedTitle(pageTitle)
  const type = schemaTypes(organization?.["@type"]).find(
    (item) => !GENERIC_SCHEMA_TYPES.has(item.toLocaleLowerCase("en-US")),
  )
  const industry =
    stringValue(organization?.industry) ??
    stringValue(organization?.category) ??
    type
  const logoCandidate =
    organization?.logo ??
    metaContent($, ["meta[property='og:image']", "meta[name='twitter:image']"]) ??
    $("link[rel~='icon']").first().attr("href")
  const services = collectServiceNames(nodes)
  const location = addressText(organization?.address)
  const language = pageLanguage($)
  const logoUrl = absoluteHttpUrl(logoCandidate, finalUrl)
  const discoveredFacebookPage = facebookUrl($, nodes, finalUrl)
  const usefulFieldCount = [businessName, description, industry].filter(
    (value) => value !== undefined,
  ).length + services.length

  return {
    requestedUrl,
    finalUrl,
    ...(pageTitle === undefined ? {} : { pageTitle }),
    ...(businessName === undefined ? {} : { businessName }),
    ...(description === undefined ? {} : { description }),
    ...(industry === undefined ? {} : { industry }),
    ...(location === undefined ? {} : { location }),
    ...(language === undefined ? {} : { language }),
    ...(logoUrl === undefined ? {} : { logoUrl }),
    ...(discoveredFacebookPage === undefined
      ? {}
      : { facebookPage: discoveredFacebookPage }),
    services,
    warnings:
      usefulFieldCount < 2
        ? ["ვებგვერდზე ცოტა სტრუქტურირებული ინფორმაცია ვიპოვეთ"]
        : [],
  }
}

function normalizeWebsiteUrl(value: string): URL {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 500) {
    throw new WebsiteDiscoveryError("invalidUrl", "Website URL is invalid")
  }
  const candidate = /^[a-z][a-z\d+.-]*:/iu.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new WebsiteDiscoveryError("invalidUrl", "Website URL is invalid")
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    (url.port.length > 0 && url.port !== "80" && url.port !== "443")
  ) {
    throw new WebsiteDiscoveryError("invalidUrl", "Website URL is not allowed")
  }
  return url
}

function forbiddenIpv4(address: string): boolean {
  const octets = address.split(".").map(Number)
  const first = octets[0]
  const second = octets[1]
  if (first === undefined || second === undefined) {
    return true
  }
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  )
}

function forbiddenIp(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/gu, "").toLocaleLowerCase("en-US")
  const family = isIP(normalized)
  if (family === 4) {
    return forbiddenIpv4(normalized)
  }
  if (family !== 6) {
    return true
  }
  const mappedIpv4 = /::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(normalized)?.[1]
  if (mappedIpv4 !== undefined) {
    return forbiddenIpv4(mappedIpv4)
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/u.test(normalized) ||
    normalized.startsWith("ff")
  )
}

async function defaultResolveAddresses(hostname: string): Promise<readonly string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  return addresses.map((item) => item.address)
}

async function assertPublicUrl(
  url: URL,
  resolveAddresses: (hostname: string) => Promise<readonly string[]>,
): Promise<void> {
  const hostname = url.hostname
    .replace(/^\[|\]$/gu, "")
    .toLocaleLowerCase("en-US")
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new WebsiteDiscoveryError("privateAddress", "Private URLs are not allowed")
  }
  let addresses: readonly string[]
  try {
    addresses = isIP(hostname) === 0 ? await resolveAddresses(hostname) : [hostname]
  } catch {
    throw new WebsiteDiscoveryError("unreachable", "Website DNS lookup failed")
  }
  if (addresses.length === 0 || addresses.some(forbiddenIp)) {
    throw new WebsiteDiscoveryError("privateAddress", "Private URLs are not allowed")
  }
}

async function readLimitedBody(
  response: Response,
  maxBytes = MAX_RESPONSE_BYTES,
): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new WebsiteDiscoveryError("tooLarge", "Website response is too large")
  }
  if (response.body === null) {
    return Buffer.alloc(0)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new WebsiteDiscoveryError("tooLarge", "Website response is too large")
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export type SupportedWebsiteImageMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif"

export type WebsiteImageCapture = {
  readonly requestedUrl: string
  readonly finalUrl: string
  readonly mediaType: SupportedWebsiteImageMediaType
  readonly contentHash: string
  readonly content: Uint8Array
}

const SUPPORTED_IMAGE_MEDIA_TYPES = new Set<SupportedWebsiteImageMediaType>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
])

function isExpectedImageBytes(
  content: Buffer,
  mediaType: SupportedWebsiteImageMediaType,
): boolean {
  if (mediaType === "image/png") {
    return content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  if (mediaType === "image/jpeg") {
    return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
  }
  if (mediaType === "image/gif") {
    const signature = content.subarray(0, 6).toString("ascii")
    return signature === "GIF87a" || signature === "GIF89a"
  }
  return (
    content.subarray(0, 4).toString("ascii") === "RIFF" &&
    content.subarray(8, 12).toString("ascii") === "WEBP"
  )
}

export async function captureWebsiteImage(
  imageUrl: string,
  {
    fetchPage = fetch,
    resolveAddresses = defaultResolveAddresses,
  }: WebsiteDiscoveryDependencies = {},
): Promise<WebsiteImageCapture> {
  const requested = normalizeWebsiteUrl(imageUrl)
  let current = requested

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertPublicUrl(current, resolveAddresses)
    let response: Response
    try {
      response = await fetchPage(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          accept: "image/png,image/jpeg,image/webp,image/gif",
          "user-agent": "UNDA-Social-Operator/0.1 (+brand-discovery)",
        },
      })
    } catch {
      throw new WebsiteDiscoveryError("unreachable", "Website image could not be reached")
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location")
      if (location === null) {
        throw new WebsiteDiscoveryError("unreachable", "Image redirect has no location")
      }
      current = normalizeWebsiteUrl(new URL(location, current).toString())
      continue
    }
    if (!response.ok) {
      throw new WebsiteDiscoveryError("unreachable", `Website image returned ${response.status}`)
    }

    const mediaType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLocaleLowerCase("en-US") as SupportedWebsiteImageMediaType | undefined
    if (mediaType === undefined || !SUPPORTED_IMAGE_MEDIA_TYPES.has(mediaType)) {
      throw new WebsiteDiscoveryError("unsupportedImage", "Website image type is unsupported")
    }
    const content = await readLimitedBody(response, MAX_IMAGE_BYTES)
    if (!isExpectedImageBytes(content, mediaType)) {
      throw new WebsiteDiscoveryError("unsupportedImage", "Website image content is invalid")
    }

    return {
      requestedUrl: requested.toString(),
      finalUrl: current.toString(),
      mediaType,
      contentHash: `sha256:${createHash("sha256").update(content).digest("hex")}`,
      content,
    }
  }

  throw new WebsiteDiscoveryError("tooManyRedirects", "Website image redirected too many times")
}

export async function discoverWebsite(
  websiteUrl: string,
  {
    fetchPage = fetch,
    resolveAddresses = defaultResolveAddresses,
  }: WebsiteDiscoveryDependencies = {},
): Promise<WebsiteDiscovery> {
  const requested = normalizeWebsiteUrl(websiteUrl)
  let current = requested

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertPublicUrl(current, resolveAddresses)
    let response: Response
    try {
      response = await fetchPage(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "UNDA-Social-Operator/0.1 (+brand-discovery)",
        },
      })
    } catch (error) {
      if (error instanceof WebsiteDiscoveryError) {
        throw error
      }
      throw new WebsiteDiscoveryError("unreachable", "Website could not be reached")
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location")
      if (location === null) {
        throw new WebsiteDiscoveryError("unreachable", "Redirect has no location")
      }
      current = normalizeWebsiteUrl(new URL(location, current).toString())
      continue
    }
    if (!response.ok) {
      throw new WebsiteDiscoveryError("unreachable", `Website returned ${response.status}`)
    }
    const contentType = response.headers.get("content-type")?.toLocaleLowerCase("en-US")
    if (
      contentType !== undefined &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new WebsiteDiscoveryError("notHtml", "Website did not return HTML")
    }

    const html = await readLimitedBody(response)
    return extractWebsiteDiscovery(html, requested.toString(), current.toString())
  }

  throw new WebsiteDiscoveryError("tooManyRedirects", "Website redirected too many times")
}
