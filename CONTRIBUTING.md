# Contributing

Fork this repository, create a branch in your fork, and open a pull request
against `main`. Public contributors do not need write access to propose changes.
The owner reviews and merges contributions. Direct pushes to `main`, force pushes,
and branch deletion are blocked, including for administrators. Pull requests must
pass the verification and secret scanning checks and resolve review conversations.

GitHub Actions from external contributors require the owner's approval before
running. CI uses synthetic test accounts and an isolated temporary database; it
does not need production credentials or access to school accounts.

Use Node.js 22, run `npm ci`, and follow the local setup in [README.md](README.md).
Before submitting changes, run `npm run typecheck`, `npm test`,
`npm run test:e2e`, and `npm run build`. Browser tests require Chromium installed
with `npx playwright install --with-deps chromium`.

Never commit `.env` files, OAuth tokens or client secrets, private keys, database
backups, private handoffs, real student timetables, or personal screenshots.
Use `.env.example` for configuration names and synthetic fixtures for tests.
GitHub secret scanning and push protection are enabled; an additional Gitleaks
check scans the full Git history in CI. Report suspected exposed credentials
without copying their values into a public issue or pull request.
