"use client"

import { useEffect, useRef, useState } from "react"

export function VoiceNoteInput({ available, disabled, onTranscript, onBusy, onError }: { available: boolean; disabled: boolean; onTranscript: (text: string) => void; onBusy: (busy: boolean) => void; onError: (message: string) => void }) {
  const [phase, setPhase] = useState<"idle" | "permission" | "recording" | "transcribing">("idle")
  const [supported, setSupported] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const cancelled = useRef(false)
  const callbacks = useRef({ onTranscript, onBusy, onError })
  useEffect(() => { callbacks.current = { onTranscript, onBusy, onError } }, [onTranscript, onBusy, onError])
  useEffect(() => {
    mounted.current = true
    queueMicrotask(() => { if (mounted.current) setSupported(!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") })
    return () => {
      mounted.current = false; cancelled.current = true
      if (timer.current) clearTimeout(timer.current)
      controller.current?.abort()
      if (recorder.current?.state === "recording") recorder.current.stop()
      stream.current?.getTracks().forEach(track => track.stop())
    }
  }, [])
  function stop(cancel = false) {
    cancelled.current = cancel
    if (timer.current) clearTimeout(timer.current)
    if (recorder.current?.state === "recording") recorder.current.stop()
    stream.current?.getTracks().forEach(track => track.stop())
  }
  async function start() {
    if (phase !== "idle" || disabled) return
    setPhase("permission"); callbacks.current.onBusy(true); callbacks.current.onError(""); cancelled.current = false
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return }
      stream.current = media
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type))
      const current = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
      recorder.current = current
      const chunks: Blob[] = []; let size = 0
      current.ondataavailable = event => { if (event.data.size) { size += event.data.size; chunks.push(event.data); if (size > 8 * 1024 * 1024) stop() } }
      current.onerror = () => { callbacks.current.onError("ჩაწერა შეწყდა. სცადეთ ხელახლა ან დაწერეთ ტექსტი."); stop(true) }
      current.onstop = async () => {
        media.getTracks().forEach(track => track.stop())
        if (timer.current) clearTimeout(timer.current)
        if (!mounted.current) return
        if (cancelled.current) { setPhase("idle"); callbacks.current.onBusy(false); return }
        setPhase("transcribing")
        const abort = new AbortController(); controller.current = abort
        try {
          const blob = new Blob(chunks, { type: current.mimeType.split(";")[0] ?? "audio/webm" })
          if (!blob.size || blob.size > 8 * 1024 * 1024) throw Error("ჩანაწერი ცარიელია ან 8 MB-ს აღემატება. სცადეთ უფრო მოკლე ჩანაწერი.")
          const data = new FormData(); data.set("audio", blob, `note.${blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm"}`)
          const response = await fetch("/api/contextual-notes/transcribe", { method: "POST", body: data, signal: abort.signal })
          const result = await response.json()
          if (!response.ok) throw Error(result.message)
          if (mounted.current) callbacks.current.onTranscript(result.text)
        } catch (error) { if (mounted.current && !abort.signal.aborted) callbacks.current.onError(error instanceof Error ? error.message : "ხმის ამოცნობა ვერ დასრულდა.") }
        finally { if (mounted.current) { setPhase("idle"); callbacks.current.onBusy(false) } }
      }
      current.start(1000); setPhase("recording"); timer.current = setTimeout(() => stop(), 90_000)
    } catch {
      stream.current?.getTracks().forEach(track => track.stop())
      if (mounted.current) { setPhase("idle"); callbacks.current.onBusy(false); callbacks.current.onError("მიკროფონთან წვდომა ვერ მივიღეთ. დაუშვით მიკროფონი ბრაუზერში ან დაწერეთ ტექსტი.") }
    }
  }
  return <div className="cn-voice"><button type="button" className={phase === "recording" ? "is-recording" : ""} disabled={disabled || !available || !supported || phase === "permission" || phase === "transcribing"} onClick={() => phase === "recording" ? stop() : void start()} title={!available ? "ხმის შეყვანა ჯერ არ არის გამართული" : !supported ? "ამ ბრაუზერში ხმის ჩაწერა მიუწვდომელია" : "ჩაწერეთ მაქსიმუმ 90 წამი; გაგზავნამდე ტექსტს გადაამოწმებთ"} aria-label={phase === "recording" ? "ჩაწერის დასრულება და ტექსტად გადაყვანა" : "შენიშვნის ხმით ჩაწერა"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></svg>{phase === "recording" ? "დასრულება ■" : phase === "transcribing" ? "ვშიფრავთ…" : phase === "permission" ? "მიკროფონი…" : "ხმით თქმა"}</button>{phase === "recording" ? <button type="button" onClick={() => stop(true)}>გაუქმება</button> : null}<span className="cn-voice-status" role="status">{phase === "recording" ? "იწერება · მაქს. 90 წამი" : phase === "transcribing" ? "ტექსტი გამოჩნდება გასაგზავნად" : !available ? "ხმა ჯერ არ არის გამართული" : ""}</span></div>
}
