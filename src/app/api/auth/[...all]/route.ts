import { getAuth } from "../../../_server/auth"

export const runtime = "nodejs"

async function handle(request: Request) {
  try {
    const response = await getAuth().handler(request)
    response.headers.set("Cache-Control", "no-store")
    response.headers.set("Referrer-Policy", "no-referrer")
    return response
  } catch {
    return Response.json({ code: "AUTH_UNAVAILABLE", message: "შესვლა დროებით მიუწვდომელია. სცადე მოგვიანებით." }, { status: 503 })
  }
}

export const GET = handle
export const POST = handle
