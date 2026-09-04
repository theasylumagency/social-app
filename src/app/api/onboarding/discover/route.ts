import {
  discoverWebsite,
  WebsiteDiscoveryError,
} from "../../../../infrastructure/web/website-discovery"

export const runtime = "nodejs"

const MAX_REQUEST_SIZE = 2_000

const ERROR_MESSAGES: Record<WebsiteDiscoveryError["code"], string> = {
  invalidUrl: "ვებგვერდის მისამართი არასწორია",
  privateAddress: "ამ მისამართის შემოწმება უსაფრთხოების გამო შეუძლებელია",
  unreachable: "ვებგვერდთან დაკავშირება ვერ მოხერხდა",
  notHtml: "მითითებულ მისამართზე ვებგვერდი ვერ ვიპოვეთ",
  unsupportedImage: "ვებგვერდის გამოსახულების ფორმატი არ არის მხარდაჭერილი",
  tooLarge: "ვებგვერდი ავტომატური ანალიზისთვის ზედმეტად დიდია",
  tooManyRedirects: "ვებგვერდი ძალიან ბევრ სხვა მისამართზე გადაგვამისამართებს",
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  if (rawBody.length > MAX_REQUEST_SIZE) {
    return Response.json({ message: "მოთხოვნა ზედმეტად დიდია" }, { status: 413 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json({ message: "მონაცემების ფორმატი არასწორია" }, { status: 400 })
  }
  if (
    payload === null ||
    typeof payload !== "object" ||
    !("websiteUrl" in payload) ||
    typeof payload.websiteUrl !== "string"
  ) {
    return Response.json({ message: "მიუთითეთ ვებგვერდის მისამართი" }, { status: 422 })
  }

  try {
    const result = await discoverWebsite(payload.websiteUrl)
    return Response.json({ result })
  } catch (error) {
    if (error instanceof WebsiteDiscoveryError) {
      return Response.json({ message: ERROR_MESSAGES[error.code] }, { status: 422 })
    }
    console.error("Website discovery failed", error)
    return Response.json(
      { message: "ვებგვერდის დამუშავება ვერ დასრულდა" },
      { status: 503 },
    )
  }
}
