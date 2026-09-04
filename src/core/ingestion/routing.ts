import type { EvidenceRouting, EvidenceRoutingTarget } from "../domain"
import type { MaterializedEvidence } from "./evidence"

export type EvidenceRoutingResolver = (
  item: MaterializedEvidence,
) => readonly EvidenceRoutingTarget[]

export type RouteEvidenceInput = {
  readonly items: readonly MaterializedEvidence[]
  readonly routingVersion: string
  readonly resolveTargets: EvidenceRoutingResolver
}

const UNMAPPED_TARGET = {
  target: { kind: "unmapped" },
  support: "weak",
} as const satisfies EvidenceRoutingTarget

export function routeEvidence({
  items,
  routingVersion,
  resolveTargets,
}: RouteEvidenceInput): readonly EvidenceRouting[] {
  if (routingVersion.trim().length === 0) {
    throw new RangeError("Evidence routingVersion cannot be empty")
  }

  return items.map((item) => {
    const resolvedTargets = resolveTargets(item)
    const targets =
      resolvedTargets.length === 0 ? ([UNMAPPED_TARGET] as const) : resolvedTargets

    return {
      evidenceId: item.evidence.id,
      routingVersion,
      targets,
    }
  })
}
