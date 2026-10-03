import { Worker } from "node:worker_threads";
import type ICAL from "ical.js";
import type { DateTime as LuxonDateTime } from "luxon";
import type { Lesson, Semester } from "../lib/types";
import { AppError, hash } from "./security";

export const MAX_ICS_BYTES = 1024 * 1024;
// Runs in a disposable worker: even a pathological recurrence cannot stall web/worker.
function parseCalendar(
  ical: typeof ICAL,
  DateTime: typeof LuxonDateTime,
  text: string,
  window: Semester,
) {
  const fail = (code = "ics_invalid"): never => {
    throw new Error(code);
  };
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n[ \t]|\n[ \t]/g, "")
    .split(/\r?\n/);
  if (lines.length > 20000 || lines.some((line) => line.length > 8192))
    fail("ics_limit");
  let depth = 0,
    components = 0;
  for (const line of lines) {
    if (/^BEGIN:/i.test(line)) {
      if (++depth > 5 || ++components > 3000) fail("ics_limit");
    }
    if (/^END:/i.test(line) && --depth < 0) fail();
    if (/^RRULE:/i.test(line)) {
      const rule: Record<string, string> = Object.fromEntries(
        line
          .slice(6)
          .toUpperCase()
          .split(";")
          .map((part) => part.split("=")),
      );
      if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(rule.FREQ))
        fail("ics_limit");
      // Prevent huge BYxxx Cartesian products before the library builds them.
      let combinations = 1;
      for (const [key, value] of Object.entries(rule)) {
        if (!value || value.length > 512) fail("ics_limit");
        if (key.startsWith("BY")) combinations *= value.split(",").length;
      }
      if (
        combinations > 366 ||
        Number(rule.INTERVAL || 1) > 1000 ||
        Number(rule.INTERVAL || 1) < 1
      )
        fail("ics_limit");
    }
  }
  if (
    depth !== 0 ||
    !/^BEGIN:VCALENDAR\s*$/i.test(lines[0]) ||
    !/^END:VCALENDAR\s*$/i.test(lines.filter(Boolean).at(-1) || "")
  )
    fail();
  const root = new ical.Component(ical.parse(lines.join("\r\n")));
  if (root.name !== "vcalendar") fail();
  const componentsList = root.getAllSubcomponents("vevent");
  if (componentsList.length > 1000) fail("ics_limit");
  const records = componentsList.map(
    (c) => new ical.Event(c, { exceptions: [] }),
  );
  const byUid = new Map<string, InstanceType<typeof ical.Event>>();
  for (const event of records) {
    if (
      !event.uid ||
      event.uid.length > 512 ||
      !event.component.hasProperty("dtstart")
    )
      fail();
    if (!event.isRecurrenceException()) {
      if (byUid.has(event.uid)) fail();
      byUid.set(event.uid, event);
    }
  }
  for (const event of records)
    if (event.isRecurrenceException()) {
      const parent = byUid.get(event.uid);
      if (parent) parent.relateException(event);
      else byUid.set(event.uid, event);
    }
  const from = Date.parse(window.from),
    to = Date.parse(window.to);
  // Floating/date-only values follow Prague; unbundled IANA TZIDs use Intl via Luxon.
  function timestamp(
    time: InstanceType<typeof ical.Time>,
    component: InstanceType<typeof ical.Component>,
    property = "dtstart",
  ) {
    if (time.year < 1900 || time.year > 2200) fail("ics_limit");
    const propertyValue =
      component.getFirstProperty(property) ||
      component.getFirstProperty("dtstart");
    const tzid = propertyValue?.getParameter("tzid");
    if (time.zone.tzid !== "floating" && time.zone.tzid !== "local")
      return time.toUnixTime() * 1000;
    const date = DateTime.fromObject(
      {
        year: time.year,
        month: time.month,
        day: time.day,
        hour: time.hour,
        minute: time.minute,
        second: time.second,
      },
      { zone: typeof tzid === "string" ? tzid : "Europe/Prague" },
    );
    if (!date.isValid) fail();
    return date.toMillis();
  }
  const output: Lesson[] = [];
  let steps = 0;
  function add(
    event: InstanceType<typeof ical.Event>,
    start: InstanceType<typeof ical.Time>,
    end: InstanceType<typeof ical.Time>,
    recurrence: string,
  ) {
    const a = timestamp(start, event.component),
      b = timestamp(end, event.component, "dtend");
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      b <= a ||
      b - a > 14 * 86400000
    )
      fail();
    if (a >= to || b <= from) return;
    const title = (event.summary || "Calendar event").slice(0, 200);
    output.push({
      id: `${event.uid}\n${recurrence}`,
      course: "",
      title: { cs: title, en: title },
      type: "ics",
      group: "",
      start: new Date(a).toISOString(),
      end: new Date(b).toISOString(),
      room: (event.location || "").slice(0, 200),
      cancelled:
        event.component.getFirstPropertyValue("status") === "CANCELLED",
    });
    if (output.length > 2000) fail("ics_limit");
  }
  for (const event of byUid.values()) {
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate, event.startDate.toString());
      continue;
    }
    if (
      !event.component.hasProperty("rrule") &&
      event.component.hasProperty("rdate")
    ) {
      const excluded = event.component
        .getAllProperties("exdate")
        .flatMap((p) => p.getValues())
        .some((date) => String(date) === event.startDate.toString());
      if (!excluded) {
        const first = event.getOccurrenceDetails(event.startDate);
        add(
          first.item,
          first.startDate,
          first.endDate,
          event.startDate.toString(),
        );
      }
    }
    const iterator = event.iterator();
    for (;;) {
      if (++steps > 10000) fail("ics_limit");
      const occurrence = iterator.next();
      if (!occurrence) break;
      // Include moved occurrences around the boundary; exceptions are bounded above.
      if (timestamp(occurrence, event.component) >= to + 14 * 86400000) break;
      const details = event.getOccurrenceDetails(occurrence);
      add(
        details.item,
        details.startDate,
        details.endDate,
        occurrence.toString(),
      );
    }
  }
  // Include explicit exceptions moved into this window from outside the series window.
  for (const event of records.filter((e) => e.isRecurrenceException())) {
    const recurrence = event.component.getFirstPropertyValue("recurrence-id");
    add(event, event.startDate, event.endDate, String(recurrence));
  }
  const unique = [
    ...new Map(output.map((event) => [event.id, event])).values(),
  ];
  const perDay = new Map<string, number>();
  for (const event of unique) {
    let day = DateTime.fromISO(event.start)
      .setZone("Europe/Prague")
      .startOf("day");
    while (day.toMillis() < Date.parse(event.end)) {
      const key = day.toISODate()!;
      const count = (perDay.get(key) || 0) + 1;
      if (count > 100) fail("ics_limit");
      perDay.set(key, count);
      day = day.plus({ days: 1 });
    }
  }
  return unique;
}

