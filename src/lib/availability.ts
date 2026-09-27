import { DateTime } from "luxon";
import { ZONE } from "./calendar";
import type { Lesson, Person, Semester } from "./types";

export type Availability = {
  state: "free" | "soon" | "busy" | "unknown" | "private";
  current: Lesson[];
  next: Lesson | null;
  freeAt: string | null;
  freeUntil: string | null;
  horizon: string | null;
  lastSuccess: string | null;
};
export type PersonOverview = { person: Person; availability: Availability };
export const unknownAvailability = (
  state: "unknown" | "private" = "unknown",
  lastSuccess: string | null = null,
): Availability => ({
  state,
  current: [],
  next: null,
  freeAt: null,
  freeUntil: null,
  horizon: null,
  lastSuccess,
});

/** Availability describes the shared timetable, never physical presence. */
export function availability(
  events: Lesson[],
  snapshot: {
    lastSuccess: string | null;
    error: string | null;
    semester: Semester;
  },
  now = Date.now(),
): Availability {
  const last = Date.parse(snapshot.lastSuccess || "");
  if (
    !Number.isFinite(last) ||
    now - last > 24 * 60 * 60 * 1000 ||
    snapshot.error ||
    now < Date.parse(snapshot.semester.from) ||
    now >= Date.parse(snapshot.semester.to)
  )
    return unknownAvailability("unknown", snapshot.lastSuccess);
  const upcoming = events
    .filter(
      (e) =>
        !e.cancelled &&
        Date.parse(e.end) > now &&
        Date.parse(e.end) > Date.parse(e.start),
    )
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const current = upcoming.filter((e) => Date.parse(e.start) <= now);
  const next = upcoming.find((e) => Date.parse(e.start) > now) || null;
  let freeAt = now;
  for (const event of upcoming) {
    if (Date.parse(event.start) > freeAt) break;
    freeAt = Math.max(freeAt, Date.parse(event.end));
  }
  const after = upcoming.find((e) => Date.parse(e.start) >= freeAt);
  const horizon = new Date(
    Math.min(
      DateTime.fromMillis(now).setZone(ZONE).endOf("day").toMillis(),
      Date.parse(snapshot.semester.to),
    ),
  ).toISOString();
  return {
    state: current.length
      ? "busy"
      : next && Date.parse(next.start) - now <= 30 * 60000
        ? "soon"
        : "free",
    current,
    next,
    freeAt: current.length ? new Date(freeAt).toISOString() : null,
    freeUntil: after?.start || null,
    horizon,
    lastSuccess: snapshot.lastSuccess,
  };
}
