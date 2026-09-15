export type Transcriber = (file: File) => Promise<string>
export type SpeechConfig = { provider: "openai" | "openai-compatible"; model: string; apiKey: string; endpoint: string }
type Environment = Record<string, string | undefined>
export function speechConfig(env: Environment = process.env): SpeechConfig {
  const provider = env.SPEECH_TO_TEXT_PROVIDER?.trim()
  const model = env.SPEECH_TO_TEXT_MODEL?.trim()
  if (provider !== "openai" && provider !== "openai-compatible") throw Error("ხმის შეყვანის პროვაიდერი არ არის გამართული.")
  if (!model || model.length > 160) throw Error("ხმის ამოცნობის მოდელი არ არის გამართული.")
  const apiKey = (provider === "openai" ? env.OPENAI_API_KEY : env.SPEECH_TO_TEXT_API_KEY)?.trim()
  if (!apiKey) throw Error("ხმის შეყვანის სერვისის გასაღები არ არის გამართული.")
  const endpoint = provider === "openai" ? "https://api.openai.com/v1/audio/transcriptions" : env.SPEECH_TO_TEXT_ENDPOINT?.trim()
  if (!endpoint) throw Error("ხმის შეყვანის სერვისის მისამართი არ არის გამართული.")
  const url = new URL(endpoint)
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw Error("ხმის შეყვანის სერვისს სჭირდება უსაფრთხო HTTPS მისამართი.")
  return { provider, model, apiKey, endpoint }
}
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024
export const AUDIO_TYPES = new Set(["audio/webm", "video/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg"])
export function createTranscriber(config: SpeechConfig, request: typeof fetch = fetch): Transcriber {
  return async file => {
    if (!file.size || file.size > MAX_AUDIO_BYTES || !AUDIO_TYPES.has(file.type.split(";")[0]!)) throw Error("ჩანაწერი უნდა იყოს აუდიო და არ აღემატებოდეს 8 MB-ს.")
    const body = new FormData()
    body.set("file", file); body.set("model", config.model); body.set("response_format", "json")
    const response = await request(config.endpoint, { method: "POST", headers: { authorization: `Bearer ${config.apiKey}` }, body, signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw Error("ხმის ამოცნობა ვერ დასრულდა. სცადეთ ხელახლა ან დაწერეთ ტექსტი.")
    const data: unknown = await response.json()
    const text = data && typeof data === "object" && "text" in data ? data.text : null
    if (typeof text !== "string" || !text.trim()) throw Error("ჩანაწერში ტექსტი ვერ ამოვიცანით. სცადეთ ხელახლა.")
    if (text.length > 8000) throw Error("ჩანაწერი ძალიან გრძელია. გამოიყენეთ უფრო მოკლე ჩანაწერი.")
    return text.trim().normalize("NFC")
  }
}