export async function parseIcs(
  text: string,
  window: Semester,
): Promise<Lesson[]> {
  if (Buffer.byteLength(text) > MAX_ICS_BYTES) throw new AppError("ics_limit");
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      `const { parentPort, workerData } = require('node:worker_threads');
      Promise.all([import('ical.js'), import('luxon')]).then(([ical, luxon]) => {
        try { parentPort.postMessage({ events: (${parseCalendar.toString()})(ical.default, luxon.DateTime, workerData.text, workerData.window) }); }
        catch (error) { parentPort.postMessage({ error: error.message === 'ics_limit' ? 'ics_limit' : 'ics_invalid' }); }
      }).catch(() => parentPort.postMessage({ error: 'ics_invalid' }));`,
      {
        eval: true,
        execArgv: [],
        workerData: { text, window },
        resourceLimits: {
          maxOldGenerationSizeMb: 32,
          maxYoungGenerationSizeMb: 8,
          stackSizeMb: 2,
        },
      },
    );
    const finish = (error?: string, events?: Lesson[]) => {
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(new AppError(error));
      else
        resolve(
          (events || []).map((event) => ({
            ...event,
            id: `ics:${hash(event.id)}`,
          })),
        );
    };
    const timer = setTimeout(() => finish("ics_limit"), 5000);
    worker.once("message", (message) => finish(message.error, message.events));
    worker.once("error", () => finish("ics_limit"));
    worker.once("exit", (code) => {
      if (code !== 0) finish("ics_limit");
    });
  });
}
