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
  assert.equal(detector.sample(0.001, 5_999), "continue")
  speak(detector, 6_000)
  assert.equal(detector.sample(0.001, 11_999), "continue")
})
test("continuous silence stops a no-speech or completed recording after six seconds", () => {
  const silent = new VoiceSilenceDetector(0)
  assert.equal(silent.sample(0.02, 0), "continue")
  assert.equal(silent.sample(0.02, 6_000), "stop")
  const spoken = new VoiceSilenceDetector(0)
  speak(spoken, 300)
  assert.equal(spoken.sample(0.001, 6_500), "stop")
})
