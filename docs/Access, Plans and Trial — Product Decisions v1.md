# Access, Plans and Trial — Product Decisions v1

Agreed: 2026-09-05.

Status: agreed product requirements; authentication and private workspace
ownership are implemented (see [Authentication](Authentication.md)); subscription
limits, billing, and the trial lifecycle remain pending. This document
records the access and subscription UX accepted in the product discussion. It
complements the Brand Knowledge architecture without changing its rules.

## Account and workspace

- `app.unda.pro` is the shared application for Social, Financial, and Custom
  Operators. Only Social Operator is available in the initial release.
- One UNDA account can use multiple operators. Each operator has its own
  subscription and access permissions within a workspace.
- A workspace groups brands and subscriptions. Create the first workspace
  automatically, without a separate setup form.
- Keep ownership attached to the workspace so team membership can be added
  later. Team invitations are a future feature.
- Require an authenticated account for all work actions, including website
  analysis and brand setup. Authentication alone does not grant paid access.
- Support Google and email/password sign-in. Offer optional GitHub sign-in when
  configured, an opt-in device-retention checkbox, and email-confirmed password
  addition for a Google-created account.
- Enforce workspace ownership, operator access, subscription status, and brand
  limits on the server, including for background work.

## Entry and navigation

- While Social is the only available operator, enter it directly after sign-in;
  do not require an operator-selection screen.
- Preserve the operator and plan selected on the public website through
  registration. Such a selection expresses intent, not a completed purchase.
- Returning users resume their last accessible brand or unfinished setup.
- Provide shared navigation, a brand switcher, and a place to manage the plan.
  Add operator switching when more operators become available.

## Social plans

- The paid Social plans support 1, 3, or 10 brands.
- Preselect one brand for a new user who has not already chosen a plan. Allow
  an easy change to 3 or 10 without a separate questionnaire.
- Show current usage in the brand menu, such as `ბრენდები: 1 / 1` or `2 / 3`.
- At the limit, the add-brand action offers a suitable upgrade. Show its price
  and terms before confirmation, and continue the add-brand flow after
  successful payment.
- An upgrade keeps the existing brand configuration and content.
- When reducing a plan below the current brand count, let the user select which
  brands remain active. Preserve the other brands and their data rather than
  deleting them automatically.

## Trial

- The trial lasts **14 days** and supports **one brand**.
- It includes the full Social Operator functionality **except image
  generation**. Uploading and using the user's own images remains available.
- No payment card is required to start the trial. Payment happens only after
  the user explicitly selects and confirms a paid plan.
- Start the trial when the first brand's initial setup is completed, not when
  the account is registered. Authenticated users must therefore be able to
  complete that initial setup before the trial clock starts.
- Users can activate a paid plan during the trial, including a 3- or 10-brand
  plan when they need more brands.
- Keep image generation visible with a clear paid-plan label and an upload
  alternative. Example copy: `ხელმისაწვდომია ფასიან ტარიფზე`.
- Show the remaining trial time unobtrusively in the workspace, alongside the
  plan-selection action. Example: `საცდელი პერიოდი · დარჩა 11 დღე` and
  `ტარიფის არჩევა`.

## Trial expiry

- Preserve brands and created material, and allow authenticated users with
  access to view them after the trial expires.
- Stop new generation, content changes, and automatic operator actions until
  a paid subscription is activated. Account access and plan activation must
  remain available.
- Scheduled publishing is also subject to current access: a post scheduled
  during the trial must not publish after expiry without an active paid
  subscription.
- Explain this effect on scheduled publishing before the trial ends.
- Paid activation restores work on the same brand and saved material without
  repeating setup.

## Implementation acceptance criteria

These checks translate the agreed behavior into implementation requirements;
they do not indicate that the functionality already exists.

1. A signed-out request cannot analyze a website, create a brand, or perform
   other work actions through either the UI or a direct application request.
2. Signing in does not expose another workspace's brands or grant that
   workspace's operator permissions.
3. A new user can finish initial brand setup without a card. A durable trial
   start is recorded once at completion; repeat submissions, sign-ins, or brand
   edits do not restart the trial.
4. Trial access permits one brand and the full Social workflow except image
   generation. Image upload remains available.
5. Brand creation enforces the current limit on the server, including when
   requests arrive concurrently. A displayed plan selection cannot grant access
   by itself.
6. After trial expiry, existing material remains viewable while work mutations
   and automatic execution are blocked. Background jobs check access when
   executing, not only when they are scheduled.
7. A confirmed paid activation continues the existing workspace and brands with
   the purchased capacity and paid capabilities.
8. Downgrades preserve data and respect the user's choice of active brands.

## Details still to specify

The discussion did not choose the following. They must not be treated as
already agreed business rules:

- Authentication and payment providers, paid prices, and billing cadence.
- Eligibility for another trial when an account creates another workspace or
  replaces its trial brand. Brand replacement must not reset an existing clock.
- Payment timing and any trial-time credit when activating a paid plan early;
  upgrade and downgrade billing calculations and effective dates.
- Any usage quotas beyond brand capacity; full functionality does not itself
  define a number of generations or other metered operations.
- Whether paused or missed scheduled posts require review or rescheduling after
  paid activation, and the timing of expiry notices.
- Mapping initial setup completion to the application state as the onboarding
  flow develops. Registration and a partial draft are not completion.

## Implementation order

1. Account sessions, workspace ownership, and server-side access checks.
2. Operator access, Social plan capacity, and the trial lifecycle.
3. Shared navigation and integration with the existing brand setup flow.
4. Payment activation and plan changes, followed by expiry-aware background
   execution as scheduling and publishing are implemented.
