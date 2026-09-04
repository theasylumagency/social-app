export type OnboardingLanguage = "ka" | "en"

export type BrandOnboardingInput = {
  readonly businessName: string
  readonly language: OnboardingLanguage
  readonly services: readonly string[]
  readonly industry?: string
  readonly description?: string
  readonly website?: string
  readonly facebookPage?: string
  readonly location?: string
  readonly audiences?: readonly string[]
  readonly tones?: readonly string[]
  readonly goals?: readonly string[]
  readonly avoidTopics?: readonly string[]
}

export type OnboardingField =
  | "businessName"
  | "language"
  | "services"
  | "industry"
  | "description"
  | "website"
  | "facebookPage"
  | "location"
  | "audiences"
  | "tones"
  | "goals"
  | "avoidTopics"

export type OnboardingValidationResult =
  | { readonly success: true; readonly data: BrandOnboardingInput }
  | {
      readonly success: false
      readonly errors: Readonly<Partial<Record<OnboardingField, string>>>
    }

type MutableErrors = Partial<Record<OnboardingField, string>>

const MAX_LIST_ITEMS = 12
const MAX_ITEM_LENGTH = 160

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function readText(
  input: Record<string, unknown>,
  field: OnboardingField,
  errors: MutableErrors,
  options: { readonly required?: boolean; readonly maxLength?: number } = {},
): string | undefined {
  const value = input[field]
  if (value === undefined || value === null || value === "") {
    if (options.required === true) {
      errors[field] = "ეს ველი აუცილებელია"
    }
    return undefined
  }
  if (typeof value !== "string") {
    errors[field] = "მიუთითეთ ტექსტური მნიშვნელობა"
    return undefined
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    if (options.required === true) {
      errors[field] = "ეს ველი აუცილებელია"
    }
    return undefined
  }
  const maxLength = options.maxLength ?? MAX_ITEM_LENGTH
  if (trimmed.length > maxLength) {
    errors[field] = `მაქსიმუმ ${maxLength} სიმბოლოა დასაშვები`
    return undefined
  }
  return trimmed
}

function readList(
  input: Record<string, unknown>,
  field: OnboardingField,
  errors: MutableErrors,
  required = false,
): readonly string[] | undefined {
  const value = input[field]
  if (value === undefined || value === null) {
    if (required) {
      errors[field] = "მიუთითეთ სულ მცირე ერთი მნიშვნელობა"
    }
    return undefined
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors[field] = "მნიშვნელობები უნდა იყოს ტექსტური სია"
    return undefined
  }

  const seen = new Set<string>()
  const items: string[] = []
  for (const rawItem of value) {
    const item = rawItem.trim()
    if (item.length === 0) {
      continue
    }
    if (item.length > MAX_ITEM_LENGTH) {
      errors[field] = `თითოეული ჩანაწერი მაქსიმუმ ${MAX_ITEM_LENGTH} სიმბოლო უნდა იყოს`
      return undefined
    }
    const identity = item.toLocaleLowerCase("ka-GE")
    if (!seen.has(identity)) {
      seen.add(identity)
      items.push(item)
    }
  }

  if (items.length > MAX_LIST_ITEMS) {
    errors[field] = `მაქსიმუმ ${MAX_LIST_ITEMS} ჩანაწერია დასაშვები`
    return undefined
  }
  if (required && items.length === 0) {
    errors[field] = "მიუთითეთ სულ მცირე ერთი მნიშვნელობა"
    return undefined
  }
  return items.length === 0 ? undefined : items
}

function readLanguage(
  input: Record<string, unknown>,
  errors: MutableErrors,
): OnboardingLanguage | undefined {
  const value = input.language
  if (value === "ka" || value === "en") {
    return value
  }
  errors.language = "აირჩიეთ ქართული ან ინგლისური"
  return undefined
}

function readWebsite(
  input: Record<string, unknown>,
  errors: MutableErrors,
): string | undefined {
  const website = readText(input, "website", errors, { maxLength: 300 })
  if (website === undefined) {
    return undefined
  }

  try {
    const url = new URL(website)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new TypeError("Unsupported protocol")
    }
    return url.toString()
  } catch {
    errors.website = "მიუთითეთ სრული მისამართი, მაგალითად https://example.ge"
    return undefined
  }
}

function readFacebookPage(
  input: Record<string, unknown>,
  errors: MutableErrors,
): string | undefined {
  const facebookPage = readText(input, "facebookPage", errors, {
    maxLength: 300,
  })
  if (facebookPage === undefined) {
    return undefined
  }

  try {
    const url = new URL(facebookPage)
    const hostname = url.hostname.toLocaleLowerCase("en-US")
    if (
      url.protocol !== "https:" ||
      (hostname !== "facebook.com" && !hostname.endsWith(".facebook.com"))
    ) {
      throw new TypeError("Not a Facebook Page URL")
    }
    return url.toString()
  } catch {
    errors.facebookPage = "მიუთითეთ Facebook გვერდის სრული მისამართი"
    return undefined
  }
}

export function parseBrandOnboardingInput(
  value: unknown,
): OnboardingValidationResult {
  if (!isRecord(value)) {
    return {
      success: false,
      errors: { businessName: "მონაცემების ფორმატი არასწორია" },
    }
  }

  const errors: MutableErrors = {}
  const businessName = readText(value, "businessName", errors, {
    required: true,
    maxLength: 120,
  })
  const language = readLanguage(value, errors)
  const services = readList(value, "services", errors, true)
  const industry = readText(value, "industry", errors, { maxLength: 120 })
  const description = readText(value, "description", errors, {
    maxLength: 500,
  })
  const website = readWebsite(value, errors)
  const facebookPage = readFacebookPage(value, errors)
  const location = readText(value, "location", errors, { maxLength: 160 })
  const audiences = readList(value, "audiences", errors)
  const tones = readList(value, "tones", errors)
  const goals = readList(value, "goals", errors)
  const avoidTopics = readList(value, "avoidTopics", errors)

  if (
    businessName === undefined ||
    language === undefined ||
    services === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: {
      businessName,
      language,
      services,
      ...(industry === undefined ? {} : { industry }),
      ...(description === undefined ? {} : { description }),
      ...(website === undefined ? {} : { website }),
      ...(facebookPage === undefined ? {} : { facebookPage }),
      ...(location === undefined ? {} : { location }),
      ...(audiences === undefined ? {} : { audiences }),
      ...(tones === undefined ? {} : { tones }),
      ...(goals === undefined ? {} : { goals }),
      ...(avoidTopics === undefined ? {} : { avoidTopics }),
    },
  }
}
