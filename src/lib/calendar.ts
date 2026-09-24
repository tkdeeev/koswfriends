import { DateTime } from "luxon";
import type { Lesson, Semester } from "./types";
export const ZONE = "Europe/Prague";
export function currentSemester(now = DateTime.now().setZone(ZONE)) {
  const year = now.month < 9 ? now.year - 1 : now.year;
  return `B${String(year).slice(-2)}${now.month >= 2 && now.month < 9 ? 2 : 1}`;
}
export function semesterWindow(code: string): Semester {
  if (!/^B\d{2}[12]$/.test(code)) throw new Error("invalid_semester");
  const year = 2000 + Number(code.slice(1, 3));
  const summer = code.endsWith("2");
  const from = DateTime.fromObject(
    { year: year + (summer ? 1 : 0), month: summer ? 2 : 9, day: 1 },
    { zone: ZONE },
  );
  const to = summer
    ? from.set({ month: 9 })
    : from.plus({ years: 1 }).set({ month: 2 });
  return { code, from: from.toISO()!, to: to.toISO()!, verified: false };
}
export function semesterOptions(now = DateTime.now().setZone(ZONE)) {
  const year = Number(currentSemester(now).slice(1, 3));
  return [year - 1, year, year + 1].flatMap((y) => [
    `B${String(y).padStart(2, "0")}1`,
    `B${String(y).padStart(2, "0")}2`,
  ]);
}
export function overlaps(a: Lesson, b: Lesson) {
  return (
    !a.cancelled &&
    !b.cancelled &&
    a.id !== b.id &&
    Date.parse(a.start) < Date.parse(b.end) &&
    Date.parse(b.start) < Date.parse(a.end)
  );
}
export function commonLessons(own: Lesson[], friends: Lesson[]) {
  const ids = new Set(friends.filter((e) => !e.cancelled).map((e) => e.id));
  return own.filter((e) => !e.cancelled && ids.has(e.id));
}
export function conflicts(events: Lesson[]) {
  const unique = [...new Map(events.map((e) => [e.id, e])).values()].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const pairs: [Lesson, Lesson][] = [];
  for (let i = 0; i < unique.length; i++)
    for (
      let j = i + 1;
      j < unique.length &&
      Date.parse(unique[j].start) < Date.parse(unique[i].end);
      j++
    ) {
      if (overlaps(unique[i], unique[j])) pairs.push([unique[i], unique[j]]);
    }
  return pairs;
}
/** Split at Prague midnights; day arithmetic must respect 23/25-hour DST days. */
export function daySegments(event: Lesson) {
  const end = DateTime.fromISO(event.end).setZone(ZONE);
  let cursor = DateTime.fromISO(event.start).setZone(ZONE);
  const out: { date: string; startMinute: number; endMinute: number }[] = [];
  while (cursor < end && out.length < 14) {
    const midnight = cursor.startOf("day").plus({ days: 1 });
    const segmentEnd = end < midnight ? end : midnight;
    out.push({
      date: cursor.toISODate()!,
      startMinute: cursor.hour * 60 + cursor.minute,
      endMinute: segmentEnd.equals(midnight)
        ? 1440
        : segmentEnd.hour * 60 + segmentEnd.minute,
    });
    cursor = segmentEnd;
  }
  return out;
}
