import type { WeeklyDirectiveProposal } from "../../blueprints/social/weekly-planning/instruction-contract"

export { WEEKLY_DIRECTIVES_SCHEMA, validateWeeklyDirectives, bindWeeklyDirectives, validateDirectiveSchedule,
  weeklyRevisionInstruction, type BoundWeeklyDirectives, type WeeklyDirectiveProposal } from "../../blueprints/social/weekly-planning/instruction-contract"

/** Implementations suggest meanings; application context and review own every mutation. */
export type WeeklyDirectiveInterpreter = (request: { text: string; selectedWeek: string }) => Promise<WeeklyDirectiveProposal | null>
