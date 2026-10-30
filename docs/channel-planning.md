# One weekly strategy, independent channel executions

New batches decide Facebook and Instagram roles and counts before selecting
formats. The saved `channelPlan` names both channels, including an explicit
`omissionReason` for every zero. The Week and Content views display this decision
even while the post outline is being prepared.

The planner ordinarily gives each enabled channel at least one useful post.
Zero is allowed when a supplied priority, evidence or resource tradeoff warrants
it; missing analytics or an easier Instagram idea is not a reason to silently
drop Facebook. These are editorial instructions, not a claim about an optimal
publishing frequency. Counts account for the remaining dates and stay within the
existing 0–5 per-channel limit. Explicit user counts and disabled channels are
enforced in validation. When counts are already supplied, no extra model call is
needed to choose them again.

Every new outline item has exactly one channel, with its own format, brief,
visual plan and copy. A shared creative concept may become a Facebook story and
an Instagram carousel. Same-channel duplicate jobs remain invalid; reusing an
idea across channels does not force the Writer to invent a different central
message. The final schedule must exactly satisfy the saved channel counts.
Existing near-verbatim copy checks, factual review and approval controls remain.

The worker saves channel decisions under its existing `outline` stage, then
releases the lease before creative exploration and post planning. Retries reuse
saved decisions and concepts. A full pause skips exploration, writing and review;
increasing the count later can still explore concepts. The normal planner model
handles the additional `post_channel_plan` call for automatic recommendations.

Existing ready or approved batches remain intact. Legacy multi-channel outline
items stay supported; resizing preserves their copy and media, and only newly
added items use independent executions. User count changes retain channel roles
and update the displayed counts and omission reasons. No database migration or
new environment variable is required. Deploy the application and restart its
worker to apply the behavior to new planning and additions.

Validation: `npm run test:channels` checks missing channels, explained pauses,
explicit counts, remaining dates, independent formats, duplicate handling,
Writer context, resizing and both views. `npm run test:planning` additionally
exercises database persistence, worker retries and legacy compatibility with a
mocked model provider. These checks establish behavior, not creative quality.
