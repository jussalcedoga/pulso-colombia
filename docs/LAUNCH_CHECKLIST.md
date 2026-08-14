# Launch Checklist

Complete this before sharing beyond a small community pilot.

## Authority And Content

- Confirm the USGS event ID and event status.
- Confirm each official donation URL directly with the organization.
- Ask local emergency management to review Spanish terminology and city scope.
- Identify at least two operators who can review flags and verify representatives.
- Publish a contact and escalation process outside the public report feed.

## Cloudflare

- Create the production D1 database and set its ID in `wrangler.jsonc`.
- Set a random `APP_SECRET` with Wrangler secrets.
- Apply all remote migrations before deploying.
- Confirm the Worker free-tier limits against expected traffic.
- Attach a stable domain and enable Cloudflare analytics.
- Configure Turnstile for the stable hostname before a broad public launch.
- Set billing/quota alerts and identify the operator who will monitor them.
- Test the site from Colombia on a mobile connection.

## Safety And Privacy

- Verify exact coordinates are absent from D1 reports.
- Confirm API responses carry CSP, frame, referrer, and MIME headers.
- Test public phone/email rejection.
- Test flag thresholds and operator review queries.
- Test edge rate limits and each endpoint-specific D1 rate limit.
- Confirm Turnstile blocks a missing or invalid token when it is enabled.
- Verify representative identity through an authority before setting `verified=1`.
- Have local legal reviewers approve the documented 30/90/180-day retention
  periods and publish a privacy contact.
- Establish a process to delete reports and accounts on request.

## Product

- Test Spanish and English at 360 px, 768 px, and desktop widths.
- Test with satellite tiles disabled on a slow connection.
- Confirm every official external link and attribution.
- Confirm the help, donation, registration, report, offer, acceptance, and
  chat/resolution flows.
- Confirm need, available-help, and update posts remain visually and
  mathematically distinct.
- Explain publicly that the priority index is not a damage inspection.
- Replace the embedded event fallback whenever the primary event changes.

## Recommended Next Phase

- Passkeys or an audited identity provider.
- Stronger adaptive abuse controls and an operator abuse dashboard.
- Authority moderation and representative-verification dashboard.
- Push notifications and explicit chat retention controls.
- Audited fundraising integrations and verified recipient accounts.
- Additional Copernicus EMS areas or licensed high-resolution imagery when
  legally available; never present missing coverage as absence of damage.
- Human-reviewed change detection with confidence and provenance.
