# Possible next features

These are proposals, not enabled features. Suggested order: common free time,
schedule-change alerts, then richer lesson information.

| Feature | What it would do | Data and constraints |
| --- | --- | --- |
| Common free time | Pick friends or a group and find overlapping free slots, with a minimum duration and preferred hours. | Uses calendars already shared with the viewer and includes personal events. Recheck permissions every time; a missing calendar is unknown availability. |
| Schedule-change alerts | Show changes since the last successful import: cancelled classes, moved times, and room changes. Add optional push notifications after an in-app history works. | Compare complete successful Sirius snapshots. School import delays affect freshness. Push must be opt-in and avoid private details on lock screens by default. |
| Richer lesson details | Add teachers, lesson sequence, and occupied/capacity counts where available. | Sirius documents these fields and teacher relationships; the current importer keeps only basic lesson data. Verify live field availability under the existing scope. Counts are observations, not reservations. |
| Find a free classroom | Search a room and show gaps between scheduled events. | Sirius documents room calendars and room search. Confirm endpoint authorization with the current personal scope. Label gaps as no scheduled class, not guaranteed public access. |
| Group study sessions | Choose a common free slot, create a group event, and collect RSVPs. | Build on group membership and personal events. Keep RSVP state separate from school enrollment. |
| Personal calendar subscription | Follow your own combined school/custom timetable from Apple Calendar, Google Calendar, or Outlook. | Generate an ICS feed from the user's own data with a revocable secret URL. Friend calendars should not be included without a separate sharing design. |
| Travel-aware conflicts | Flag a short gap between classes in different buildings and link to a campus map. | Start with maintained building locations and user-configurable travel buffers; don't present estimates as routing guarantees. |

## Sources checked on 2026-09-24

- [Sirius API documentation](https://cvut.github.io/sirius/docs/api-v1.html): events, original schedule data, teachers, occupied/capacity, room calendars, and search. Documented fields do not prove they are populated for every faculty or available to every token.
- [Sirius source](https://github.com/cvut/sirius): authorization implementation. Keep the current `cvut:sirius:personal:read` scope; broader access needs a separate approved integration.
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps): installation and a possible future Web Push integration.

No feature here should perform registration in KOS. Planning and shared events
remain app-owned until the user explicitly registers through the school system.
