import { createBrandOnboarding } from "../../../application/onboarding/create-brand"
import { parseBrandOnboardingInput } from "../../../application/onboarding/schema"
import { PostgresIngestionStore } from "../../../infrastructure/postgres/ingestion-store"
import { getDatabasePool } from "../../_server/database"

export const runtime = "nodejs"

const MAX_REQUEST_SIZE = 32_000

export async function POST(request: Request): Promise<Response> {
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
    const store = new PostgresIngestionStore(getDatabasePool())
    const result = await createBrandOnboarding(validation.data, store)
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
