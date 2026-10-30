import { randomUUID } from "node:crypto"
import type { BrandReasoner } from "../../infrastructure/models/brand-reasoning"
import { CREATIVE_EXPLORATION_SCHEMA, validateCreativeProposal, type CreativeExploration, type CreativeInput, type CreativeProposal } from "../../blueprints/social/creative/model"
import { CREATIVE_EXPLORATION_PROMPT } from "../../blueprints/social/creative/prompts"

export async function exploreCreativeDirections(input: CreativeInput, reason: BrandReasoner): Promise<CreativeExploration> {
  const result = await reason<CreativeProposal>({ step: "creative_exploration", version: "creative-exploration-v1", prompt: CREATIVE_EXPLORATION_PROMPT, input, schema: CREATIVE_EXPLORATION_SCHEMA, validate: value => validateCreativeProposal(value as CreativeProposal, input) })
  return { id: randomUUID(), input, directions: result.directions.map((direction, i) => ({ ...direction, key: `c${i + 1}` })) }
}
