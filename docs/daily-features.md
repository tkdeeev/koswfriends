# Daily features

The next-lesson card and person profiles use the current civil semester, independently of the timetable's selected week. Cancelled events are excluded. Personal events are included. Overlapping and back-to-back lessons are merged to calculate the next free time. Starting-soon means within 30 minutes. Status describes a timetable, not physical presence. Profile pictures show a green dot for free, yellow for a lesson within 30 minutes, and red for a current lesson. Private/unknown availability has no dot.

Profiles require an accepted friendship or shared accepted group membership; blocking wins. Timetable access is checked in the same SQL statement as the data read. A profile without calendar permission shows no lesson/status inference. Missing, failed, outside-period or over-24-hour-old imports produce an unknown status. All person endpoints are authenticated and `no-store`. Active clients refresh every 15 seconds.

Sirius imports now request `courses,teachers,schedule_exceptions` and retain lesson capacity, occupancy, teacher names/identifiers, lesson number, notes and schedule changes. Student rosters and private provider fields are discarded. “Explore other classes” opens a separate modal with selectable class groups and uses the existing authenticated course calendar endpoint, without enrollment or planning actions. Old snapshots receive these fields after the next successful sync.

Teacher contact details open the official public Usermap profile. The application's existing `cvut:sirius:personal:read` permission does not include the separate Umapi directory API. No extra OAuth scopes or unrelated school tokens are requested or forwarded. Office/email/phone are therefore not imported into the app.

## Menza setup

Food is temporarily hidden from desktop and mobile navigation. Signed-in testers can still open `/?view=food`; hiding the tab does not restrict access to that URL. Semester planner navigation also remains hidden.

Request a JAPI v3 key from `tomas.kanovsky@cvut.cz`, then add `MENZA_API_KEY` to the dedicated KOSwFriends Dokploy environment and redeploy. Never use a `NEXT_PUBLIC_` variable for the key. Until configured, Food links to the official menus and does not claim to display a live menu.

The backend calls only the fixed official API origin, authenticates in a header, refuses redirects, validates response fields, caches non-personal menu data for five minutes, uses ETags, coalesces requests and observes provider Retry-After/backoff. Meal dates use Prague's civil day. Missing prices stay unknown; zero remains a real zero. The selected canteen is a local browser preference. Ukrainian UI uses English source meal names because JAPI supports Czech and English. Meal photos use an authenticated same-origin backend proxy, only for known meals in today’s menu. The proxy ignores source URLs, limits input to 8 MiB/50 Mpx, accepts static JPEG/PNG/WebP, strips metadata, and returns WebP up to 1200 px. The bounded server cache coalesces photo requests and respects ETag/Retry-After. Thumbnails expand into a modal; absent or failed images fall back to text. Breakfast and weekly menus are not part of this release.

Sources:

- https://cvut.github.io/sirius/docs/api-v1.html
- https://github.com/cvut/sirius/blob/master/app/representers/events_representer.rb
- https://kosapi.fit.cvut.cz/usermap/doc/rest-api-v1.html
- https://agata.suz.cvut.cz/jidelnicky/JAPIV3/api/v3/docs
- https://agata.suz.cvut.cz/jidelnicky/JAPIV3/api/v3/openapi.yaml

## Preview and validation

Local preview servers, seed data and review captures stay outside the repository. Git and Docker ignore `local-preview/`, `seed-data/` and `.koswfriends-ops/` if created inside it. Automated tests use synthetic fixtures only in a temporary test database; these test fixtures are part of the test suite and never seed the application database. Production never falls back to sample school or menu data.

Before publishing, run typecheck, unit/database tests, the complete browser suite and the production build. Targeted Chromium/WebKit tests cover the compact next card, subject details, profile sharing revocation, 320 px layout, hidden Food navigation with direct URL access, prices and allergens. No planner navigation was added.
