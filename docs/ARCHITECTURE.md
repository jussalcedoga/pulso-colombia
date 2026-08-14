# Architecture

## Runtime

Pulso deploys as one Cloudflare Worker:

- Cloudflare static assets serve the Vite/React client.
- Worker routes under `/api/*` provide application and upstream-data APIs.
- D1 stores users, sessions, approximate reports, confirmations, flags, and
  private aid offers and chat messages.
- USGS and NASA remain upstream systems of record.

No payment processor, email service, proprietary map token, or always-on server
is required for the MVP.

## Hazard Flow

`GET /api/hazards`:

1. Loads the configured USGS event detail.
2. Discovers its preferred ShakeMap, DYFI, and ground-failure products.
3. Loads the low-resolution MMI CoverageJSON and contour GeoJSON.
4. Samples MMI at each target city and fetches nearby aftershocks.
5. Caches the result for five minutes.
6. Falls back to the last embedded official snapshot if the feed is down.

The browser renders:

- OpenStreetMap streets.
- Dated NASA GIBS VIIRS tiles.
- USGS georeferenced intensity image and MMI contours.
- Aftershock markers.
- H3 community-report cells and approximate report markers.

## Community Flow

Public posts have one of three explicit types:

- `need`: requests assistance and contributes to priority calculations.
- `offer`: advertises available assistance and never increases priority.
- `update`: shares a short local notice or fundraiser announcement and never
  increases priority.

Signed-in users can send a private connection request to a post author. The
recipient must accept it before either participant can use the lightweight
private chat. Open chat views request only messages newer than the latest local
message every 15 seconds. Inbox and chat responses are always `no-store`.

## Storage Bounds

The API stores text only: no photos, video, attachments, or coordinate history.
Request bodies are capped at 16 KB; report descriptions are at most 700
characters; chats are at most 500 characters per message. Default public reads
return at most 100 posts and private reads return at most 100 offers or messages.

Hard growth limits include five unresolved posts and 25 new posts per account
per 24 hours, 50 active connections per post, and 500 messages per accepted
connection. A daily Cron Trigger removes:

- Expired sessions and rate-limit buckets.
- Chat messages older than 30 days.
- Private connection records older than 90 days.
- Resolved posts after 30 days.
- Available-help and update posts after 30 days.
- Every remaining post after 180 days.

## Priority Signal

USGS MMI is transformed with a logistic fragility proxy:

```text
physicalImpact = 100 / (1 + exp(-1.2 * (MMI - 5.8)))
```

Community cell score:

```text
0.60 * physicalImpact
+ 24 * (urgency / 5)^1.6
+ 9 * min(1, log(1 + people) / log(51))
+ 7 * (1 - exp(-confirmations / 2))
- matched/resolved adjustment
= bounded 0..100
```

City ranking assigns up to 72 points to the physical-impact proxy. Its remaining
28 points use a saturating community burden based on urgency, logarithmic people
count, and confirmations. Logarithmic and saturating terms prevent one unusually
large report or repeated confirmations from dominating the map.

The model ranks response priority and likely impact. It does not estimate
building loss, casualties, or observed damage.

The model is deterministic and intentionally bounded. It does not infer damage
from post volume, available-help posts, update posts, account type, or
self-declared organization status.

## Authentication

Registration generates 160 bits of random recovery material. D1 stores only its
SHA-256 hash. A successful registration or login creates a separate 256-bit
session token; D1 stores only that hash, and the browser receives the raw token
in an `HttpOnly` cookie.

This is pseudonymous account continuity, not identity verification. Verified
representative status is an operator-controlled field.

## Privacy Boundary

The report API accepts a location only long enough to derive an H3 resolution 8
cell. It stores the cell and cell center, not the submitted coordinate. Public
details reject likely phone numbers and email addresses. Private offer messages
can contain voluntary coordination details.

## Known MVP Limits

- No authority moderation dashboard; moderation uses D1 CLI and flag thresholds.
- Chat uses polling rather than WebSockets and has no attachment support.
- No automatic satellite change detection or building-level damage inference.
- No payment processing or individual fundraising verification.
- Sponsor, volunteer, and organization categories are self-declared unless an
  operator separately verifies the account.
- A quick tunnel is ephemeral, laptop-dependent, and uses the operator's local
  D1 database.
