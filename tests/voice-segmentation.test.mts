import assert from "node:assert/strict"
import test from "node:test"
import { OrderedTranscript, VoiceSegmenter } from "../src/app/workspace/voice-segmentation"

function speak(segmenter: VoiceSegmenter, at: number) {
  assert.deepEqual(segmenter.sample(0.12, at), [])
  return segmenter.sample(0.12, at + 200)
}

test("speech followed by 800ms silence commits exactly one segment", () => {
  const segmenter = new VoiceSegmenter(0)
  assert.deepEqual(speak(segmenter, 300), ["speech"])
  assert.deepEqual(segmenter.sample(0.001, 900), [])
  assert.deepEqual(segmenter.sample(0.001, 1_700), ["commit"])
  assert.deepEqual(segmenter.sample(0.001, 1_900), [])
})
test("background noise does not create a segment and a silent session stops", () => {
  const segmenter = new VoiceSegmenter(0)
  for (const at of [0, 500, 1_000, 2_000, 5_999]) assert.deepEqual(segmenter.sample(0.02, at), [])
  assert.deepEqual(segmenter.sample(0.02, 6_000), ["stop"])
})
test("speech resets the six-second auto-stop clock", () => {
  const segmenter = new VoiceSegmenter(0)
  assert.deepEqual(speak(segmenter, 5_000), ["speech"])
  assert.deepEqual(segmenter.sample(0.001, 6_000), [])
  assert.deepEqual(segmenter.sample(0.001, 10_999), ["commit"])
  assert.deepEqual(segmenter.sample(0.001, 11_200), ["stop"])
})
test("long uninterrupted speech commits at the hard segment boundary", () => {
  const segmenter = new VoiceSegmenter(0)
  assert.deepEqual(speak(segmenter, 300), ["speech"])
  assert.deepEqual(segmenter.sample(0.12, 8_000), ["commit"])
})
test("completed transcripts are emitted in recording order without duplicates", () => {
  const transcript = new OrderedTranscript()
  assert.deepEqual(transcript.accept(1, "მეორე"), [])
  assert.deepEqual(transcript.accept(0, "პირველი"), [{ text: "პირველი", sameSession: false }, { text: "მეორე", sameSession: true }])
  assert.deepEqual(transcript.accept(1, "დუბლიკატი"), [])
})
