# Authentication

The application uses Better Auth 1.7.2 with the existing PostgreSQL database.
Google and email/password are the primary sign-in methods. GitHub is optional
and appears only when its credentials are configured.

## Implemented behavior

- `/login`, `/register`, `/forgot-password`, and `/reset-password` have Georgian
  forms. `/account` provides password setup/change, sign-out, and revocation of
  sessions on other devices.
- Email/password registration requires email verification before access. After
  verification, the user signs in explicitly and chooses device retention.
- Remembering a device is opt-in. A remembered session uses a persistent,
  HttpOnly cookie and a 30-day server expiry, refreshed after a day of use.
  Without the checkbox, the cookie has no persistent expiry and the server
  session lasts at most 24 hours. Browsers can restore session cookies, so closing
  the browser is not a substitute for signing out on a shared device.
- Google retention is carried in validated OAuth state. Separate OAuth flows
  preserve their own selection. Signing out revokes the server session.
- Passwords are 12–128 characters and hashed by Better Auth. Password managers,
  paste, passphrases, and showing/hiding the input are supported.
- A Google-only user chooses password setup in account settings, receives a
  one-use email link, and adds credentials to the same account. The link lasts
  30 minutes. Resetting/adding a password revokes existing sessions; Google
  remains linked and can still be used to sign in.
- Same-email Google linking requires both a verified provider email and a
  verified existing local account. Unverified local accounts cannot be silently
  linked, and different-email linking is disabled.
- Auth requests use Better Auth's origin/CSRF checks and database-backed rate
  limits. Production cookies require HTTPS. Keep the application behind a proxy
  that sets trusted client-IP headers; do not accept client-supplied forwarding
  headers unchanged in a custom deployment.
- The home page and both onboarding endpoints require a verified session.
  Work mutations additionally require the configured same-origin header.
- A private workspace is resolved automatically for each account. New brands
  are saved with that workspace and scoped reads check ownership. Unowned
  development brands are preserved and are not assigned to the first user.
  Unscoped ingestion-store instances are only for internal maintenance and
  domain tests, never request handlers.

Plan enforcement, billing, and the 14-day trial lifecycle remain subsequent
milestones. Registration and session creation do not start the trial.

## Local setup

1. Configure the existing database settings in `.env.local`.
2. Run `npm run auth:init-local`. This adds a random local secret, the localhost
   origin, and email-preview mode only for keys not already present. Existing
   settings are preserved; blank pre-existing keys must be filled separately.
3. Run `npm run db:migrate` and `npm run dev`.
4. Open `http://localhost:3000`. Signed-out visitors go to `/login`.

In explicit local preview mode, authentication emails are JSON files in
`.local/auth-mail/`, ignored by Git and never served as public application
routes. Open the latest file locally to follow a verification or reset link.
There is no verification bypass. Preview mode is refused in production.

## Google configuration

Create a Web application OAuth client in Google Cloud using the
[official provider setup guide](https://better-auth.com/docs/authentication/google).
Configure the consent screen and test users as required by that project's
publishing state. Set these authorized redirect URIs for the environments used:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://app.unda.pro/api/auth/callback/google`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the server environment.
`BETTER_AUTH_URL` must exactly match the application's origin. Do not use a
`NEXT_PUBLIC_` prefix for secrets. Without both Google values, the UI shows
Google as unavailable and email/password remains the configured local path.

GitHub can be enabled with `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, using
`/api/auth/callback/github` on the corresponding origin as its callback URL.

## Production email and sessions

Configure these server-side values before deployment:

- `BETTER_AUTH_URL=https://app.unda.pro`
- A unique `BETTER_AUTH_SECRET` with at least 32 random characters, consistent
  across application instances. Do not reuse the development secret.
- `AUTH_EMAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and, when the
  server requires authentication, `SMTP_USER` and `SMTP_PASSWORD`.
- Port 465 uses implicit TLS; other ports require STARTTLS. Configure the sender
  address and domain with the chosen email service.

The sender is awaited so delivery work is not abandoned on serverless hosts.
Verification, resend, and recovery responses avoid exposing whether an email
exists; a durable email queue with uniform response timing can be added with
the background worker. Delivery and Google consent must be tested against real
configured providers before launch.

## Verification

- `npm run verify` checks lint, types, domain tests, and the production build.
- `npm run test:integration` checks existing PostgreSQL ingestion behavior.
- `npm run test:auth` creates an isolated temporary PostgreSQL schema, applies
  the checked-in migrations, and tests verification, hashing, retention,
  revocation, reset-link consumption, OAuth state/PKCE, account linking, rate
  limiting, and workspace isolation. It drops only its own generated schema.
  The Google token exchange and profile are simulated; no real Google account
  or email delivery is used by this test.

The migration was generated from the installed auth library, including the
1.7 account issuer field. The generator can compile future changes to a new
SQL file for review; apply reviewed files with the normal migration runner.
