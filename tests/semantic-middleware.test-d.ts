import type { SemanticObservation } from "../src/core/domain/semantic-observation"
import type { Phase7aClaim, Phase7aObservation } from "../src/blueprints/social/semantic-middleware/contract"
import { projectSemanticFactMatches } from "../src/blueprints/social/semantic-middleware/projections"

declare const unchecked: Phase7aObservation
// @ts-expect-error A projection requires structural validation, not just a type assertion to the raw contract.
projectSemanticFactMatches(unchecked)

// New operator families extend the generic boundary without entering social Phase 7A.
type FutureOperatorObservation = SemanticObservation<{ readonly type: "futureOperatorFamily"; readonly argument: string }>
// @ts-expect-error Opening hours are not an implemented Phase 7A family.
const outsideSlice: Phase7aClaim = { type: "openingHours", schedule: { state: "known", value: "09:00–18:00" } }
