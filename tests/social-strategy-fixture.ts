import { randomUUID } from "node:crypto"
import type { BrandDossier } from "../src/blueprints/social/brand-discovery/model"
import type { SocialStrategy, SocialStrategyProposal } from "../src/blueprints/social/strategy/model"

export function strategyProposal(): SocialStrategyProposal {
  return {
    objective: "ნივთის მფლობელმა შეკეთების არჩევანი რეალური შეფასების საზღვრებს დაუკავშიროს.",
    rationale: "სახელოსნო ნივთის შენარჩუნებაზე მუშაობს; ფოტოების შეფასების შესაძლებლობა და ადგილზე დასაზუსტებელი ნაწილი უნდა გაიმიჯნოს.", horizon: "4–6 კვირა, ახალი მტკიცებულებით გადასახედი",
    reconnaissance: ["facebook", "instagram"].map((channel) => ({ channel, status: "unknown", observation: "საჯარო გვერდი ვერ დავადგინეთ.", sourceUrl: null, excerpt: null })),
    channels: [{ channel: "facebook", action: "add", role: "შეფასების პროცესის ახსნა", reason: "შეკეთების არჩევანის წინ მყოფ მფლობელს კითხვა-პასუხი სჭირდება; არსებული აქტივობა უცნობია." }, { channel: "instagram", action: "add", role: "ნივთის მდგომარეობისა და ხელობის ჩვენება", reason: "სახელოსნოს ფაქტურის შენარჩუნება ახლო ვიზუალურ დეტალს მოითხოვს; ნიმუშები მხოლოდ რეალური წყაროდან." }],
    plan: { audienceChange: "მფლობელმა გაიგოს შეფასების საზღვრები", barriers: ["გარანტიის მოლოდინი შეფასების გარეშე"], proofNeeds: ["რეალური სამუშაოს ავტორიზებული ფოტოები"], contentRoles: ["შეფასების შესაძლებლობის ახსნა"], journey: "დაზიანების გაცნობიდან შეფასების პროცესის გაგებამდე", commercialBridge: "ფოტოების გამოგზავნის მშვიდი მოწვევა", mustNotClaim: ["შეკეთების გარანტია შეფასების გარეშე"] },
    measurement: [{ level: "public", signal: "კომენტარებში შეფასების შესახებ კონკრეტული კითხვები", interpretation: "შინაარსობრივი სიგნალია, არა გაყიდვის მტკიცებულება." }, { level: "connected", signal: "რეალური შენახვები და გაზიარებები", interpretation: "მხოლოდ დაკავშირებული ანგარიშის მონაცემის მიღების შემდეგ." }],
  }
}
export function approvedStrategy(basis: BrandDossier, brandId = `brand:${basis.sessionId}`, ownerId = "owner"): SocialStrategy {
  return { id: randomUUID(), brandId, ownerId, revision: 1, status: "approved", error: null, createdAt: "2026-09-06T10:00:00.000Z", updatedAt: "2026-09-06T10:00:00.000Z", payload: { basis, sources: [], proposal: strategyProposal(), previousProposal: null, reason: null, comment: "", approvedAt: "2026-09-06T10:00:00.000Z" } }
}
