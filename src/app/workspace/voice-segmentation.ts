export const VOICE_SEGMENTATION = {
  minimumEnergy: 0.012,
  noiseMultiplier: 3,
  speechConfirmationMs: 180,
  pauseMs: 800,
  sessionSilenceMs: 6_000,
  hardSegmentMs: 8_000,
} as const

export type VoiceSegmentationAction = "speech" | "commit" | "stop"

export class OrderedTranscript {
  private next = 0
  private readonly waiting = new Map<number, string>()

  accept(index: number, text: string) {
    if (index < this.next || this.waiting.has(index)) return []
    this.waiting.set(index, text)
    const ready: { text: string; sameSession: boolean }[] = []
    while (this.waiting.has(this.next)) {
      ready.push({ text: this.waiting.get(this.next)!, sameSession: this.next > 0 })
      this.waiting.delete(this.next++)
    }
    return ready
  }
}

/** Browser-independent timing policy for one microphone session. */
export class VoiceSegmenter {
  private noiseFloor = 0
  private candidateSince: number | null = null
  private silenceSince: number | null = null
  private speechActive = false
  private segmentHasSpeech = false
  private segmentStartedAt: number
  private lastActivityAt: number
  private readonly calibrationEndsAt: number

  constructor(startedAt: number, private readonly tuning = VOICE_SEGMENTATION) {
    this.segmentStartedAt = startedAt
    this.lastActivityAt = startedAt
    this.calibrationEndsAt = startedAt + 250
  }

  nextSegment(at: number) {
    this.segmentStartedAt = at
    this.segmentHasSpeech = false
  }

  sample(energy: number, at: number): VoiceSegmentationAction[] {
    if (at < this.calibrationEndsAt) {
      this.noiseFloor = this.noiseFloor === 0 ? energy : this.noiseFloor * 0.8 + energy * 0.2
      return []
    }
    const threshold = Math.max(this.tuning.minimumEnergy, this.noiseFloor * this.tuning.noiseMultiplier)
    const audible = energy >= threshold
    const actions: VoiceSegmentationAction[] = []

    if (audible) {
      this.lastActivityAt = at
      this.silenceSince = null
      if (this.candidateSince === null) this.candidateSince = at
      if (!this.speechActive && at - this.candidateSince >= this.tuning.speechConfirmationMs) {
        this.speechActive = true
        this.segmentHasSpeech = true
        actions.push("speech")
      }
    } else {
      this.noiseFloor = this.noiseFloor === 0 ? energy : this.noiseFloor * 0.95 + energy * 0.05
      this.candidateSince = null
      if (this.speechActive) {
        if (this.silenceSince === null) this.silenceSince = at
        if (at - this.silenceSince >= this.tuning.pauseMs) {
          this.speechActive = false
          actions.push("commit")
        }
      }
    }

    if (this.speechActive && this.segmentHasSpeech && at - this.segmentStartedAt >= this.tuning.hardSegmentMs) actions.push("commit")
    if (at - this.lastActivityAt >= this.tuning.sessionSilenceMs) actions.push("stop")
    return actions
  }
}
