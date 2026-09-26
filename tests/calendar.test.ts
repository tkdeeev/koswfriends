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
import { initials, avatarColor } from "../src/lib/appearance";
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

import { arrangeDay, joinAdjacentLessons } from "../src/lib/timetable-layout";
describe("bounded weekly lesson layout", () => {
  const slot = (id: string, startMinute: number, endMinute: number) => ({
    id,
    startMinute,
    endMinute,
  });
  it("uses at most three lanes and reuses lanes for touching lessons", () => {
    const result = arrangeDay([
      slot("a", 540, 600),
      slot("b", 540, 660),
      slot("c", 540, 660),
      slot("d", 600, 660),
      slot("later", 660, 720),
    ]);
    expect(result.overflow).toEqual([]);
    expect(result.visible).toHaveLength(5);
    expect(result.visible.find((x) => x.id === "d")?.column).toBe(0);
    expect(result.visible.find((x) => x.id === "later")?.columns).toBe(1);
    expect(Math.max(...result.visible.map((x) => x.columns))).toBe(3);
  });
  it("reserves one lane for the full count of hidden lessons in each crowded cluster", () => {
    const result = arrangeDay([
      slot("a", 540, 600),
      slot("b", 540, 660),
      slot("c", 540, 660),
      slot("d", 540, 660),
      slot("e", 600, 660),
      slot("f", 600, 660),
      slot("later", 720, 780),
    ]);
    expect(result.visible.map((x) => x.id)).toEqual(["a", "b", "e", "later"]);
    expect(result.overflow).toEqual([
      { startMinute: 540, endMinute: 660, count: 3, column: 2, columns: 3 },
    ]);
    expect(result.visible.find((x) => x.id === "later")?.columns).toBe(1);
  });
  it("expands every lesson including dense and chained overlaps without dropping events", () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      slot(String(i), 540 + i * 5, 630 + i * 5),
    );
    const compact = arrangeDay(events),
      full = arrangeDay(events, Infinity);
    expect(
      compact.visible.length +
        compact.overflow.reduce((n, x) => n + x.count, 0),
    ).toBe(events.length);
    expect(full.overflow).toEqual([]);
    expect(new Set(full.visible.map((x) => x.id)).size).toBe(events.length);
    for (const a of full.visible)
      for (const b of full.visible)
        if (
          a.id !== b.id &&
          a.startMinute < b.endMinute &&
          b.startMinute < a.endMinute
        )
          expect(a.column).not.toBe(b.column);
  });
  it("keeps equal-start priority stable and handles an empty day", () => {
    const events = ["own-a", "own-b", "friend-a", "friend-b"].map((id) =>
      slot(id, 540, 630),
    );
    expect(arrangeDay(events).visible.map((x) => x.id)).toEqual([
      "own-a",
      "own-b",
    ]);
    expect(arrangeDay([])).toEqual({ visible: [], overflow: [] });
  });
});

it("prioritizes later own lessons over earlier overlays in a crowded day", () => {
  const events = [
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `friend-${i}`,
      startMinute: 540,
      endMinute: 660,
      priority: 1,
    })),
    { id: "own-later", startMinute: 585, endMinute: 630, priority: 0 },
  ];
  const result = arrangeDay(events);
  expect(result.visible.map((x) => x.id)).toContain("own-later");
  expect(result.visible).toHaveLength(2);
  expect(result.overflow[0].count).toBe(4);
});

it("keeps later personal and imported own lessons left in compact and expanded days", () => {
  const events = [
    { id: "friend", startMinute: 540, endMinute: 720, priority: 2 },
    { id: "personal", startMinute: 570, endMinute: 630, priority: 0 },
    { id: "school", startMinute: 630, endMinute: 690, priority: 0 },
  ];
  for (const limit of [3, Infinity]) {
    const { visible, overflow } = arrangeDay(events, limit);
    expect(overflow).toEqual([]);
    expect(visible.find((e) => e.id === "friend")?.column).toBe(1);
    expect(
      visible.filter((e) => e.id !== "friend").map((e) => e.column),
    ).toEqual([0, 0]);
    expect(visible.every((e) => e.columns === 2)).toBe(true);
  }
});

