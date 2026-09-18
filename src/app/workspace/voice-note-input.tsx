"use client"

import { useEffect, useRef, useState } from "react"
import { VoiceSilenceDetector } from "./voice-segmentation"

type Phase = "idle" | "permission" | "recording" | "transcribing"
type Session = {
  stream: MediaStream; audio: AudioContext; analyser: AnalyserNode; values: Uint8Array<ArrayBuffer>; recorder: MediaRecorder; chunks: Blob[]
  detector: VoiceSilenceDetector; accepting: boolean; discard: boolean; frame: number; timer: ReturnType<typeof setTimeout> | null; controller: AbortController | null
}
const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
const MIME_EXTENSION: Record<string, string> = { "audio/mp4": "mp4", "audio/ogg": "ogg" }

export function VoiceNoteInput({ available, disabled, hasVoiceDraft, onTranscript, onBusy, onError }: { available: boolean; disabled: boolean; hasVoiceDraft: boolean; onTranscript: (text: string) => void; onBusy: (busy: boolean) => void; onError: (message: string) => void }) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [supported, setSupported] = useState(false)
  const session = useRef<Session | null>(null)
  const mounted = useRef(true)
  const callbacks = useRef({ onTranscript, onBusy, onError })
  useEffect(() => { callbacks.current = { onTranscript, onBusy, onError } }, [onTranscript, onBusy, onError])
  useEffect(() => {
    mounted.current = true
    queueMicrotask(() => { if (mounted.current) setSupported(!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") })
    return () => { mounted.current = false; if (session.current) finish(session.current, true) }
    // finish uses refs so this lifecycle effect stays stable.
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
    if (!current(value)) return
    session.current = null
    setPhase("idle")
    callbacks.current.onBusy(false)
  }
  function energy(analyser: AnalyserNode, values: Uint8Array<ArrayBuffer>) {
    analyser.getByteTimeDomainData(values)
    let sum = 0
    for (const sample of values) { const amplitude = (sample - 128) / 128; sum += amplitude * amplitude }
    return Math.sqrt(sum / values.length)
  }
  function monitor(value: Session) {
    if (!current(value) || !value.accepting) return
    if (value.detector.sample(energy(value.analyser, value.values), performance.now()) === "stop") finish(value)
    if (value.accepting) value.frame = requestAnimationFrame(() => monitor(value))
  }
  async function transcribe(value: Session) {
    const blob = new Blob(value.chunks, { type: value.recorder.mimeType.split(";")[0] || "audio/webm" })
    if (!blob.size || blob.size > MAX_AUDIO_BYTES) throw Error("ჩანაწერი ცარიელია ან 8 MB-ს აღემატება. სცადეთ უფრო მოკლე ჩანაწერი.")
    const controller = new AbortController(); value.controller = controller
    const data = new FormData()
    data.set("audio", blob, `note.${MIME_EXTENSION[blob.type] ?? "webm"}`)
    const response = await fetch("/api/contextual-notes/transcribe", { method: "POST", body: data, signal: controller.signal })
    const result = await response.json() as { text?: unknown; message?: string }
    if (!response.ok || typeof result.text !== "string") throw Error(result.message ?? "ხმის ამოცნობა ვერ დასრულდა.")
    if (current(value)) callbacks.current.onTranscript(result.text)
  }
  function finish(value: Session, discard = false) {
    if (!value.accepting) { if (discard) value.controller?.abort(); return }
    value.accepting = false; value.discard = discard
    if (value.recorder.state === "recording") value.recorder.stop()
    cleanup(value)
    if (current(value)) setPhase(discard ? "idle" : "transcribing")
  }
  function fail(value: Session, message: string) {
    if (!value.accepting) return
    callbacks.current.onError(message)
    finish(value, true)
    complete(value)
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
      const mimeType = MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
      const startedAt = performance.now()
      const value: Session = { stream: media, audio, analyser, values: new Uint8Array(new ArrayBuffer(analyser.fftSize)), recorder, chunks: [], detector: new VoiceSilenceDetector(startedAt), accepting: true, discard: false, frame: 0, timer: null, controller: null }
      session.current = value
      recorder.ondataavailable = event => { if (event.data.size) value.chunks.push(event.data) }
      recorder.onerror = () => fail(value, "ჩაწერა შეწყდა. სცადეთ ხელახლა ან დაწერეთ ტექსტი.")
      recorder.onstop = () => {
        if (!current(value) || value.discard) { complete(value); return }
        void transcribe(value).catch(error => {
          if (current(value) && !value.controller?.signal.aborted) callbacks.current.onError(error instanceof Error ? error.message : "ხმის ამოცნობა ვერ დასრულდა. სცადეთ ხელახლა ან დაწერეთ ტექსტი.")
        }).finally(() => complete(value))
      }
      recorder.start(1000)
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
  const label = active ? "გისმენთ…" : phase === "transcribing" ? "ვშიფრავთ…" : phase === "permission" ? "მიკროფონი…" : hasVoiceDraft ? "გააგრძელეთ" : "გვითხარით"
  return <div className="cn-voice"><button type="button" className={active ? "is-recording" : ""} disabled={disabled || !available || !supported || phase === "permission" || phase === "transcribing"} onClick={() => active ? stop() : void start()} title={!available ? "ხმის შეყვანა ჯერ არ არის გამართული" : !supported ? "ამ ბრაუზერში ხმის ჩაწერა მიუწვდომელია" : "თქვით ბუნებრივად; გაჩერების შემდეგ ტექსტი გამოჩნდება"} aria-label={active ? "ჩაწერის დასრულება" : "შენიშვნის ხმით თქმა"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></svg>{label}</button><span className="cn-voice-status" role="status">{active ? "გისმენთ…" : phase === "transcribing" ? "ვშიფრავთ…" : !available ? "ხმა ჯერ არ არის გამართული" : ""}</span></div>
}
