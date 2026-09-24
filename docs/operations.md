# Operations

Target: dedicated **KOSwFriends / production** on `https://host.deeev.cz`, public app `https://kos.deeev.cz`. Use the Dokploy MCP for ordinary management. Never operate on the separately configured company server or unrelated projects.

## Release

1. Verify GitHub identity `tkdeeev`, review the diff and run the repository checks. Commit features with `#minor`, fixes with `#patch`, breaking upgrades with `#major`.
2. Push the reviewed private repository commit. Wait for its Verify workflow, and compare local HEAD, remote main and the intended deployment SHA.
3. Set Dokploy `APP_REVISION` to that full SHA. Configure GitHub owner `tkdeeev`, repository `koswfriends`, branch `main`, path `compose.yaml`; use a reviewed tag for a pinned rollback. Keep automatic deployments disabled until the exact tested revision is selected.
4. Runtime environment: `POSTGRES_PASSWORD` (random hex), `TOKEN_ENCRYPTION_KEY` (32 random bytes as base64), `SCHOOL_OAUTH_CLIENT_ID`, `SCHOOL_OAUTH_CLIENT_SECRET`, `APP_REVISION`. Values are never build arguments. Compose fixes the origin and callback to the registered HTTPS domain.
5. Route only `web:3000` to `kos.deeev.cz` with HTTPS. PostgreSQL has an internal network and no host port; the worker has a separate egress network for the school APIs.
6. Deploy. Generated migrations must exit successfully before web/worker start. Never use schema push on production. Verify terminal Dokploy status, container health, and `/api/health` reporting database and worker ready with the intended full revision.
7. Check HTTPS in a browser, `/auth/login` and the registered callback. A provider login page is not proof of successful OAuth or calendar import. Do not request broader grants automatically if the provider denies access.

## Rotation

Change the school client secret in Dokploy runtime variables and redeploy/recreate the app and worker. No frontend rebuild is required specifically for secret rotation. Never rotate the token encryption key without a migration: existing encrypted connections would become unreadable. A deliberate reset must invalidate stored connections and require users to reconnect. Keep the encryption key in a private backup outside the database.

## Backup and restore

The backup service creates a custom-format `pg_dump` once a day into its dedicated named volume, checks the archive directory with `pg_restore --list`, then removes dumps older than seven days. Temporary failed dumps are removed without deleting the previous successful dump. Inspect its container health and sanitized completion log; web readiness does not imply backup freshness.

Test a dump by restoring it into a new, isolated scratch PostgreSQL 17 database with `pg_restore --exit-on-error --no-owner --no-acl`. Check migrated tables and counts, then remove only that scratch database/container. Never restore over a live database as a test. For disaster recovery, add an independently stored encrypted copy; the supplied same-host volume cannot survive host loss.

Account deletion cascades through sessions, tokens, invitations, permissions, snapshots and drafts. Historical backups can retain earlier data for up to seven days. A restore can resurrect deleted rows; production restore needs a reviewed deletion reconciliation procedure.

## Rollback

Application images are tagged `koswfriends:<full SHA>`; retain the previous working image and corresponding Git ref. Before rollback, confirm old code remains compatible with the current database schema. Point Dokploy at the matching previous reviewed Git ref and `APP_REVISION`, then deploy and recheck readiness. Do not overwrite an old image tag with different source. Database rollback requires a separately reviewed backup restore; never automatically reverse migrations or delete the persistent volume.

## Troubleshooting

- `/api/health` 503: database/migrations or worker heartbeat is unavailable. Check the dedicated containers and sanitized logs.
- Calendar error with an old snapshot: provider failure did not erase the snapshot. Reconnect if indicated, otherwise retry after the one-minute cooldown.
- Estimated semester warning: Sirius semester metadata was unavailable. The displayed period is explicitly approximate.
- Provider denies a scope or identity: check the actual token-validation contract privately. Do not log token responses or embed secrets in screenshots.
- Sharing revoked: the backend rejects subsequent reads immediately; the visible view updates on its next five-second poll.
