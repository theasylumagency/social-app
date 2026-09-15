import { authenticateWorkRequest } from "../../../_server/auth"
import { limitedBody } from "../../../_server/limited-body"
import { getDatabasePool } from "../../../_server/database"
import { reserveVoiceRequest } from "../../../../infrastructure/postgres/contextual-notes-store"
import { createTranscriber, MAX_AUDIO_BYTES, speechConfig } from "../../../../infrastructure/speech/transcription"

export const runtime = "nodejs"
export const maxDuration = 90
export async function POST(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  try {
    const transcribe = createTranscriber(speechConfig())
    const bytes = await limitedBody(request, MAX_AUDIO_BYTES + 16384)
    const data = await new Response(bytes, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData()
    const file = data.get("audio")
    if (!(file instanceof File)) throw Error("ხმის ჩანაწერი ვერ მოიძებნა.")
    await reserveVoiceRequest(getDatabasePool(), access.session.user.id)
    return Response.json({ text: await transcribe(file) }, { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    return Response.json({ message: error instanceof Error && /[ა-ჰ]/u.test(error.message) ? error.message : "ხმის ამოცნობა ვერ დასრულდა. შეგიძლიათ შენიშვნა დაწეროთ." }, { status: 422 })
  }
}
