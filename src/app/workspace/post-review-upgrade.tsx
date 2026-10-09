"use client"

import { useState } from "react"
import type { PostOutline } from "../../blueprints/social/weekly-planning/posts"
import type { SocialContentMode } from "../../blueprints/social/tokens"
import { POST_CONTENT_MODES, POST_MODE_LABELS, isPostContentMode } from "../../blueprints/social/weekly-planning/post-mode"

export function PostReviewUpgrade({ posts, disabled, onRecheck }: {
  posts: readonly PostOutline[]; disabled: boolean; onRecheck: (modes: Record<string, SocialContentMode>) => void
}) {
  const [modes, setModes] = useState<Record<string, SocialContentMode>>(Object.fromEntries(posts.flatMap((post, i) =>
    isPostContentMode(post.contentMode) ? [[`p${i + 1}`, post.contentMode]] : [])))
  const complete = posts.every((_, i) => isPostContentMode(modes[`p${i + 1}`]))
  return <section className="wp-notice"><h3>გამოქვეყნებამდე ტექსტების შემოწმება განვაახლოთ</h3>
    <p>თითოეულ პოსტს მიზანი განუსაზღვრეთ. ტექსტებს ამ მიზნის მიხედვით შევამოწმებთ; შედეგს განიხილავთ და ხელახლა დაადასტურებთ.</p>
    {posts.map((post, i) => <label key={i}>{post.title}<select disabled={disabled} value={modes[`p${i + 1}`] ?? ""}
      onChange={event => { const mode = event.target.value; if (isPostContentMode(mode)) setModes(current => ({ ...current, [`p${i + 1}`]: mode })) }}>
      <option value="" disabled>აირჩიეთ პოსტის მიზანი</option>{POST_CONTENT_MODES.map(mode => <option key={mode} value={mode}>{POST_MODE_LABELS[mode]}</option>)}
    </select></label>)}
    <button className="wp-button" disabled={disabled || !complete} onClick={() => onRecheck(modes)}>შენახული ტექსტების შემოწმება →</button>
  </section>
}
