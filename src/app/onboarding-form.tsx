"use client"

import { useState, useTransition } from "react"

type MinimumViableBrand = {
  readonly usableOffer: boolean
  readonly contentLanguage: boolean
  readonly usableVoice: boolean
  readonly satisfied: boolean
}

type ReadyResult = {
  readonly minimumViableBrand: MinimumViableBrand
  readonly evidenceCount: number
  readonly proposalCount: number
}

type WebsiteDiscovery = {
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

type SubmissionState =
  | { readonly status: "idle" }
  | {
      readonly status: "error"
      readonly message: string
      readonly fieldErrors: Readonly<Record<string, string>>
    }
  | { readonly status: "ready"; readonly result: ReadyResult }

const READINESS_ITEMS = [
  {
    key: "usableOffer",
    title: "შეთავაზება",
    description: "ვიცით, რას სთავაზობს ბიზნესი მომხმარებელს",
  },
  {
    key: "contentLanguage",
    title: "კონტენტის ენა",
    description: "ვიცით, რომელ ენაზე უნდა ისაუბროს ბრენდმა",
  },
  {
    key: "usableVoice",
    title: "საუბრის სტილი",
    description: "გამოვიყენებთ თქვენს ან UNDA-ს უსაფრთხო სტილს",
  },
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function readReadyResult(value: unknown): ReadyResult | undefined {
  if (!isRecord(value) || !isRecord(value.result)) {
    return undefined
  }
  const result = value.result
  if (
    !isRecord(result.minimumViableBrand) ||
    typeof result.evidenceCount !== "number" ||
    typeof result.proposalCount !== "number"
  ) {
    return undefined
  }
  const readiness = result.minimumViableBrand
  if (
    typeof readiness.usableOffer !== "boolean" ||
    typeof readiness.contentLanguage !== "boolean" ||
    typeof readiness.usableVoice !== "boolean" ||
    typeof readiness.satisfied !== "boolean"
  ) {
    return undefined
  }
  return {
    minimumViableBrand: {
      usableOffer: readiness.usableOffer,
      contentLanguage: readiness.contentLanguage,
      usableVoice: readiness.usableVoice,
      satisfied: readiness.satisfied,
    },
    evidenceCount: result.evidenceCount,
    proposalCount: result.proposalCount,
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function readWebsiteDiscovery(value: unknown): WebsiteDiscovery | undefined {
  if (!isRecord(value) || !isRecord(value.result)) {
    return undefined
  }
  const result = value.result
  if (
    typeof result.finalUrl !== "string" ||
    !Array.isArray(result.services) ||
    result.services.some((item) => typeof item !== "string") ||
    !Array.isArray(result.warnings) ||
    result.warnings.some((item) => typeof item !== "string")
  ) {
    return undefined
  }
  const language = result.language === "ka" || result.language === "en"
    ? result.language
    : undefined
  const pageTitle = optionalString(result.pageTitle)
  const businessName = optionalString(result.businessName)
  const description = optionalString(result.description)
  const industry = optionalString(result.industry)
  const location = optionalString(result.location)
  const logoUrl = optionalString(result.logoUrl)
  const facebookPage = optionalString(result.facebookPage)
  return {
    finalUrl: result.finalUrl,
    services: result.services as string[],
    warnings: result.warnings as string[],
    ...(pageTitle === undefined ? {} : { pageTitle }),
    ...(businessName === undefined ? {} : { businessName }),
    ...(description === undefined ? {} : { description }),
    ...(industry === undefined ? {} : { industry }),
    ...(location === undefined ? {} : { location }),
    ...(language === undefined ? {} : { language }),
    ...(logoUrl === undefined ? {} : { logoUrl }),
    ...(facebookPage === undefined ? {} : { facebookPage }),
  }
}

function readErrorResponse(value: unknown): {
  readonly message: string
  readonly fieldErrors: Readonly<Record<string, string>>
} {
  if (!isRecord(value)) {
    return { message: "შენახვა ვერ დასრულდა. სცადეთ ხელახლა.", fieldErrors: {} }
  }
  const message =
    typeof value.message === "string"
      ? value.message
      : "შენახვა ვერ დასრულდა. სცადეთ ხელახლა."
  const fieldErrors: Record<string, string> = {}
  if (isRecord(value.fieldErrors)) {
    for (const [field, error] of Object.entries(value.fieldErrors)) {
      if (typeof error === "string") {
        fieldErrors[field] = error
      }
    }
  }
  return { message, fieldErrors }
}

function lines(formData: FormData, field: string): readonly string[] {
  const value = formData.get(field)
  if (typeof value !== "string") {
    return []
  }
  return value
    .split(/\r?\n|,/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function fieldError(state: SubmissionState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors[field] : undefined
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
      <path
        d="m5 10.4 3.1 3.1L15.4 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

type SourceStepProps = {
  readonly error?: string
  readonly isPending: boolean
  readonly onContinue: (websiteUrl: string, facebookPage: string) => void
  readonly onManual: () => void
}

function GlobeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3c-2.4 2.5-3.6 5.5-3.6 9S9.6 18.5 12 21" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function SourceStep({ error, isPending, onContinue, onManual }: SourceStepProps) {
  return (
    <div className="source-layout">
      <form
        className="source-card"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const website = data.get("sourceWebsite")
          const facebook = data.get("sourceFacebook")
          onContinue(
            typeof website === "string" ? website.trim() : "",
            typeof facebook === "string" ? facebook.trim() : "",
          )
        }}
      >
        <div className="source-card-icon"><GlobeIcon /></div>
        <span className="eyebrow">ბრენდის წყაროები</span>
        <h2>მოგვეცით საწყისი წერტილი</h2>
        <p className="source-card-copy">
          UNDA საჯარო ინფორმაციას წაიკითხავს და მომდევნო ფორმას წინასწარ
          შეგივსებთ. ყველაფრის შეცვლა და დადასტურება თქვენ შეგეძლებათ.
        </p>

        <div className="source-fields">
          <div className="field source-field">
            <label htmlFor="sourceWebsite">ვებგვერდის მისამართი</label>
            <div className="input-with-prefix">
              <span aria-hidden="true">↗</span>
              <input
                id="sourceWebsite"
                name="sourceWebsite"
                inputMode="url"
                placeholder="example.ge"
                maxLength={500}
                autoFocus
              />
            </div>
            <span className="field-hint">შეგიძლიათ მიუთითოთ მთავარი ან About გვერდი</span>
          </div>

          <div className="source-divider"><span>და სურვილისამებრ</span></div>

          <div className="field source-field">
            <label htmlFor="sourceFacebook">Facebook გვერდი</label>
            <div className="input-with-prefix facebook-prefix">
              <span aria-hidden="true">f</span>
              <input
                id="sourceFacebook"
                name="sourceFacebook"
                type="url"
                placeholder="https://facebook.com/your-page"
                maxLength={300}
              />
            </div>
            <span className="field-hint">
              ამ ეტაპზე მისამართს დავიმახსოვრებთ; უსაფრთხო დაკავშირება მოგვიანებით მოხდება
            </span>
          </div>
        </div>

        {error === undefined ? null : (
          <div className="source-error" role="alert">{error}</div>
        )}

        <button className="source-primary-button" type="submit" disabled={isPending}>
          <span>{isPending ? "ვკითხულობთ ვებგვერდს…" : "ბრენდის გაცნობა"}</span>
          <span aria-hidden="true">→</span>
        </button>
        <button className="manual-button" type="button" onClick={onManual} disabled={isPending}>
          ვებგვერდი არ მაქვს — ხელით შევავსებ
        </button>
      </form>

      <aside className="source-aside">
        <span className="eyebrow">რას მოძებნის UNDA</span>
        <div className="discovery-preview">
          {[
            ["01", "ბრენდის იდენტობა", "სახელი, სფერო, მოკლე აღწერა"],
            ["02", "შეთავაზება", "მომსახურებები და პროდუქტები"],
            ["03", "საჯარო მონაცემები", "მდებარეობა, ენა და სოციალური გვერდები"],
            ["04", "ვიზუალური კვალი", "ლოგო და სოციალური გაზიარების სურათი"],
          ].map(([number, title, description]) => (
            <div className="discovery-preview-item" key={number}>
              <span>{number}</span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="source-safe-note">
          <span aria-hidden="true">✦</span>
          <p>
            <strong>თქვენ აკონტროლებთ საბოლოო პასუხს.</strong>
            ვებგვერდიდან ნაპოვნი ინფორმაცია მხოლოდ შესამოწმებელი საწყისი ვერსიაა.
          </p>
        </div>
      </aside>
    </div>
  )
}

export function OnboardingForm() {
  const [state, setState] = useState<SubmissionState>({ status: "idle" })
  const [stage, setStage] = useState<"sources" | "review">("sources")
  const [discovery, setDiscovery] = useState<WebsiteDiscovery | undefined>()
  const [facebookPage, setFacebookPage] = useState("")
  const [sourceError, setSourceError] = useState<string | undefined>()
  const [isDiscovering, startDiscovery] = useTransition()
  const [isPending, startTransition] = useTransition()

  function showReview() {
    setStage("review")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function continueFromSources(websiteUrl: string, suppliedFacebookPage: string) {
    setSourceError(undefined)
    setFacebookPage(suppliedFacebookPage)
    if (websiteUrl.length === 0) {
      if (suppliedFacebookPage.length === 0) {
        setSourceError("მიუთითეთ ვებგვერდი ან აირჩიეთ ხელით შევსება")
        return
      }
      setDiscovery(undefined)
      showReview()
      return
    }

    startDiscovery(async () => {
      try {
        const response = await fetch("/api/onboarding/discover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ websiteUrl }),
        })
        const body: unknown = await response.json()
        if (!response.ok) {
          setSourceError(readErrorResponse(body).message)
          return
        }
        const result = readWebsiteDiscovery(body)
        if (result === undefined) {
          setSourceError("ვებგვერდიდან მიღებული პასუხი ვერ დამუშავდა")
          return
        }
        setDiscovery(result)
        if (suppliedFacebookPage.length === 0 && result.facebookPage !== undefined) {
          setFacebookPage(result.facebookPage)
        }
        showReview()
      } catch {
        setSourceError("ვებგვერდთან დაკავშირება ვერ მოხერხდა. შეგიძლიათ ხელით შეავსოთ.")
      }
    })
  }

  function submit(form: HTMLFormElement) {
    const formData = new FormData(form)
    const payload = {
      businessName: formData.get("businessName"),
      industry: formData.get("industry"),
      description: formData.get("description"),
      website: formData.get("website"),
      facebookPage: formData.get("facebookPage"),
      location: formData.get("location"),
      language: formData.get("language"),
      services: lines(formData, "services"),
      audiences: lines(formData, "audiences"),
      tones: formData.getAll("tones"),
      goals: lines(formData, "goals"),
      avoidTopics: lines(formData, "avoidTopics"),
    }

    startTransition(async () => {
      setState({ status: "idle" })
      try {
        const response = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        })
        const body: unknown = await response.json()
        if (!response.ok) {
          setState({ status: "error", ...readErrorResponse(body) })
          return
        }

        const result = readReadyResult(body)
        if (result === undefined) {
          setState({
            status: "error",
            message: "პასუხის დამუშავება ვერ მოხერხდა. სცადეთ ხელახლა.",
            fieldErrors: {},
          })
          return
        }
        setState({ status: "ready", result })
      } catch {
        setState({
          status: "error",
          message: "სერვერთან დაკავშირება ვერ მოხერხდა. სცადეთ ხელახლა.",
          fieldErrors: {},
        })
      }
    })
  }

  if (stage === "sources") {
    return (
      <>
        <div className="page-intro">
          <span className="eyebrow">Source-first onboarding</span>
          <h1>მოდით, UNDA-მ ჯერ თავად გაიცნოს თქვენი ბიზნესი</h1>
          <p>
            მიუთითეთ ვებგვერდი ან Facebook გვერდი. ჩვენ მოვძებნით საწყის
            ინფორმაციას, თქვენ კი გადაამოწმებთ და საბოლოოდ დაადასტურებთ.
          </p>
        </div>
        <SourceStep
          {...(sourceError === undefined ? {} : { error: sourceError })}
          isPending={isDiscovering}
          onContinue={continueFromSources}
          onManual={() => {
            setDiscovery(undefined)
            setFacebookPage("")
            setSourceError(undefined)
            showReview()
          }}
        />
      </>
    )
  }

  return (
    <>
      <div className="page-intro review-intro">
        <span className="eyebrow">მეორე ნაბიჯი</span>
        <h1>გადაამოწმეთ და დაადასტურეთ ინფორმაცია</h1>
        <p>
          ნაპოვნი მონაცემები მხოლოდ საწყისი ვერსიაა. თქვენი შესწორება ყოველთვის
          უფრო ახალი და პრიორიტეტული ინფორმაცია იქნება.
        </p>
      </div>
      <div className="review-toolbar">
        <button
          type="button"
          onClick={() => {
            setStage("sources")
            setState({ status: "idle" })
          }}
        >
          <span aria-hidden="true">←</span>
          წყაროების შეცვლა
        </button>
        <strong>{discovery === undefined ? "ხელით შევსება" : "ვებგვერდი გაანალიზებულია"}</strong>
      </div>
      <div className="onboarding-layout">
      <form
        className="onboarding-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit(event.currentTarget)
        }}
      >
        {discovery === undefined ? null : (
          <div className="prefill-banner">
            {discovery.logoUrl === undefined ? (
              <span className="prefill-logo-fallback" aria-hidden="true">U</span>
            ) : (
              // The source is an http(s) URL selected from the user-provided website.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={discovery.logoUrl} alt="ვებგვერდზე ნაპოვნი ლოგო" />
            )}
            <div>
              <strong>ინფორმაცია ვებგვერდიდან წინასწარ შევავსეთ</strong>
              <p>
                გადაამოწმეთ ყველა ველი. თუ რამეს შეცვლით, თქვენს პასუხს უფრო ახალ
                და პრიორიტეტულ ინფორმაციად მივიჩნევთ.
              </p>
              {discovery.warnings.map((warning) => (
                <span className="prefill-warning" key={warning}>{warning}</span>
              ))}
            </div>
            <span className="source-pill">↗ {new URL(discovery.finalUrl).hostname}</span>
          </div>
        )}
        <section className="form-section" aria-labelledby="business-heading">
          <div className="section-number">01</div>
          <div className="section-content">
            <div className="section-heading">
              <div>
                <h2 id="business-heading">გაიცანით თქვენი ბიზნესი</h2>
                <p>დავიწყოთ იმ ინფორმაციით, რომელიც ყოველთვის ზუსტი უნდა იყოს.</p>
              </div>
              <span className="required-note">* აუცილებელი ველი</span>
            </div>

            <div className="field-grid two-columns">
              <div className="field">
                <label htmlFor="businessName">ბიზნესის სახელი *</label>
                <input
                  id="businessName"
                  name="businessName"
                  defaultValue={discovery?.businessName}
                  placeholder="მაგ. სტუდიო მზე"
                  required
                  maxLength={120}
                  aria-invalid={fieldError(state, "businessName") !== undefined}
                  aria-describedby="businessName-error"
                />
                <span id="businessName-error" className="field-error">
                  {fieldError(state, "businessName")}
                </span>
              </div>
              <div className="field">
                <label htmlFor="industry">საქმიანობის სფერო</label>
                <input
                  id="industry"
                  name="industry"
                  defaultValue={discovery?.industry}
                  placeholder="მაგ. ინტერიერის დიზაინი"
                  maxLength={120}
                />
                <span className="field-hint">ერთი მოკლე და გასაგები პასუხი</span>
              </div>
            </div>

            <div className="field">
              <label htmlFor="description">რას აკეთებთ და რა არის მთავარი ღირებულება?</label>
              <textarea
                id="description"
                name="description"
                defaultValue={discovery?.description}
                rows={3}
                placeholder="ორი–სამი წინადადებით აღწერეთ თქვენი ბიზნესი და მისი მთავარი ღირებულება."
                maxLength={500}
              />
            </div>

            <div className="field-grid two-columns">
              <div className="field">
                <label htmlFor="website">ვებგვერდი</label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  defaultValue={discovery?.finalUrl}
                  placeholder="https://example.ge"
                  maxLength={300}
                  aria-invalid={fieldError(state, "website") !== undefined}
                  aria-describedby="website-error"
                />
                <span id="website-error" className="field-error">
                  {fieldError(state, "website")}
                </span>
              </div>
              <div className="field">
                <label htmlFor="facebookPage">Facebook გვერდი</label>
                <input
                  id="facebookPage"
                  name="facebookPage"
                  type="url"
                  defaultValue={facebookPage}
                  placeholder="https://facebook.com/your-page"
                  maxLength={300}
                  aria-invalid={fieldError(state, "facebookPage") !== undefined}
                  aria-describedby="facebookPage-error"
                />
                <span id="facebookPage-error" className="field-error">
                  {fieldError(state, "facebookPage")}
                </span>
              </div>
            </div>
            <div className="field compact-field">
              <label htmlFor="location">მდებარეობა</label>
              <input
                id="location"
                name="location"
                defaultValue={discovery?.location}
                placeholder="მაგ. თბილისი, საქართველო"
                maxLength={160}
              />
            </div>
          </div>
        </section>

        <section className="form-section" aria-labelledby="offer-heading">
          <div className="section-number">02</div>
          <div className="section-content">
            <div className="section-heading">
              <div>
                <h2 id="offer-heading">რას სთავაზობთ მომხმარებელს?</h2>
                <p>ეს პასუხი განსაზღვრავს, რაზე შეგვიძლია უსაფრთხოდ ვისაუბროთ.</p>
              </div>
            </div>
            <div className="field-grid two-columns">
              <div className="field">
                <label htmlFor="services">მთავარი მომსახურებები ან პროდუქტები *</label>
                <textarea
                  id="services"
                  name="services"
                  defaultValue={discovery?.services.join("\n")}
                  rows={5}
                  placeholder={"თითო ხაზზე ერთი, მაგალითად:\nბრენდის სტრატეგია\nსოციალური მედიის მართვა"}
                  required
                  aria-invalid={fieldError(state, "services") !== undefined}
                  aria-describedby="services-error services-hint"
                />
                <span id="services-hint" className="field-hint">
                  თითო ხაზზე ჩაწერეთ ერთი პასუხი
                </span>
                <span id="services-error" className="field-error">
                  {fieldError(state, "services")}
                </span>
              </div>
              <div className="field">
                <label htmlFor="audiences">ვისთვის მუშაობთ?</label>
                <textarea
                  id="audiences"
                  name="audiences"
                  rows={5}
                  placeholder={"მაგ.\nმცირე ბიზნესის მფლობელები\nსტარტაპების დამფუძნებლები"}
                />
                <span className="field-hint">შეგიძლიათ რამდენიმე ჯგუფი მიუთითოთ</span>
              </div>
            </div>
          </div>
        </section>

        <section className="form-section" aria-labelledby="voice-heading">
          <div className="section-number">03</div>
          <div className="section-content">
            <div className="section-heading">
              <div>
                <h2 id="voice-heading">როგორ უნდა ჟღერდეს ბრენდი?</h2>
                <p>თუ ჯერ არ ხართ დარწმუნებული, UNDA უსაფრთხო ნეიტრალურ ტონს გამოიყენებს.</p>
              </div>
            </div>

            <div className="field-grid voice-grid">
              <div className="field">
                <label htmlFor="language">კონტენტის ძირითადი ენა *</label>
                <select
                  id="language"
                  name="language"
                  defaultValue={discovery?.language ?? "ka"}
                  required
                >
                  <option value="ka">ქართული</option>
                  <option value="en">English</option>
                </select>
              </div>
              <fieldset className="field tone-field">
                <legend>საუბრის სტილი</legend>
                <div className="tone-options">
                  {[
                    ["მეგობრული", "friendly"],
                    ["პროფესიონალური", "professional"],
                    ["მარტივი", "clear"],
                    ["ენერგიული", "energetic"],
                  ].map(([label, value]) => (
                    <label className="tone-option" key={value}>
                      <input type="checkbox" name="tones" value={value} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        </section>

        <section className="form-section" aria-labelledby="direction-heading">
          <div className="section-number">04</div>
          <div className="section-content">
            <div className="section-heading">
              <div>
                <h2 id="direction-heading">რას უნდა მიაღწიოს კონტენტმა?</h2>
                <p>ეს ნაწილი დაგვეხმარება მომავალი კვირის სტრატეგიის მომზადებაში.</p>
              </div>
            </div>
            <div className="field-grid two-columns">
              <div className="field">
                <label htmlFor="goals">მთავარი მიზნები</label>
                <textarea
                  id="goals"
                  name="goals"
                  rows={4}
                  placeholder={"მაგ.\nმეტი ცნობადობა\nახალი მოთხოვნების მიღება"}
                />
              </div>
              <div className="field">
                <label htmlFor="avoidTopics">რისი ხსენება არ გსურთ?</label>
                <textarea
                  id="avoidTopics"
                  name="avoidTopics"
                  rows={4}
                  placeholder={"მაგ.\nკონკურენტებთან პირდაპირი შედარება\nდაუდასტურებელი შედეგები"}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="form-footer">
          <div className="privacy-note">
            <span aria-hidden="true">●</span>
            მონაცემები ინახება თქვენს ლოკალურ სამუშაო სივრცეში
          </div>
          <button className="primary-button" type="submit" disabled={isPending}>
            <span>{isPending ? "ვამზადებთ…" : "Brand Brain-ის მომზადება"}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        {state.status === "error" ? (
          <div className="status-message error-message" role="alert">
            <strong>შენახვა ვერ დასრულდა</strong>
            <span>{state.message}</span>
          </div>
        ) : null}
      </form>

      <aside className="onboarding-aside" aria-label="Brand Brain-ის მდგომარეობა">
        {state.status === "ready" ? (
          <div className="result-card" aria-live="polite">
            <div className="result-icon">
              <CheckIcon />
            </div>
            <span className="eyebrow">მზადაა</span>
            <h2>Brand Brain-ის საფუძველი შეიქმნა</h2>
            <p>
              ინფორმაცია უსაფრთხოდ შევინახეთ. ახლა უკვე შეგვიძლია ბრენდისთვის
              პირველი კონტენტ-სტრატეგიის მომზადება.
            </p>
            <div className="readiness-list">
              {READINESS_ITEMS.map((item) => {
                const ready = state.result.minimumViableBrand[item.key]
                return (
                  <div className="readiness-item" key={item.key}>
                    <span className={ready ? "mini-check ready" : "mini-check"}>
                      {ready ? <CheckIcon /> : "!"}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="result-stats">
              <div>
                <strong>{state.result.evidenceCount}</strong>
                <span>დადასტურებული ჩანაწერი</span>
              </div>
              <div>
                <strong>{state.result.proposalCount}</strong>
                <span>Brand Brain-ის სიგნალი</span>
              </div>
            </div>
            <button className="secondary-button" type="button" disabled>
              შემდეგი: პირველი სტრატეგია
              <span>მალე</span>
            </button>
          </div>
        ) : (
          <div className="guide-card">
            <span className="eyebrow">რას მივიღებთ</span>
            <h2>კარგი კონტენტი ბრენდის გაგებით იწყება</h2>
            <p>
              ამ ოთხი მოკლე ნაწილის შემდეგ UNDA-ს ექნება საკმარისი საფუძველი,
              რომ თქვენი ბრენდის სახელით უსაფრთხოდ იმუშაოს.
            </p>
            <div className="guide-list">
              {READINESS_ITEMS.map((item, index) => (
                <div className="guide-item" key={item.key}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="safe-note">
              <span className="safe-note-icon" aria-hidden="true">✦</span>
              <p>
                <strong>ჯერ არაფერი გამოქვეყნდება.</strong>
                ყველა მომავალი პოსტი თქვენს დადასტურებას გაივლის.
              </p>
            </div>
          </div>
        )}
      </aside>
      </div>
    </>
  )
}
