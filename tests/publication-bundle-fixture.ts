import facebook from "./fixtures/publication-v1-facebook.json"
import instagram from "./fixtures/publication-v1-instagram.json"
import type { SocialPublicationBundleV1 } from "../src/application/publishing/publication-bundle-codec"
/** Frozen historical inputs, captured before the version-two implementation. */
export function approvedPublicationFixture(channel: "facebook" | "instagram" = "facebook") {
  const input = structuredClone(channel === "facebook" ? facebook : instagram)
  return { ...input, bundle: input.bundle as unknown as SocialPublicationBundleV1 }
}
