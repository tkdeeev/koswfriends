import { describe, it, expect } from "vitest";
import { availability } from "../src/lib/availability";
import type { Lesson } from "../src/lib/types";
const now = Date.parse("2026-10-20T10:00:00+02:00");
const snapshot = {
  lastSuccess: new Date(now - 60000).toISOString(),
  error: null,
  semester: {
    code: "B261",
    from: "2026-09-01T00:00:00+02:00",
    to: "2027-02-01T00:00:00+01:00",
    verified: true,
  },
};
function event(
  id: string,
  from: string,
  to: string,
  cancelled = false,
): Lesson {
  return {
    id,
    start: `2026-10-20T${from}:00+02:00`,
    end: `2026-10-20T${to}:00+02:00`,
    cancelled,
    course: "TEST",
    title: { cs: "TEST", en: "TEST" },
    group: "1",
    room: "TEST",
    type: "lecture",
  };
}
describe("timetable availability", () => {
  it("merges overlapping and adjacent classes to find the actual next free time", () => {
    const result = availability(
      [
        event("a", "09:00", "10:30"),
        event("b", "10:15", "11:00"),
        event("c", "11:00", "11:45"),
        event("gap", "12:00", "13:00"),
        event("cancelled", "11:40", "14:00", true),
      ],
      snapshot,
      now,
    );
    expect(result.state).toBe("busy");
    expect(result.current.map((e) => e.id)).toEqual(["a"]);
    expect(result.freeAt).toBe("2026-10-20T09:45:00.000Z");
    expect(result.freeUntil).toBe("2026-10-20T12:00:00+02:00");
  });
  it("treats the end as free and includes custom lessons in starting-soon status", () => {
    expect(
      availability([event("ended", "09:00", "10:00")], snapshot, now).state,
    ).toBe("free");
    const personal = {
      ...event("p", "10:20", "11:00"),
      personalId: "personal",
      type: "personal",
    };
    expect(availability([personal], snapshot, now)).toMatchObject({
      state: "soon",
      next: personal,
      freeUntil: personal.start,
    });
  });
  it("does not invent availability for missing, stale, failed or out-of-period imports", () => {
    for (const data of [
      { ...snapshot, lastSuccess: null },
      { ...snapshot, lastSuccess: new Date(now - 25 * 3600000).toISOString() },
      { ...snapshot, error: "reconnect" },
      {
        ...snapshot,
        semester: { ...snapshot.semester, from: "2027-09-01T00:00:00Z" },
      },
    ])
      expect(
        availability([event("busy", "09:00", "11:00")], data, now),
      ).toMatchObject({
        state: "unknown",
        current: [],
        next: null,
        freeAt: null,
      });
  });
  it("bounds a clear empty timetable to today and skips cancelled lessons", () => {
    expect(
      availability([event("cancelled", "10:10", "11:00", true)], snapshot, now),
    ).toMatchObject({
      state: "free",
      next: null,
      horizon: "2026-10-20T21:59:59.999Z",
    });
  });
});
