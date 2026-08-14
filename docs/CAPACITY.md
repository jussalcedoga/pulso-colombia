# Capacity And Traffic

## Launch Position

Pulso's deployed Cloudflare Worker architecture is a reasonable fit for a pilot
with 100-200 simultaneously active users. This is a planning target, not an SLA.
Cloudflare's edge runtime, not a quick tunnel or the local Wrangler emulator, is
the production system.

Concurrency and request rate are different:

- 200 people with the map open do not create 200 continuous connections.
- Each visible client refreshes hazards and reports every 60 seconds.
- A signed-in client also refreshes its private inbox every 60 seconds.
- An open active chat requests incremental messages every 20 seconds.
- Hidden browser tabs stop these polling requests.

At 200 continuously visible readers, the normal public polling load is about
400 requests/minute, or 6.7 requests/second, before cache reuse. If all 200 are
signed in, inbox polling adds about 3.3 requests/second. Open chats add up to
0.05 requests/second each.

## Why It Remains Lightweight

- Static assets are fingerprinted and cached.
- Hazard responses use Cloudflare's cache for five minutes.
- The default public report list uses Cloudflare's cache and is invalidated by
  report mutations.
- Report locations store one H3 cell center, not precise coordinate histories.
- Chat fetches only messages after the latest known message.
- Per-account, per-post, and per-chat hard caps bound write amplification.
- A daily retention job removes expired operational and community data.
- There are no WebSockets, media uploads, video, or payment webhooks.

## Measured Local Checks

Local checks validate application behavior, not Cloudflare's global capacity:

- Static build: 1,000 requests at concurrency 200, zero failures.
- Local Wrangler API: 499 of 500 `/api/reports` requests completed during a
  concurrency-100 burst; one non-2xx response occurred and the development
  process then exited.

The second result is a local-emulator limit and must not be represented as a
production benchmark.

## Measured Deployed Edge Checks

On August 13, 2026, controlled cached-read bursts against the deployed
`/api/reports` endpoint produced:

- 400 requests at concurrency 100: zero failures, 133.7 requests/second, 553 ms
  median end-to-end response time.
- 400 requests at concurrency 200: zero failures, 166.1 requests/second, 689 ms
  median end-to-end response time.

TLS connection setup from one California client is included in those latency
figures. These short, read-only, cache-friendly bursts support the 100-200 user
pilot target; they do not measure sustained mixed reads/writes, global latency,
daily free-plan quotas, or an upstream outage. Repeat a controlled check after
material architecture changes while monitoring Worker errors, 429 responses,
and D1 usage.

## Controls

Production edge limits are applied per source IP:

- All API traffic: 1,200 requests/minute.
- Non-read API traffic: 120 requests/minute.

Additional D1-backed limits apply to high-risk actions:

- Registration: 5/hour.
- Login: 12/15 minutes.
- New reports: 8/hour per signed-in user and source IP.
- Private offers: 20/hour per signed-in user and source IP.
- Chat messages: 120/hour per signed-in user and source IP.

These controls protect the MVP but can affect shelters, campuses, or mobile
carriers where many people share one public IP. Operators should review 429
rates rather than simply increasing limits.

## What Can Exhaust The Free Deployment

- A botnet using many source IPs.
- Sustained polling from clients that ignore the browser application cadence.
- A sudden launch burst that consumes the account's daily Worker quota.
- High write volume that consumes D1 daily write limits.
- A large report table that increases uncached D1 rows read.
- USGS outages or slow upstream responses on a cold hazard-cache request.

Cloudflare plan quotas change over time. Check the current Workers and D1 usage
pages before launch and daily during the pilot. If normal traffic approaches
70% of a daily quota, reduce polling, increase cache duration, or move to a paid
Workers plan before the service is throttled.

Quick Tunnels are only for previews. They depend on the laptop, have no
production SLA, and should not be used to claim support for 100-200 users.
