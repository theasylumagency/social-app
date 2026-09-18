"use client"

import { useEffect, useRef, useState } from "react"
import { OrderedTranscript, VoiceSegmenter } from "./voice-segmentation"

type Phase = "idle" | "permission" | "recording" | "finishing"
type Segment = { recorder: MediaRecorder; index: number; chunks: Blob[]; hasSpeech: boolean }
type Session = {
  id: string; stream: MediaStream; audio: AudioContext; analyser: AnalyserNode; values: Uint8Array<ArrayBuffer>; segmenter: VoiceSegmenter
  current: Segment | null; accepting: boolean; failed: boolean; nextIndex: number; transcript: OrderedTranscript
  pending: Map<number, AbortController>; pendingStops: number; frame: number; timer: ReturnType<typeof setTimeout> | null
}

const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
const MIME_EXTENSION: Record<string, string> = { "audio/mp4": "mp4", "audio/ogg": "ogg" }

export function VoiceNoteInput({ available, disabled, onTranscript, onBusy, onError }: { available: boolean; disabled: boolean; onTranscript: (text: string, sameSession: boolean) => void; onBusy: (busy: boolean) => void; onError: (message: string) => void }) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [supported, setSupported] = useState(false)
  const session = useRef<Session | null>(null)
  const mounted = useRef(true)
  const callbacks = useRef({ onTranscript, onBusy, onError })
  useEffect(() => { callbacks.current = { onTranscript, onBusy, onError } }, [onTranscript, onBusy, onError])
  useEffect(() => {
    mounted.current = true
    queueMicrotask(() => { if (mounted.current) setSupported(!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") })
    return () => {
      mounted.current = false
      if (session.current) finish(session.current, true)
    }
    // finish only reads refs, which stay current without re-subscribing this lifecycle effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function current(value: Session) { return mounted.current && session.current === value }
  function cleanup(value: Session) {
    cancelAnimationFrame(value.frame)
    if (value.timer) clearTimeout(value.timer)
    value.stream.getTracks().forEach(track => track.stop())
    void value.audio.close().catch(() => {})
  }

  function complete(value: Session) {
    if (!current(value) || value.current || value.pendingStops || value.pending.size) return
    session.current = null
    setPhase("idle")
    callbacks.current.onBusy(false)
  }

  async function upload(value: Session, index: number, blob: Blob) {
    if (!current(value) || value.failed) return
    const abort = new AbortController()
    value.pending.set(index, abort)
    try {
      const data = new FormData()
      const extension = MIME_EXTENSION[blob.type] ?? "webm"
      data.set("audio", blob, `note.${extension}`)
      data.set("voiceSessionId", value.id)
      data.set("segmentIndex", String(index))
      const response = await fetch("/api/contextual-notes/transcribe", { method: "POST", body: data, signal: abort.signal })
      const result = await response.json() as { text?: unknown; message?: string }
      if (!response.ok || typeof result.text !== "string") throw Error(result.message ?? "ხმის ამოცნობა ვერ დასრულდა.")
      if (!current(value) || value.failed) return
      for (const item of value.transcript.accept(index, result.text)) if (current(value)) callbacks.current.onTranscript(item.text, item.sameSession)
    } catch (error) {
      if (current(value) && !abort.signal.aborted && !value.failed) {
        value.failed = true
        callbacks.current.onError(error instanceof Error ? error.message : "ხმის ამოცნობა ვერ დასრულდა. სცადეთ ხელახლა ან დაწერეთ ტექსტი.")
        finish(value, true)
      }
    } finally {
      value.pending.delete(index)
      complete(value)
    }
  }

  function stopSegment(value: Session, continueRecording: boolean, discard = false) {
    const segment = value.current
    if (!segment) return
    if (segment.recorder.state !== "recording") { value.current = null; complete(value); return }
    value.current = null
    value.pendingStops++
    segment.recorder.onstop = () => {
      value.pendingStops--
      const blob = new Blob(segment.chunks, { type: segment.recorder.mimeType.split(";")[0] || "audio/webm" })
      if (!discard && segment.hasSpeech && blob.size && blob.size <= MAX_AUDIO_BYTES) void upload(value, segment.index, blob)
      else if (!discard && segment.hasSpeech && current(value)) {
        value.failed = true
        callbacks.current.onError("ჩანაწერი ცარიელია ან 8 MB-ს აღემატება. სცადეთ უფრო მოკლე ჩანაწერი.")
        finish(value, true)
      }
      if (continueRecording && value.accepting && current(value) && !value.failed) startSegment(value)
      complete(value)
    }
    segment.recorder.stop()
  }

  function startSegment(value: Session) {
    if (!current(value) || !value.accepting) return
    const mimeType = MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type))
    const recorder = new MediaRecorder(value.stream, mimeType ? { mimeType } : undefined)
    const segment: Segment = { recorder, index: value.nextIndex++, chunks: [], hasSpeech: false }
    value.current = segment
    recorder.ondataavailable = event => { if (event.data.size) segment.chunks.push(event.data) }
    recorder.onerror = () => {
      if (current(value) && !value.failed) {
        value.failed = true
        callbacks.current.onError("ჩაწერა შეწყდა. სცადეთ ხელახლა ან დაწერეთ ტექსტი.")
        finish(value, true)
      }
    }
    recorder.start()
  }

  function finish(value: Session, discard = false) {
    if (!value.accepting) return
    value.accepting = false
    for (const controller of value.pending.values()) if (discard) controller.abort()
    stopSegment(value, false, discard)
    cleanup(value)
    if (current(value)) setPhase("finishing")
    complete(value)
  }

  function energy(analyser: AnalyserNode, values: Uint8Array<ArrayBuffer>) {
    analyser.getByteTimeDomainData(values)
    let sum = 0
    for (const sample of values) { const amplitude = (sample - 128) / 128; sum += amplitude * amplitude }
    return Math.sqrt(sum / values.length)
  }

  function monitor(value: Session) {
    if (!current(value) || !value.accepting) return
    const actions = value.segmenter.sample(energy(value.analyser, value.values), performance.now())
    for (const action of actions) {
      if (action === "speech" && value.current) value.current.hasSpeech = true
      if (action === "commit" && value.current) {
        stopSegment(value, false)
        startSegment(value)
        value.segmenter.nextSegment(performance.now())
      }
      if (action === "stop") finish(value)
    }
    if (value.accepting) value.frame = requestAnimationFrame(() => monitor(value))
  }

  function stop() { if (session.current?.accepting) finish(session.current) }
  async function start() {
    if (phase !== "idle" || disabled) return
    setPhase("permission"); callbacks.current.onBusy(true); callbacks.current.onError("")
    let media: MediaStream | null = null
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return }
      const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextConstructor) throw Error("აუდიოს დამუშავება ამ ბრაუზერში მიუწვდომელია.")
      const audio = new AudioContextConstructor()
      const analyser = audio.createAnalyser(); analyser.fftSize = 1024
      audio.createMediaStreamSource(media).connect(analyser)
      await audio.resume()
      const startedAt = performance.now()
      const value: Session = { id: crypto.randomUUID(), stream: media, audio, analyser, values: new Uint8Array(new ArrayBuffer(analyser.fftSize)), segmenter: new VoiceSegmenter(startedAt), current: null, accepting: true, failed: false, nextIndex: 0, transcript: new OrderedTranscript(), pending: new Map(), pendingStops: 0, frame: 0, timer: null }
      session.current = value
      startSegment(value)
      value.timer = setTimeout(() => finish(value), 90_000)
      setPhase("recording")
      monitor(value)
    } catch {
      media?.getTracks().forEach(track => track.stop())
      if (session.current?.accepting) finish(session.current, true)
      if (mounted.current) { setPhase("idle"); callbacks.current.onBusy(false); callbacks.current.onError("მიკროფონთან წვდომა ვერ მივიღეთ. დაუშვით მიკროფონი ბრაუზერში ან დაწერეთ ტექსტი.") }
    }
  }
  const active = phase === "recording"
  return <div className="cn-voice"><button type="button" className={active ? "is-recording" : ""} disabled={disabled || !available || !supported || phase === "permission" || phase === "finishing"} onClick={() => active ? stop() : void start()} title={!available ? "ხმის შეყვანა ჯერ არ არის გამართული" : !supported ? "ამ ბრაუზერში ხმის ჩაწერა მიუწვდომელია" : "თქვით ბუნებრივად; გაჩერების შემდეგ ტექსტი გამოჩნდება"} aria-label={active ? "ჩაწერის დასრულება" : "შენიშვნის ხმით თქმა"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></svg>{active ? "გისმენთ…" : phase === "finishing" ? "ვშიფრავთ…" : phase === "permission" ? "მიკროფონი…" : "გვითხარით"}</button><span className="cn-voice-status" role="status">{active ? "პაუზის შემდეგ ტექსტი გამოჩნდება" : phase === "finishing" ? "ვშიფრავთ…" : !available ? "ხმა ჯერ არ არის გამართული" : ""}</span></div>
}