it("does not reuse a gap to the left of an overlapping higher-priority lesson", () => {
  const { visible } = arrangeDay(
    [
      { id: "school", startMinute: 540, endMinute: 600, priority: 0 },
      { id: "personal", startMinute: 570, endMinute: 660, priority: 0 },
      { id: "friend", startMinute: 600, endMinute: 690, priority: 2 },
    ],
    Infinity,
  );
  expect(visible.find((e) => e.id === "friend")!.column).toBeGreaterThan(
    visible.find((e) => e.id === "personal")!.column,
  );
});

describe("joined shared lesson cards", () => {
  const event = (id = "shared", extra = {}) => ({
    id,
    startMinute: 540,
    endMinute: 630,
    column: 0,
    columns: 1,
    ...extra,
  });
  it("joins one common lesson across adjacent people while keeping their other lessons", () => {
    const cards = joinAdjacentLessons([
      [event()],
      [event(), event("other", { startMinute: 660, endMinute: 720 })],
      [event()],
    ]);
    expect(cards.map((c) => [c.event.id, c.lane, c.span])).toEqual([
      ["shared", 0, 3],
      ["other", 1, 1],
    ]);
  });
  it("does not imply attendance in an intervening person's column", () => {
    const cards = joinAdjacentLessons([
      [event()],
      [event("different")],
      [event()],
      [event()],
    ]);
    expect(cards.map((c) => [c.event.id, c.lane, c.span])).toEqual([
      ["shared", 0, 1],
      ["different", 1, 1],
      ["shared", 2, 2],
    ]);
    expect(cards.map((c) => [c.continuesBefore, c.continuesAfter])).toEqual([
      [false, true],
      [false, false],
      [true, false],
    ]);
  });
  it("keeps room for concurrent lessons and only joins matching identities and times", () => {
    const cards = joinAdjacentLessons([
      [
        event("shared", { columns: 2 }),
        event("conflict", { column: 1, columns: 2 }),
      ],
      [event()],
      [event()],
      [event("shared", { endMinute: 660 })],
      [event("different")],
    ]);
    expect(cards.map((c) => [c.event.id, c.lane, c.span])).toEqual([
      ["shared", 0, 1],
      ["conflict", 0, 1],
      ["shared", 1, 2],
      ["shared", 3, 1],
      ["different", 4, 1],
    ]);
  });
  it("does not join cancelled lessons, drafts or across an empty lane", () => {
    for (const flag of [{ cancelled: true }, { draft: true }]) {
      expect(
        joinAdjacentLessons([
          [event("shared", flag)],
          [event("shared", flag)],
        ]).every((card) => !card.continuesBefore && !card.continuesAfter),
      ).toBe(true);
      expect(
        joinAdjacentLessons([
          [event("shared", flag)],
          [event("shared", flag)],
        ]).map((c) => c.span),
      ).toEqual([1, 1]);
    }
    expect(
      joinAdjacentLessons([[event()], [], [event()]]).map((c) => c.span),
    ).toEqual([1, 1]);
  });
});

import {
  copy,
  localizedText,
  preferredLocale,
  lessonType,
} from "../src/lib/i18n";
it("provides complete Ukrainian copy and preserves school titles when a translation is unavailable", () => {
  const keys = (value: object, prefix = ""): string[] =>
    Object.entries(value).flatMap(([key, text]) =>
      typeof text === "object"
        ? keys(text, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );
  expect(keys(copy.uk).sort()).toEqual(keys(copy.en).sort());
  expect(keys(copy.cs).sort()).toEqual(keys(copy.en).sort());
  expect(preferredLocale(null, "uk-UA")).toBe("uk");
  expect(preferredLocale("cs", "uk-UA")).toBe("cs");
  expect(preferredLocale("unknown", "uk-UA")).toBe("uk");
  expect(localizedText({ cs: "Matematika", en: "Mathematics" }, "uk")).toBe(
    "Mathematics",
  );
  expect(
    localizedText({ cs: "Matematika", en: "", uk: "Математика" }, "uk"),
  ).toBe("Математика");
  expect(localizedText({ cs: "Matematika", en: "" }, "uk")).toBe("Matematika");
  expect(lessonType("tutorial", "uk")).toBe("Практичне заняття");
});

it("gives usernames a stable broad color range with readable white initials", () => {
  expect(avatarColor(" NovakJan ")).toBe(avatarColor("novakjan"));
  const colors = Array.from({ length: 1000 }, (_, i) =>
    avatarColor(`person-${i}`),
  );
  expect(new Set(colors).size).toBeGreaterThan(950);
  for (const color of colors) {
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    const luminance = [1, 3, 5]
      .map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      )
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});
