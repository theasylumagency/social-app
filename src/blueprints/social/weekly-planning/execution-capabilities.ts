import type { PostSchedule } from "./posts"

/** Formats the current upload and scheduling workflow can actually complete. */
export const WEEKLY_EXECUTION_CAPABILITIES = {
  channelsAreRecommendations: true,
  supportedFormatsByChannel: { facebook: ["text", "image", "carousel", "story"], instagram: ["image", "carousel", "story"] },
  founderUploadAvailable: true,
  imageGeneration: "whenConfigured",
  videoUploadAvailable: false,
  publication: "requiresApprovalConnectedAccountAndMedia",
} as const

export function validateExecutionCapabilities(schedule: PostSchedule) {
  return schedule.posts.flatMap((post, i) => post.channels.flatMap(({ channel }) =>
    (WEEKLY_EXECUTION_CAPABILITIES.supportedFormatsByChannel[channel] as readonly string[]).includes(post.format) ? [] : [`p${i + 1}: ${post.format} cannot be completed on ${channel} in this workflow`]))
}
