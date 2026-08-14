# Architecture

## Runtime

Pulso deploys as one Cloudflare Worker:

- Cloudflare static assets serve the Vite/React client.
- Worker routes under `/api/*` provide application and upstream-data APIs.
- D1 stores users, sessions, approximate reports, confirmations, flags, bounded
  public comments, and private aid offers and chat messages.
- Copernicus EMS, USGS, NASA, Esri, and OpenStreetMap remain upstream data
  providers; Pulso caches and presents their attributed public products.

No payment processor, email service, proprietary map token, or always-on server
is required for the MVP.

## Client Updates

The service worker uses network-first navigation and static reads with cached
offline fallbacks. It never serves a cached application shell while the network
is available. When a new worker activates, an already-controlled tab reloads
once so new deployments become visible immediately.

## Hazard Flow

`GET /api/hazards`:

1. Loads the configured USGS event detail.
2. Discovers its preferred ShakeMap, DYFI, and ground-failure products.
3. Loads the highest available ShakeMap MMI CoverageJSON and the 1 km DYFI
   GeoJSON, retaining only cells that intersect a target city.
4. Loads the Copernicus EMSR916 activation metadata and final grading layers,
   retaining classified building points and interrupted-road points for target
   cities.
5. Samples city MMI, summarizes observed responses, and fetches aftershocks.
6. Caches the compact response for five minutes.
7. Falls back to the last embedded USGS snapshot if the live USGS feed is down;
   unavailable Copernicus coverage remains explicitly empty/pending.

The browser renders:

- Labeled Esri reference imagery or OpenStreetMap streets.
- Optional dated NASA GIBS VIIRS tiles.
- Copernicus analyzed-area boundaries, building findings, and road blocks.
- Separate USGS modeled-MMI and observed-DYFI cells.
- Aftershock markers.
- Severity-colored approximate community-report pins.

## Community Flow

Public posts have one of three explicit types:

- `need`: requests assistance and contributes to priority calculations.
- `offer`: advertises available assistance and never increases priority.
- `update`: shares a short local notice or fundraiser announcement and never
  increases priority.

Signed-in users can send a private connection request to a post author. The
recipient must accept it before either participant can use the lightweight
private chat. Open chat views request only messages newer than the latest local
message every 15 seconds and immediately when the browser regains focus.
Opening the inbox always requests a fresh `no-store` response. Recovery codes
identify accounts across devices; equal display names do not share an inbox.
The moderator cannot read a conversation unless that account is a participant.

Every visible post also has a public text discussion. Anyone may read it;
posting requires an account. Resolved posts and their discussions leave public
APIs. Only the single operator-assigned `moderator` account may resolve or
reopen a post; post authors cannot change closure state. Authors may edit or
delete their own posts, and the moderator may delete any post. Edits rerun the
same location and privacy validation as publication and reset community
confirmations. A permanent delete cascades to the post's public comments,
confirmations, flags, private connections, and chat messages. The moderator
header exposes a dedicated active-post management view; server authorization
remains authoritative.

Available-help posts explicitly distinguish local and remote support. Local
help stores and displays an approximate pin. Remote help is associated with a
target community but does not request or display the helper's location and
never creates a map marker.

## Storage Bounds

The API stores text only: no photos, video, attachments, or coordinate history.
Request bodies are capped at 16 KB; report descriptions are at most 700
characters; chats are at most 500 characters per message. Default public reads
return at most 100 posts and private reads return at most 100 offers or messages.

Hard growth limits include five unresolved posts and 25 new posts per account
per 24 hours, 50 active connections per post, 200 public comments per post, and
500 messages per accepted connection. A daily Cron Trigger removes:

- Expired sessions and rate-limit buckets.
- Chat messages older than 30 days.
- Public comments older than 30 days.
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

Local H3 sectors are ordered with a bounded triage index:

```text
damageBurden = 5 * destroyed + 3 * damaged + possiblyDamaged
needBurden = 6 * criticalNeeds + 2 * openNeeds + log(1 + affectedPeople)

60 * (1 - exp(-damageBurden / 12))
+ 30 * (1 - exp(-needBurden / 12))
+ 10 * physicalImpact / 100
= bounded 0..100 ordering signal
```

The numeric value orders sectors internally; the UI shows evidence components
and coarse critical/high/active bands rather than labeling it as a damage
percentage. The model is deterministic and intentionally bounded. It does not
infer observed damage from post volume, available-help posts, update posts,
account type, or self-declared organization status.

## Authentication

Registration generates 160 bits of random recovery material. D1 stores only its
SHA-256 hash. A successful registration or login creates a separate 256-bit
session token; D1 stores only that hash, and the browser receives the raw token
in an `HttpOnly` cookie.

This is pseudonymous account continuity, not identity verification. Verified
representative status is an operator-controlled field.

## Privacy Boundary

For localized posts, the API accepts a location only long enough to derive an
H3 resolution 9 cell, roughly 350 m across. It stores the cell and cell center,
not the submitted coordinate. Remote-help posts do not accept a helper location;
they store a derived target-community anchor that is never rendered as a map
pin. Public details and comments reject likely phone numbers and email
addresses. Private offer messages can contain voluntary coordination details.

## Known MVP Limits

- The moderation view lists active posts but does not yet provide a dedicated
  flag-review queue; flags remain in D1 and never hide a post automatically.
- Chat uses polling rather than WebSockets and has no attachment support.
- No Pulso-authored automatic satellite change detection or damage inference;
  building findings are official Copernicus classifications with their original
  coverage limitations.
- No payment processing or individual fundraising verification.
- Sponsor, volunteer, and organization categories are self-declared unless an
  operator separately verifies the account.
- A quick tunnel is ephemeral, laptop-dependent, and uses the operator's local
  D1 database.
