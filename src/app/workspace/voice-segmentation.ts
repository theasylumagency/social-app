export const VOICE_SILENCE = {
  minimumEnergy: 0.012,
  noiseMultiplier: 3,
  speechConfirmationMs: 180,
  sessionSilenceMs: 6_000,
} as const

/** Browser-independent silence timer; it deliberately never controls recorder segmentation. */
export class VoiceSilenceDetector {
  private noiseFloor = 0
  private candidateSince: number | null = null
  private lastActivityAt: number
  private readonly calibrationEndsAt: number

  constructor(startedAt: number, private readonly tuning = VOICE_SILENCE) {
    this.lastActivityAt = startedAt
    this.calibrationEndsAt = startedAt + 250
  }

  sample(energy: number, at: number): "continue" | "stop" {
    if (at < this.calibrationEndsAt) {
      this.noiseFloor = this.noiseFloor === 0 ? energy : this.noiseFloor * 0.8 + energy * 0.2
      return "continue"
    }
    const threshold = Math.max(this.tuning.minimumEnergy, this.noiseFloor * this.tuning.noiseMultiplier)
    if (energy >= threshold) {
      if (this.candidateSince === null) this.candidateSince = at
      if (at - this.candidateSince >= this.tuning.speechConfirmationMs) this.lastActivityAt = at
    } else {
      this.noiseFloor = this.noiseFloor === 0 ? energy : this.noiseFloor * 0.95 + energy * 0.05
      this.candidateSince = null
    }
    return at - this.lastActivityAt >= this.tuning.sessionSilenceMs ? "stop" : "continue"
  }
}
