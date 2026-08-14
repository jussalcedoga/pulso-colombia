# Pulso Colombia

[![CI](https://github.com/jussalcedoga/pulso-colombia/actions/workflows/ci.yml/badge.svg)](https://github.com/jussalcedoga/pulso-colombia/actions/workflows/ci.yml)

<p align="center">
  <a href="https://pulso-colombia.juan-sebastian-salcedo-gallo-th.workers.dev">
    <img src="public/pulso-logo.svg" width="420" alt="Open Pulso Colombia" />
  </a>
</p>

<p align="center">
  <strong>
    <a href="https://pulso-colombia.juan-sebastian-salcedo-gallo-th.workers.dev">
      Abrir el mapa / Open the live map
    </a>
  </strong>
</p>

**ES:** Mapa de respuesta comunitaria para conectar necesidades, ayuda y
evidencia oficial despues de un sismo.

**EN:** A community response map connecting needs, available help, and official
evidence after an earthquake.

Pulso is a bilingual emergency map for the August 10, 2026 western Colombia
earthquake. It combines official hazard evidence with privacy-preserving
community posts and targeted, private aid coordination.

> Pulso is a community pilot, not an emergency service or structural inspection.
> Call local emergency services when immediate life safety is at risk.

The first screen is the working community app: a fast street map, neighborhood
posts, and separate **Necesito ayuda / I need help** and
**Quiero ayudar / I want to help** paths.

## What The MVP Does

- Reads the configured event, aftershocks, ShakeMap intensity, and ground-failure
  alerts from the USGS.
- Displays labeled Esri reference imagery and optional dated NASA GIBS/VIIRS
  daily imagery without an API key.
- Loads official Copernicus EMSR916 building-damage findings, interrupted-road
  points, analyzed-area boundaries, sensor names, and delivery timestamps.
- Provides city and neighborhood/sector views for Manizales, Pereira, Armenia,
  Cali, and Chocó/Quibdó. Areas without final Copernicus coverage are explicitly
  marked pending rather than treated as undamaged.
- Keeps modeled USGS MMI, observed USGS "Felt It?" responses, official
  Copernicus findings, and community needs visually and mathematically distinct.
- Separates **needs**, **available help**, and **community updates**. Only needs
  affect the response-priority model.
- Lets local helpers publish an approximate map pin and lets helpers abroad
  offer remote support to a selected community without sharing their location.
- Lets signed-in users localize a post by address search or dropped pin, then
  publishes at H3 resolution 9. The submitted coordinate is discarded; only
  the center of an approximately 350 m-wide cell is stored. Remote-help posts
  do not request the helper's location.
- Supports recovery-code accounts with no email vendor or password database.
- Lets signed-in people confirm nearby needs, flag unsafe posts, send private
  offers, accept/decline them, and chat after an offer is accepted.
- Gives every need, available-help post, and community update a lightweight
  public discussion. Only the single operator-assigned moderator can close or
  reopen posts. Authors can edit or delete their own posts, and the moderator
  can permanently delete any post; resolved posts leave the public feed.
- Links only to configured official organization domains. Pulso does not process
  money or charge fees.
- Runs as a Cloudflare Worker with static assets and D1 on the free tier.

## Data Integrity

Pulso does **not** run its own automatic damage detector. The app keeps four
evidence types distinct:

1. **Copernicus EMSR916:** Official building classifications and road
   interruptions produced through photo-interpretation of very-high-resolution
   imagery, only inside published analyzed areas.
2. **USGS:** Modeled ShakeMap intensity, observed "Felt It?" responses, event
   status, aftershocks, and ground-failure products.
3. **NASA GIBS/VIIRS:** Daily context imagery at roughly 375 m source
   resolution. Clouds and vegetation can hide damage.
4. **Community:** Stated urgency, affected people, confirmations, and aid status.

Neighborhood ordering is a transparent triage signal, not an engineering
inspection. It weights published Copernicus findings most heavily, then open
critical needs, then modeled shaking. The interface exposes those components
instead of presenting a false damage percentage. Resource allocation should be
verified on the ground. See
[Architecture](docs/ARCHITECTURE.md) for the model and evidence boundaries.

## Local Run

Prerequisites: Node.js 20+, npm, and `cloudflared`.

```bash
npm install
npm run db:migrate:local
npm run preview
```

Open `http://localhost:8787`.

For an ephemeral public demo URL:

```bash
npm run quick-tunnel
```

The generated `trycloudflare.com` address is temporary, depends on the local
computer, and has no production SLA. Use a normal Worker deployment before
broad community distribution.

## Cloudflare Deployment

1. Authenticate and create the free D1 database:

   ```bash
   npx wrangler login
   npx wrangler d1 create pulso-colombia
   ```

2. Replace `database_id` in `wrangler.jsonc` with the returned ID. The committed
   ID belongs to the production Pulso account and cannot be reused by a fork.

3. Set a production rate-limit hashing secret:

   ```bash
   npx wrangler secret put APP_SECRET
   ```

4. Apply the schema and deploy:

   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```

Wrangler prints a stable `workers.dev` URL. A custom domain can be attached in
the Cloudflare dashboard later.

### Optional Turnstile

Create a Turnstile widget for the production hostname, then configure both
values:

```bash
npx wrangler secret put TURNSTILE_SITE_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npm run deploy
```

Registration and report submission automatically require the widget when both
keys are present. Edge and D1-backed rate limits remain active without it.

## Event And Resource Configuration

- `PRIMARY_EVENT_ID` in `wrangler.jsonc` selects the USGS event.
- Target city coordinates live in `src/data.ts` and `worker/hazards.ts`.
- Official donation and information links live in `src/data.ts`.
- The event-specific read-only fallback lives in `worker/hazards.ts`; replace it
  when changing the primary event.

Only add donation domains after confirming them directly with the organization
or relevant authority.

## Representative Verification

Accounts start unverified. An operator can verify an approved neighborhood
representative after checking their identity:

```bash
npx wrangler d1 execute pulso-colombia --remote \
  --command="UPDATE users SET role='representative', verified=1 WHERE id='usr_REVIEWED_ID'"
```

Never verify from display name alone. Record the authority or organization that
performed the check outside Pulso.

## Owner Moderation

Exactly one account may hold the `moderator` role. This operator can close any
community post; authors and other users cannot change closure state. Authors
can edit or delete their own content, while the moderator can delete any post.
Assign the role only after verifying control of the intended Pulso account:

```bash
npx wrangler d1 execute pulso-colombia --remote \
  --command="UPDATE users SET role='moderator' WHERE id='usr_REVIEWED_OWNER_ID'"
```

Keep the moderator recovery code private. Resolved posts and their public
discussions leave public APIs and expire under the normal retention policy.
Permanent deletion also removes that post's comments, connections, and chat.
The signed-in moderator receives a dedicated **Manage / Administrar** control in
the app header with a list of every active post and a two-step delete action.

Use the same moderator recovery code with **I already have a code** on every
device. Creating another account, even with the same display name, creates a
separate identity and private inbox. Moderators cannot inspect private
conversations unless their account is one of the two participants.

## Privacy And Abuse Controls

- Public reports and comments reject phone numbers and email addresses.
- Exact submitted coordinates are never stored.
- Offers and replies require authentication and are private to both parties.
- Flags are retained for moderator review but do not automatically remove a
  community post.
- Every API request has an edge limit; writes have a stricter edge limit.
- Registration, login, reports, comments, offers, and chat also have D1-backed
  limits.
- Accounts can keep five unresolved posts and create at most 25 posts per day.
- Chats are capped at 500 compact text messages with 30-day retention.
- Discussions are capped at 200 compact comments per post with 30-day
  retention.
- Closed and stale community data is removed by a daily retention job.
- Sessions use hashed bearer tokens in `HttpOnly`, `SameSite=Lax` cookies.
- Security headers and a restrictive CSP are applied to API and static assets.

Recovery-code authentication keeps the MVP vendor-free but has a tradeoff:
Pulso cannot recover a lost code. A future production phase should add passkeys
or an audited identity provider.

See [Security Policy](SECURITY.md) for responsible vulnerability reporting.

## Capacity

The deployed edge architecture is suitable for an MVP pilot with roughly
100-200 simultaneously active users, but that is not the same as unlimited
sustained traffic. Visible clients poll public data once per minute; reports and
hazards are cached at the edge; private chat polls only while open.

Free-plan request and D1 quotas can still be exhausted by sustained traffic,
automated clients, or frequent writes. Read the measured results, planning
math, and launch thresholds in [Capacity](docs/CAPACITY.md).

## Verification

```bash
npm run check
```

This runs strict TypeScript checks, unit tests, and the production build.

## Repository Layout

```text
src/                 React map and bilingual interaction flows
worker/              Cloudflare Worker API, auth, validation, USGS adapter
migrations/          D1 schema
public/              PWA manifest, service worker, security headers
scripts/             Local quick-tunnel helper
docs/                Launch and architecture notes
```

## Contributing

Issues and pull requests are welcome. Read [Contributing](CONTRIBUTING.md)
before changing scoring, safety, privacy, location precision, or donation
behavior. Those areas require evidence, tests, and explicit review.

## License

MIT. Map and data providers retain their own terms and attribution requirements.
