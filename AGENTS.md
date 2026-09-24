# KOSwFriends
Commit as tkdeeev. Use #minor for features, #patch for fixes, #major for breaking upgrades.
Use Context7 resolve-library-id then query-docs for implementation documentation.
Keep the private handoff and all credentials outside this repository. Never log OAuth responses, tokens, session cookies, personal calendars, or infrastructure credentials.
App scope: school OAuth personal Sirius imports, explicit directional friend sharing, draft plans only. Never write to KOS or request broader scopes without user authorization.
Run typecheck, meaningful unit/database/browser checks, and production build before deployment. Clearly separate synthetic validation from real school/two-account checks.
Deploy only the dedicated KOSwFriends project on host.deeev.cz through Dokploy MCP. Preserve unrelated services.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
