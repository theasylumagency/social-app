"use client"

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react"

type FeedbackModalProps = {
  readonly open: boolean
  readonly labelledBy: string
  readonly describedBy?: string
  readonly className?: string
  readonly onRequestClose?: () => void
  readonly children: ReactNode
}

export function FeedbackModal({
  open,
  labelledBy,
  describedBy,
  className,
  onRequestClose,
  children,
}: FeedbackModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }

    return () => {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={`feedback-modal${className === undefined ? "" : ` ${className}`}`}
      aria-labelledby={labelledBy}
      {...(describedBy === undefined ? {} : { "aria-describedby": describedBy })}
      onCancel={(event) => {
        event.preventDefault()
        onRequestClose?.()
      }}
    >
      {children}
    </dialog>
  )
}

type ProgressFeedbackModalProps = {
  readonly open: boolean
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly steps: readonly string[]
  readonly footnote: string
}

export function ProgressFeedbackModal({
  open,
  eyebrow,
  title,
  description,
  steps,
  footnote,
}: ProgressFeedbackModalProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <FeedbackModal
      open={open}
      labelledBy={titleId}
      describedBy={descriptionId}
      className="progress-feedback-modal"
    >
      <div className="feedback-modal-card" aria-busy="true" aria-live="polite">
        <div className="brand-scan-visual" aria-hidden="true">
          <span className="brand-scan-orbit" />
          <span className="brand-scan-core">U</span>
          <span className="brand-scan-signal" />
        </div>
        <span className="feedback-modal-eyebrow">{eyebrow}</span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId} className="feedback-modal-description">
          {description}
        </p>
        <div className="feedback-modal-progress" aria-hidden="true">
          <span />
        </div>
        <div className="feedback-modal-steps" aria-label="მიმდინარე სამუშაოები">
          {steps.map((step, index) => (
            <div className="feedback-modal-step" key={step}>
              <span style={{ "--step-delay": `${index * 0.45}s` } as CSSProperties} />
              <strong>{step}</strong>
            </div>
          ))}
        </div>
        <p className="feedback-modal-footnote">{footnote}</p>
      </div>
    </FeedbackModal>
  )
}
