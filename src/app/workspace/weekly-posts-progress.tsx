"use client"

import { useEffect, useId, useRef, useState } from "react"
import type { PostsBatch } from "../../blueprints/social/weekly-planning/posts"
import { postsPresentation, savedWorkMessage } from "./weekly-posts-presentation"

/** Mounted only for an active Posts-screen batch; dismissal never touches the worker. */
export function WeeklyPostsProgress({ batch }: { batch: PostsBatch }) {
  const progress = postsPresentation(batch)
  const [dismissed, setDismissed] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const reopen = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const savedCopies = progress.total ? `${progress.written} / ${progress.total} ტექსტი შენახულია. დაწერილ ტექსტებს გამოჩენის შემდეგაც ვამოწმებთ.` : "ვაზუსტებთ პოსტების სტრუქტურას. დაწერილი ტექსტები მზადყოფნისთანავე გამოჩნდება."
  useEffect(() => {
    const element = dialog.current
    if (dismissed || !element) return
    element.showModal()
    return () => { element.close() }
  }, [dismissed])
  function dismiss() {
    dialog.current?.close()
    setDismissed(true)
    reopen.current?.focus()
  }
  return <>
    <section className="fp-progress">
      <span className="fp-pulse" aria-hidden="true" />
      <div role="status"><strong>{progress.title}</strong><p>{progress.repairMessage ?? savedCopies}</p><p>{savedWorkMessage}</p></div>
      <button type="button" className="fp-copy-button" ref={reopen} onClick={() => setDismissed(false)}>პროცესის ნახვა</button>
    </section>
    {!dismissed ? <dialog ref={dialog} className="fp-progress-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); dismiss() }}>
      <header><p className="wp-eyebrow">Operator პოსტებზე მუშაობს</p><button type="button" className="fp-copy-button" onClick={dismiss} autoFocus>დახურვა</button></header>
      <div role="status"><h2 id={titleId}>{progress.title}</h2>{progress.repairMessage ? <p className="fp-repair-notice">{progress.repairMessage}</p> : <p>{savedCopies}</p>}</div>
      <p id={descriptionId}>{savedWorkMessage} ამ ფანჯრის დახურვის შემდეგ მუშაობა გაგრძელდება.</p>
      <ol className="fp-pipeline">{progress.stages.map((stage, i) => <li key={stage.key} className={stage.current ? "is-current" : stage.done ? "is-complete" : ""} aria-current={stage.current ? "step" : undefined}><span aria-hidden="true">{stage.done && !stage.current ? "✓" : i + 1}</span><div>{stage.label}<small>{stage.current ? "მიმდინარეობს" : stage.done ? "დასრულებულია" : stage.key === "repair" && !progress.repairKeys.length ? "მხოლოდ საჭიროების შემთხვევაში" : stage.key === "review" && progress.repairKeys.length ? "პირველმა შემოწმებამ დაზუსტება მოითხოვა" : "შემდეგი ეტაპი"}</small></div></li>)}</ol>
      <p>ტექსტების დაწერის გარდა, ვამოწმებთ მათ განსხვავებულობას, ბრენდის ხმასა და ფაქტებს. საჭირო შესწორებას ხელახალი შემოწმებაც მოჰყვება — ამიტომ მომზადებას დრო სჭირდება.</p>
    </dialog> : null}
  </>
}
