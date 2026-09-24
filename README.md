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
npx playwright install chromium
npm run test:e2e
npm run build
```

Both test commands create and remove a dedicated embedded PostgreSQL 17 database on loopback port 55438. Run them sequentially. Fixtures are synthetic and never deploy to production. With npm versions that block lifecycle scripts, approve `@embedded-postgres/linux-x64` (or the matching platform package) and rebuild it first. Tests cover directional sharing, pending invitations, immediate revocation, blocking, deletion, OAuth state replay, token identity checks and concurrent rotation, complete imports, provider failures, overlapping/cancelled lessons, and Prague DST. Browser checks use separate synthetic accounts and cover mobile overflow and Czech/English text.

## Data and privacy

School tokens are AES-256-GCM encrypted at rest; they never enter browser responses. Session cookies contain random opaque values with only their SHA-256 hashes stored. Mutations require a session-bound CSRF token and exact configured Origin. Every friend calendar and plan read joins current accepted friendship and directional permissions. Personal APIs and OAuth redirects use private no-store responses. No school enrollment writes, attendee scraping, email, or chat.

An import uses the connected user's own `/people/{verifiedUsername}/events`, reads every page, and atomically replaces its semester snapshot only on success. School failures keep the last successful snapshot. Token refresh locks the account row across web and worker processes. Synchronization uses PostgreSQL advisory locks, runs every 15 minutes for accounts active in the last seven days, and limits manual refresh to once a minute. Polling clears affected shared views on revocation and hides shared data if the connection fails.

Semester metadata covers the union of dates reported by Sirius faculties. If unavailable, the calendar explicitly labels its date range as estimated. Empty calendars do not imply no enrolled courses. Upcoming courses without groups can be saved as unverified manual drafts. Group selection and conflict detection do not reserve or enroll anything.

## Deployment

See [operations.md](docs/operations.md). Dokploy runs the application, worker, PostgreSQL 17, a migration gate, and daily backups in the dedicated KOSwFriends project. Only the web service is public. Backups remain on the same host and are not disaster recovery.

## Integration verification

Automated fixtures prove application behavior, not school OAuth compatibility. Live acceptance additionally requires a consenting school login, successful own-calendar import, actual token refresh, and comparison/revocation between two consenting school accounts. Record these checks separately; never put real calendar screenshots, credentials, or the private transfer bundle in this repository.
