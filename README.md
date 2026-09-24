# KOSwFriends

School timetables with friends and shared draft semester plans. Czech and English, Europe/Prague times, an original square-cornered interface inspired by Fittable. Official enrollment stays in KOS.

## Development

Node 22 LTS, PostgreSQL 17. Install with `npm ci`, copy `.env.example` to `.env.local`, and supply your own database URL and a 32-byte base64 encryption key. Never commit runtime secrets. Next reads `.env.local`; migration/worker commands need the same variables in their process environment.

```
npm run db:migrate
npm run dev
npm run worker
```

Real OAuth requires the registered callback `https://kos.deeev.cz/callback`. The application requests only `cvut:sirius:personal:read`. There is no development login endpoint or public demo-account bypass.

## Checks

```
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:e2e
npm run build
```

Both test commands create and remove a dedicated embedded PostgreSQL 17 database on loopback port 55438. Run them sequentially. Fixtures are synthetic and never deploy to production. With npm versions that block lifecycle scripts, approve `@embedded-postgres/linux-x64` (or the matching platform package) and rebuild it first. Tests cover directional sharing, pending invitations, immediate revocation, blocking, deletion, OAuth state replay, token identity checks and concurrent rotation, complete imports, provider failures, overlapping/cancelled lessons, and Prague DST. Browser checks use separate synthetic accounts and cover mobile overflow and Czech/English text.

## Data and privacy

School tokens are AES-256-GCM encrypted at rest; they never enter browser responses. Session cookies contain random opaque values with only their SHA-256 hashes stored. Mutations require a session-bound CSRF token and exact configured Origin. Every shared calendar and plan read evaluates current accepted friendships or group membership, directional defaults, explicit person overrides and blocks in the same SQL statement. Personal APIs and OAuth redirects use private no-store responses. No school enrollment writes, attendee scraping, email, or chat.

An import uses the connected user's own `/people/{verifiedUsername}/events`, reads every page, and atomically replaces its semester snapshot only on success. School failures keep the last successful snapshot. Token refresh locks the account row across web and worker processes. Synchronization uses PostgreSQL advisory locks, runs every 15 minutes for accounts active in the last seven days, and limits manual refresh to once a minute. Polling clears affected shared views on revocation and hides shared data if the connection fails.

Semester metadata covers the union of dates reported by Sirius faculties. If unavailable, the calendar explicitly labels its date range as estimated. Empty calendars do not imply no enrolled courses. Upcoming courses without groups can be saved as unverified manual drafts. Group selection and conflict detection do not reserve or enroll anything.

## Groups and personal events

Group owners invite people by their school username or a reusable invite link. Links expire after seven days, can be copied again, replaced or revoked, and are invalidated when the owner removes a member. Opening a link does not join or share anything: the recipient signs in, reviews the group and explicitly chooses sharing before joining. Link tokens travel in the URL fragment and a POST body, never in server URL logs, and survive the same-tab school sign-in using session storage. Revoking a link leaves existing memberships unchanged. Invitations stay pending until accepted; each member chooses whether to share their timetable and semester drafts with all current and future accepted members. A person override takes precedence across all groups and friendships, while a block stops sharing in both directions. Resetting an override uses the union of direct friendship grants and group defaults. Leaving or removal ends access supplied by that group; another accepted relationship may still grant access. An override cannot grant access without an accepted relationship.

The default week shows the user's timetable and all authorized shared calendars, with stacked initials for people attending the same Sirius event. The All friends checkbox toggles all overlays at once; individual controls remain in the filters above the calendar. Weekday columns have equal widths and fit on screen. The week shows up to three parallel lanes; crowded blocks reserve the last lane for a count of more lessons and prioritize the user’s own lessons. Click a day heading or the overflow count to expand that day across the timetable, then use Back to week or Escape to return. Expanded days show every lesson; very dense days can scroll internally. Empty weekend days are hidden independently. Lesson accents use Fittable's published lecture, tutorial, laboratory and exam palette. Avatars use the first and sixth username letters. The separate Usermap photo endpoint documents only public employee photos, so student photos are not imported; see [profile-photos.md](docs/profile-photos.md). No additional school scope is requested. Dark mode follows the system preference until changed with the header toggle, then remembers the choice. Calendar colors mix against the active theme surface, including custom colors, and dialogs and forms use the same theme.

Personal subjects and events (for example TV1-PE) have editable names, locations, notes, colors and optional weekly repetition. They are stored separately from Sirius imports, remain after synchronization and follow calendar sharing permissions. Weekly series preserve Prague wall-clock time across DST; editing or deleting changes the whole series. Their default teal color and Personal event label distinguish them from imported teaching. These entries do not perform registration in KOS. Course-only wishes without times remain available in the semester planner.

## Mobile and installation

The app can be installed on Android through the browser install action and on
iPhone/iPad through Safari's Share → Add to Home Screen (Open as Web App).
The footer's Install app action opens the browser prompt when available or short
platform instructions. Installed apps use standalone display and platform icons.
Mobile navigation stays at the bottom; timetable filters can be expanded above
the agenda. Forms use larger touch controls and respect screen safe areas.

The service worker caches only public icons and a static reconnect screen.
Timetables, APIs, sessions, OAuth responses and authenticated pages are never
stored in the PWA cache. Opening offline shows a reconnect screen, not an offline
calendar. Existing session and sharing rules apply after reconnecting.

Landing screenshots use synthetic data from the current UI. To regenerate them,
run the dev server on port 3100 and `node scripts/capture-preview.mjs`. Regenerate
platform icons from the supplied SVG with `node scripts/render-icons.mjs`.
Both scripts need Playwright Chromium. See [feature-ideas.md](docs/feature-ideas.md)
for proposed follow-up features and API constraints.

## Deployment

See [operations.md](docs/operations.md). Dokploy runs the application, worker, PostgreSQL 17, a migration gate, and daily backups in the dedicated KOSwFriends project. Only the web service is public. Backups remain on the same host and are not disaster recovery.

## Integration verification

Automated fixtures prove application behavior, not school OAuth compatibility. Live acceptance additionally requires a consenting school login, successful own-calendar import, actual token refresh, and comparison/revocation between two consenting school accounts. Record these checks separately; never put real calendar screenshots, credentials, or the private transfer bundle in this repository.
