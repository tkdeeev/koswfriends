import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  commonLessons,
  conflicts,
  currentSemester,
  daySegments,
  overlaps,
  semesterWindow,
} from "../src/lib/calendar";
import type { Lesson } from "../src/lib/types";
const lesson = (
  id: string,
  start = "2026-10-20T09:00:00+02:00",
  end = "2026-10-20T10:30:00+02:00",
): Lesson => ({
  id,
  start,
  end,
  course: "TEST-MAT",
  title: { cs: "Test", en: "Test" },
  group: "101",
  type: "tutorial",
  room: "TEST",
  cancelled: false,
});
describe("actual lesson identity and intervals", () => {
  it("matches common lessons by identity rather than course or time", () => {
    const a = lesson("1");
    expect(commonLessons([a], [lesson("2")])).toEqual([]);
    expect(commonLessons([a], [a])).toEqual([a]);
  });
  it("uses half-open intervals and ignores cancelled or identical events", () => {
    const a = lesson("1");
    expect(overlaps(a, lesson("2"))).toBe(true);
    expect(overlaps(a, lesson("2", a.end, "2026-10-20T12:00:00+02:00"))).toBe(
      false,
    );
    expect(overlaps(a, { ...lesson("2"), cancelled: true })).toBe(false);
    expect(conflicts([a, a])).toEqual([]);
  });
  it("compares instants with differing UTC offsets correctly", () => {
    expect(
      overlaps(
        lesson("1", "2026-10-25T02:00:00+02:00", "2026-10-25T02:30:00+02:00"),
        lesson("2", "2026-10-25T02:00:00+01:00", "2026-10-25T02:30:00+01:00"),
      ),
    ).toBe(false);
  });
  it("splits overnight occurrences at Prague midnights across DST", () => {
    const segments = daySegments(
      lesson("1", "2026-10-24T23:30:00+02:00", "2026-10-25T03:30:00+01:00"),
    );
    expect(segments).toEqual([
      { date: "2026-10-24", startMinute: 1410, endMinute: 1440 },
      { date: "2026-10-25", startMinute: 0, endMinute: 210 },
    ]);
  });
  it("selects the academic semester and labels estimates", () => {
    expect(currentSemester(DateTime.fromISO("2027-01-10"))).toBe("B261");
    expect(currentSemester(DateTime.fromISO("2027-03-10"))).toBe("B262");
    expect(semesterWindow("B261").verified).toBe(false);
    expect(() => semesterWindow("../oops")).toThrow();
  });
});

import { expandPersonalEvents } from "../src/lib/personal-events";
import { initials } from "../src/lib/appearance";
it("keeps weekly personal events at the same Prague time through DST", () => {
  const events = expandPersonalEvents([
    {
      id: "sample",
      semester: "B261",
      course: "TV1-PE",
      title: "Sport",
      room: "Gym",
      color: "#158b98",
      note: "",
      start: "2026-10-20T09:00:00+02:00",
      end: "2026-10-20T10:30:00+02:00",
      repeatUntil: "2026-11-03",
    },
  ]);
  expect(events).toHaveLength(3);
  expect(
    events.map((e) => DateTime.fromISO(e.start, { setZone: true }).hour),
  ).toEqual([9, 9, 9]);
  expect(
    events.map((e) => DateTime.fromISO(e.start, { setZone: true }).offset),
  ).toEqual([120, 60, 60]);
  expect(new Set(events.map((e) => e.id)).size).toBe(3);
});
it("uses the first and sixth CTU username letters for profile initials", () => {
  expect(initials("novakjan")).toBe("NJ");
  expect(initials("a")).toBe("A");
  expect(initials("ab")).toBe("AB");
});
