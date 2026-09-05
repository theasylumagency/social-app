import {
  createBrandOnboarding,
  type WebsiteSourceCapture,
} from "../../../application/onboarding/create-brand"
import { parseBrandOnboardingInput } from "../../../application/onboarding/schema"
import type { SocialManualKnowledgeInput } from "../../../blueprints/social/ingestion/manual-profile"
import type { SocialWebsiteKnowledgeCitations } from "../../../blueprints/social/ingestion/website-profile"
import type { ContentHash } from "../../../core/domain"
import { PostgresIngestionStore } from "../../../infrastructure/postgres/ingestion-store"
import {
  captureWebsiteImage,
  discoverWebsite,
} from "../../../infrastructure/web/website-discovery"
import { getDatabasePool } from "../../_server/database"
import { authenticateWorkRequest } from "../../_server/auth"
import { ensurePersonalWorkspace } from "../../../infrastructure/postgres/workspace-store"

export const runtime = "nodejs"

const MAX_REQUEST_SIZE = 32_000

function websiteKnowledge(
  discovery: Awaited<ReturnType<typeof discoverWebsite>>,
): SocialManualKnowledgeInput {
  return {
    identityWebsite: discovery.finalUrl,
    ...(discovery.businessName === undefined
      ? {}
      : { identityName: discovery.businessName }),
    ...(discovery.description === undefined
      ? {}
      : { identityShortDescription: discovery.description }),
    ...(discovery.industry === undefined
      ? {}
      : { identityIndustry: discovery.industry }),
    ...(discovery.location === undefined
      ? {}
      : { identityLocations: [discovery.location] }),
    ...(discovery.language === undefined
      ? {}
      : { identityLanguages: [discovery.language] }),
    ...(discovery.facebookPage === undefined
      ? {}
      : { identitySocialAccounts: [discovery.facebookPage] }),
    ...(discovery.services.length === 0
      ? {}
      : { offerPrimaryServices: discovery.services }),
  }
}

function websiteCitations(
  discovery: Awaited<ReturnType<typeof discoverWebsite>>,
): SocialWebsiteKnowledgeCitations {
  const scalar = (
    item: typeof discovery.evidence.businessName,
  ) => item === undefined
    ? []
    : [{
        value: item.value,
        sourceUrl: item.sourceUrl,
        exactExcerpt: item.exactExcerpt,
        confidence: item.confidence,
      }]

  const identityName = scalar(discovery.evidence.businessName)
  const identityIndustry = scalar(discovery.evidence.industry)
  const identityShortDescription = scalar(discovery.evidence.description)
  const identityLocations = discovery.evidence.locations.slice(0, 1).map((item) => ({
    value: item.value,
    sourceUrl: item.sourceUrl,
    exactExcerpt: item.exactExcerpt,
    confidence: item.confidence,
  }))
  const offerPrimaryServices = discovery.evidence.services.map((item) => ({
    value: item.value,
    sourceUrl: item.sourceUrl,
    exactExcerpt: item.exactExcerpt,
    confidence: item.confidence,
  }))

  return {
    ...(identityName.length === 0 ? {} : { identityName }),
    ...(identityIndustry.length === 0 ? {} : { identityIndustry }),
    ...(identityShortDescription.length === 0
      ? {}
      : { identityShortDescription }),
    ...(identityLocations.length === 0 ? {} : { identityLocations }),
    ...(offerPrimaryServices.length === 0
      ? {}
      : { offerPrimaryServices }),
  }
}

async function captureWebsiteSource(
  website: string | undefined,
): Promise<WebsiteSourceCapture | undefined> {
  if (website === undefined) {
    return undefined
  }
  try {
    const discovery = await discoverWebsite(website)
    let logo: WebsiteSourceCapture["logo"]
    if (discovery.logoUrl !== undefined) {
      try {
        const capturedLogo = await captureWebsiteImage(discovery.logoUrl)
        logo = {
          finalUrl: capturedLogo.finalUrl,
          mediaType: capturedLogo.mediaType,
          contentHash: capturedLogo.contentHash as ContentHash,
          content: capturedLogo.content,
        }
      } catch {
        // Logo capture is best-effort; website evidence remains useful without it.
      }
    }
    return {
      requestedUrl: discovery.requestedUrl,
      finalUrl: discovery.finalUrl,
      ...(discovery.pageTitle === undefined
        ? {}
        : { pageTitle: discovery.pageTitle }),
      warnings: discovery.warnings,
      knowledge: websiteKnowledge(discovery),
      citations: websiteCitations(discovery),
      ...(logo === undefined ? {} : { logo }),
    }
  } catch {
    // The user-confirmed profile is still persisted if the source changed or went offline.
    return undefined
  }
}

export async function POST(request: Request): Promise<Response> {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
    return Response.json(
      { message: "მოთხოვნა ზედმეტად დიდია" },
      { status: 413 },
    )
  }

  const rawBody = await request.text()
  if (rawBody.length > MAX_REQUEST_SIZE) {
    return Response.json(
      { message: "მოთხოვნა ზედმეტად დიდია" },
      { status: 413 },
    )
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json(
      { message: "მონაცემების ფორმატი არასწორია" },
      { status: 400 },
    )
  }

  const validation = parseBrandOnboardingInput(payload)
  if (!validation.success) {
    return Response.json(
      {
        message: "შეამოწმეთ შევსებული მონაცემები",
        fieldErrors: validation.errors,
      },
      { status: 422 },
    )
  }

  try {
    const websiteCapture = await captureWebsiteSource(validation.data.website)
    const pool = getDatabasePool()
    const workspace = await ensurePersonalWorkspace(pool, access.session.user.id)
    const store = new PostgresIngestionStore(pool, workspace)
    const result = await createBrandOnboarding(validation.data, store, {
      ...(websiteCapture === undefined ? {} : { websiteCapture }),
    })
    return Response.json({
      message: "Brand Brain-ის საფუძველი მზადაა",
      result,
    })
  } catch (error) {
    console.error("Brand onboarding failed", error)
    return Response.json(
      { message: "შენახვა ვერ დასრულდა. სცადეთ ხელახლა." },
      { status: 503 },
    )
  }
}
