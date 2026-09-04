import { SOCIAL_OPERATOR_DEFAULTS, SOCIAL_FALLBACK_POLICIES } from "./defaults"
import { SOCIAL_EXTRACTION_PROFILES } from "./extraction"
import { SOCIAL_KNOWLEDGE_PATH_POLICIES } from "./knowledge-paths"
import {
  SOCIAL_CHANNEL_POLICIES,
  SOCIAL_CONTENT_MODE_POLICIES,
  SOCIAL_TASK_POLICIES,
} from "./operations"
import { SOCIAL_QUALITY_POLICIES } from "./quality"
import { SOCIAL_GEORGIAN_CLAIM_LEXICON } from "./validation"

export const SOCIAL_BLUEPRINT = {
  id: "social",
  version: "1",
  knowledgePaths: SOCIAL_KNOWLEDGE_PATH_POLICIES,
  extractionProfiles: SOCIAL_EXTRACTION_PROFILES,
  taskPolicies: SOCIAL_TASK_POLICIES,
  contentModePolicies: SOCIAL_CONTENT_MODE_POLICIES,
  channelPolicies: SOCIAL_CHANNEL_POLICIES,
  defaults: SOCIAL_OPERATOR_DEFAULTS,
  fallbackPolicies: SOCIAL_FALLBACK_POLICIES,
  qualityPolicies: SOCIAL_QUALITY_POLICIES,
  claimLexicon: SOCIAL_GEORGIAN_CLAIM_LEXICON,
} as const
