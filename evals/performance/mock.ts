import type { Interpretation } from "../../src/application/contextual-notes/model"
import type { PostCopy } from "../../src/blueprints/social/weekly-planning/posts"
import { editorialFixture } from "../../tests/weekly-posts-fixture"

/** Offline wiring demonstration; these fabricated answers are never model/quality evidence. */
export const mockContractFetch: typeof fetch = async (_url, init) => {
  const body = JSON.parse(init!.body as string), step = body.text.format.name.slice(6), input = JSON.parse(body.input)
  let output: unknown
  if (step === "contextual_notes") {
    const revision = !!input.selectedPost && !input.message.includes("ამიერიდან")
    const value: Interpretation = { statements: [{ quote: input.message, meaning: input.message, kind: revision ? "draft_correction" : "question", scope: revision ? "post" : "screen", actionable: revision }],
      response: "ეს იმიტირებული პასუხია ინსტრუმენტის შესამოწმებლად.", clarification: "", action: revision ? "revise_post" : "none", instruction: revision ? input.message : "", ambiguous: false, weeklyDirectives: null }
    output = value
  } else if (step === "contextual_post_revision") {
    const copy: PostCopy = structuredClone(input.current)
    copy.variants.find(variant => variant.channel === input.channel)!.caption = "ეს იმიტირებული მოკლე ტექსტია."
    output = copy
  } else if (step === "post_review") output = { summary: "იმიტირებული შეფასება", issues: [] }
  else if (step === "post_editorial") output = editorialFixture(input.posts.map((post: { postKey: string }) => post.postKey))
  else throw Error("UNKNOWN_MOCK_STEP")
  return Response.json({ status: "completed", model: body.model, output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }],
    usage: { input_tokens: 0, output_tokens: 0, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } })
}
