import { DateTime } from "luxon";
import type { Lesson, PersonalEvent } from "./types";
import { ZONE } from "./calendar";
export const PERSONAL_COLOR = "#158b98";
/** Weekly repeats preserve Prague wall-clock time across daylight-saving changes. */
export function expandPersonalEvents(events: PersonalEvent[]): Lesson[] {
  return events.flatMap((event) => {
    let start = DateTime.fromISO(event.start).setZone(ZONE);
    let end = DateTime.fromISO(event.end).setZone(ZONE);
    const until = event.repeatUntil
      ? DateTime.fromISO(event.repeatUntil, { zone: ZONE }).endOf("day")
      : start;
    const result: Lesson[] = [];
    for (let i = 0; start <= until && i < 54; i++) {
      result.push({
        id: `personal:${event.id}:${start.toISODate()}`,
        personalId: event.id,
        course: event.course,
        title: { cs: event.title, en: event.title },
        type: "personal",
        group: "",
        room: event.room,
        start: start.toISO()!,
        end: end.toISO()!,
        cancelled: false,
        color: event.color,
        note: event.note,
      });
      if (!event.repeatUntil) break;
      start = start.plus({ weeks: 1 });
      end = end.plus({ weeks: 1 });
    }
    return result;
  });
}
