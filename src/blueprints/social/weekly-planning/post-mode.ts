import { SOCIAL_CONTENT_MODES, type SocialContentMode } from "../tokens"
import { publicKnowledgeContext, type PublicKnowledgeSnapshot } from "../public-knowledge"
import type { PostCopy, PostOutline } from "./posts"

export const POST_CONTENT_MODES = Object.values(SOCIAL_CONTENT_MODES)
export const POST_MODE_LABELS: Record<string, string> = {
  [SOCIAL_CONTENT_MODES.brandStory]: "ბრენდის ამბავი", [SOCIAL_CONTENT_MODES.educational]: "საგანმანათლებლო",
  [SOCIAL_CONTENT_MODES.serviceExplainer]: "მომსახურების ახსნა", [SOCIAL_CONTENT_MODES.trustBuilder]: "ნდობის გაძლიერება",
  [SOCIAL_CONTENT_MODES.proofLed]: "მტკიცებულებაზე დაფუძნებული", [SOCIAL_CONTENT_MODES.directOffer]: "პირდაპირი შეთავაზება",
}
export function isPostContentMode(value: unknown): value is SocialContentMode { return POST_CONTENT_MODES.some(mode => mode === value) }
export function validatePostContentMode(post: PostOutline, snapshot?: PublicKnowledgeSnapshot, copy?: PostCopy): string[] {
  if (!isPostContentMode(post.contentMode)) return ["პოსტის მიზნის რეჟიმი ჯერ განსაზღვრული და შემოწმებული არ არის."]
  if (post.contentMode !== SOCIAL_CONTENT_MODES.proofLed) return []
  const proof = publicKnowledgeContext(snapshot, post.factKeys ?? []).eligibleProof
  if (!proof.length || (copy && !proof.some(p => copy.factualReferences?.proofKeys.includes(p.key) && p.supportsPublicFactKeys.some(k => copy.factualReferences?.factKeys.includes(k)))))
    return ["მტკიცებულებაზე დაფუძნებულ პოსტს შერჩეულ ფაქტთან დაკავშირებული მოქმედი საჯარო დასტური სჭირდება."]
  return []
}
