import assert from "node:assert/strict"
import test from "node:test"
import { VoiceSilenceDetector } from "../src/app/workspace/voice-segmentation"

function speak(detector: VoiceSilenceDetector, at: number) {
  assert.equal(detector.sample(0.12, at), "continue")
  assert.equal(detector.sample(0.12, at + 200), "continue")
}

test("short pauses do not stop a full recording, while speech resets silence", () => {
  const detector = new VoiceSilenceDetector(0)
  speak(detector, 300)
  assert.equal(detector.sample(0.001, 3_399), "continue")
  speak(detector, 3_400)
  assert.equal(detector.sample(0.001, 6_599), "continue")
})
test("continuous silence stops a no-speech or completed recording after three seconds", () => {
  const silent = new VoiceSilenceDetector(0)
  assert.equal(silent.sample(0.02, 0), "continue")
  assert.equal(silent.sample(0.02, 2_999), "continue")
  assert.equal(silent.sample(0.02, 3_000), "stop")
  const spoken = new VoiceSilenceDetector(0)
  speak(spoken, 300)
  assert.equal(spoken.sample(0.001, 3_499), "continue")
  assert.equal(spoken.sample(0.001, 3_500), "stop")
})
