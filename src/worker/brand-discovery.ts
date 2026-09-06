import type { Pool } from "pg"
import { advanceDiscovery } from "../application/brand-discovery/advance"
import { createBrandReasoner } from "../infrastructure/models/brand-reasoning"
import { captureBrandWebsite } from "../infrastructure/web/website-discovery"
import { claimDiscovery, finishDiscoveryStep, failDiscoveryStep, recordDiscoveryModelRun } from "../infrastructure/postgres/brand-discovery-store"

export function discoveryErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ""
  if (message === "SOURCE_UNAVAILABLE") return "ვებსაიტი ვერ წავიკითხეთ. დაამატეთ ბიზნესის აღწერა ან გადაამოწმეთ მისამართი და სცადეთ ხელახლა."
  if (message === "AI_ANALYSIS_UNAVAILABLE") return "ბრენდის ღრმა ანალიზი დროებით მიუწვდომელია. თქვენი ინფორმაცია შენახულია; სცადეთ მოგვიანებით."
  if (message.startsWith("MODEL_CONTRACT")) return "მიღებული ანალიზი ხარისხის შემოწმებას ვერ აკმაყოფილებდა. დაუზუსტებელ შედეგს არ ვინახავთ დასრულებულად. შეგიძლიათ იგივე ეტაპი ხელახლა გაუშვათ."
  return "ეს ეტაპი ვერ დასრულდა. უკვე დამუშავებული ინფორმაცია შენახულია — ხელახალი ცდა აქედან გააგრძელებს."
}

/** Durable leases fence stale workers. Each stage is persisted before continuing. */
export async function runBrandDiscovery(pool: Pool, ownerId: string, id: string, budgetMs = 290_000): Promise<void> {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline - 185_000) {
    const claim = await claimDiscovery(pool, ownerId, id)
    if (!claim) return
    const { session, token } = claim
    try {
      const next = await advanceDiscovery(session, {
        capture: captureBrandWebsite,
        reason: createBrandReasoner((run) => recordDiscoveryModelRun(pool, session, run)),
      })
      if (!await finishDiscoveryStep(pool, session, token, next.payload, next.step) || next.step === "ready") return
    } catch (error) {
      // Provider responses, credentials and source material never enter user-visible errors.
      console.error("Brand discovery stage failed", { sessionId: id, step: session.step, error: error instanceof Error ? error.name : "unknown" })
      await failDiscoveryStep(pool, session, token, discoveryErrorMessage(error))
      return
    }
  }
}
