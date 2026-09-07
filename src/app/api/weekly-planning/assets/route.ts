import sharp from "sharp"
import { authenticateWorkRequest, currentSession } from "../../../_server/auth"
import { getDatabasePool } from "../../../_server/database"
import { isDiscoveryId } from "../../../../infrastructure/postgres/brand-discovery-store"
import { listPostAssets, mutatePostAsset, readPostAsset, readWeeklyPosts } from "../../../../infrastructure/postgres/weekly-posts-store"

export const runtime = "nodejs"
const maxFileBytes = 8 * 1024 * 1024
export async function GET(request: Request) {
  const session = await currentSession()
  if (!session?.user.emailVerified) return new Response(null, { status: 401 })
  const id = new URL(request.url).searchParams.get("id")
  if (!isDiscoveryId(id)) return new Response(null, { status: 404 })
  const content = await readPostAsset(getDatabasePool(), session.user.id, id)
  if (!content) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(content), { headers: { "content-type": "image/webp", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-disposition": "inline" } })
}
export async function POST(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  if (Number(request.headers.get("content-length")) > maxFileBytes + 12000) return Response.json({ message: "ფაილი 8 MB-ზე დიდი არ უნდა იყოს." }, { status: 413 })
  try {
    // Bound the stream even when Content-Length is absent or forged.
    const reader = request.body?.getReader()
    if (!reader) throw Error("ფაილი ვერ წავიკითხეთ.")
    const parts: Uint8Array[] = []; let total = 0
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > maxFileBytes + 12000) { await reader.cancel(); throw Error("ფაილი 8 MB-ზე დიდი არ უნდა იყოს.") } parts.push(value) }
    const form = await new Response(Buffer.concat(parts), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData()
    const runId = form.get("runId"); const postKey = form.get("postKey"); const slot = Number(form.get("slot"))
    if (!isDiscoveryId(runId) || typeof postKey !== "string" || !/^p[1-5]$/.test(postKey) || !Number.isInteger(slot) || slot < 0 || slot > 5) throw Error("პოსტი ან გამოსახულების ადგილი არასწორია.")
    const pool = getDatabasePool(); const ownerId = access.session.user.id
    if (!await readWeeklyPosts(pool, ownerId, runId)) return Response.json({ message: "პოსტი ვერ მოიძებნა." }, { status: 404 })
    const file = form.get("file")
    if (!(file instanceof File) || !file.size || file.size > maxFileBytes) throw Error("აირჩიეთ JPG, PNG ან WebP, მაქსიმუმ 8 MB.")
    const source = Buffer.from(await file.arrayBuffer())
    const decoded = sharp(source, { limitInputPixels: 20_000_000, animated: false })
    const meta = await decoded.metadata()
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) !== 1) throw Error("ატვირთეთ ერთკადრიანი JPG, PNG ან WebP გამოსახულება.")
    const { data, info } = await decoded.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true })
    await mutatePostAsset(pool, ownerId, runId, postKey, slot, { content: data, width: info.width, height: info.height, name: file.name.slice(0, 160) })
    return Response.json({ assets: await listPostAssets(pool, ownerId, runId) })
  } catch (e) { return Response.json({ message: e instanceof Error && /[ა-ჰ]/u.test(e.message) ? e.message : "გამოსახულება ვერ დამუშავდა. სცადეთ სხვა JPG, PNG ან WebP ფაილი." }, { status: 422 }) }
}
export async function DELETE(request: Request) {
  const access = await authenticateWorkRequest(request)
  if (access.error) return access.error
  try {
    const q = new URL(request.url).searchParams; const runId = q.get("runId"); const postKey = q.get("postKey"); const slot = Number(q.get("slot"))
    if (!isDiscoveryId(runId) || !postKey) throw Error("პოსტი ვერ მოიძებნა.")
    await mutatePostAsset(getDatabasePool(), access.session.user.id, runId, postKey, slot, null)
    return Response.json({ assets: await listPostAssets(getDatabasePool(), access.session.user.id, runId) })
  } catch { return Response.json({ message: "გამოსახულება ვერ წაიშალა. განაახლეთ გვერდი." }, { status: 409 }) }
}
