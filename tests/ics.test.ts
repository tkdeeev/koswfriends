import { describe, expect, it } from "vitest";
import { parseIcs, MAX_ICS_BYTES } from "../src/server/ics";
import { semesterWindow } from "../src/lib/calendar";
const window = semesterWindow("B261");
const calendar = (events: string) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Synthetic test//EN\r\n${events}\r\nEND:VCALENDAR\r\n`;
const event = (properties = "") =>
  `BEGIN:VEVENT\r\nUID:synthetic-course\r\nDTSTART;TZID=Europe/Prague:20261020T090000\r\nDTEND;TZID=Europe/Prague:20261020T103000\r\nSUMMARY:Mathematics\r\nLOCATION:Room 1\r\n${properties}\r\nEND:VEVENT`;
describe("bounded ICS imports", () => {
  it("rejects feeds that overload a single day even below the file/event-count limits", async () => {
    const dense = Array.from({ length: 101 }, (_, i) =>
      event().replace("UID:synthetic-course", `UID:dense-${i}`),
    ).join("\r\n");
    await expect(parseIcs(calendar(dense), window)).rejects.toMatchObject({
      code: "ics_limit",
    });
  });
  it("honors embedded custom timezones", async () => {
    const timezone =
      "BEGIN:VTIMEZONE\r\nTZID:CustomCampus\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0300\r\nTZOFFSETTO:+0300\r\nEND:STANDARD\r\nEND:VTIMEZONE";
    const rows = await parseIcs(
      calendar(
        timezone + "\r\n" + event().replaceAll("Europe/Prague", "CustomCampus"),
      ),
      window,
    );
    expect(rows[0].start).toBe("2026-10-20T06:00:00.000Z");
  });
  it("handles impossible recurrence dates without hanging", async () => {
    const before = Date.now();
    await expect(
      parseIcs(
        calendar(event("RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30")),
        window,
      ),
    ).resolves.toEqual([]);
    expect(Date.now() - before).toBeLessThan(6500);
  });
  it("imports IANA timezones with DST, weekly recurrence, EXDATE, and moved/cancelled exceptions", async () => {
    const moved = `BEGIN:VEVENT\r\nUID:synthetic-course\r\nRECURRENCE-ID;TZID=Europe/Prague:20261027T090000\r\nDTSTART;TZID=Europe/Prague:20261027T110000\r\nDTEND;TZID=Europe/Prague:20261027T123000\r\nSUMMARY:Moved class\r\nSTATUS:CANCELLED\r\nEND:VEVENT`;
    const rows = await parseIcs(
      calendar(
        event(
          "RRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE;TZID=Europe/Prague:20261103T090000",
        ) +
          "\r\n" +
          moved,
      ),
      window,
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      start: "2026-10-20T07:00:00.000Z",
      end: "2026-10-20T08:30:00.000Z",
      room: "Room 1",
    });
    expect(rows[1]).toMatchObject({
      start: "2026-10-27T10:00:00.000Z",
      cancelled: true,
      title: { en: "Moved class" },
    });
    expect(rows[2].start).toBe("2026-11-10T08:00:00.000Z");
    expect(rows.every((row) => /^ics:[a-f0-9]{64}$/.test(row.id))).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
  });
  it("handles UTC, floating values, folded/escaped text, all-day events, RDATE and empty calendars", async () => {
    const input = event()
      .replace(
        "DTSTART;TZID=Europe/Prague:20261020T090000",
        "DTSTART:20261020T090000Z",
      )
      .replace(
        "DTEND;TZID=Europe/Prague:20261020T103000",
        "DTEND:20261020T103000Z",
      )
      .replace("SUMMARY:Mathematics", "SUMMARY:Long\\, folded\r\n  title");
    expect((await parseIcs(calendar(input), window))[0]).toMatchObject({
      start: "2026-10-20T09:00:00.000Z",
      title: { en: "Long, folded title" },
    });
    const floating = event().replaceAll(";TZID=Europe/Prague", "");
    expect((await parseIcs(calendar(floating), window))[0].start).toBe(
      "2026-10-20T07:00:00.000Z",
    );
    const day = event()
      .replace(
        "DTSTART;TZID=Europe/Prague:20261020T090000",
        "DTSTART;VALUE=DATE:20261020",
      )
      .replace(
        "DTEND;TZID=Europe/Prague:20261020T103000",
        "DTEND;VALUE=DATE:20261021",
      );
    expect((await parseIcs(calendar(day), window))[0]).toMatchObject({
      start: "2026-10-19T22:00:00.000Z",
      end: "2026-10-20T22:00:00.000Z",
    });
    expect(
      await parseIcs(
        calendar(event("RDATE;TZID=Europe/Prague:20261022T090000")),
        window,
      ),
    ).toHaveLength(2);
    expect(await parseIcs(calendar(""), window)).toEqual([]);
  });
  it("ignores out-of-window events and never executes embedded markup, alarms, or attachments", async () => {
    const rows = await parseIcs(
      calendar(
        event(
          "DESCRIPTION:<script>alert(1)</script>\r\nATTACH:https://127.0.0.1/private\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT5M\r\nDESCRIPTION:test\r\nEND:VALARM",
        ),
      ),
      window,
    );
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("127.0.0.1");
    expect(
      await parseIcs(
        calendar(event().replaceAll("20261020", "20250801")),
        window,
      ),
    ).toEqual([]);
  });
  it("rejects malformed calendars, unbounded downloads, deep nesting, dense rules, and excessive event duration", async () => {
    await expect(
      parseIcs("x".repeat(MAX_ICS_BYTES + 1), window),
    ).rejects.toMatchObject({ code: "ics_limit" });
    for (const text of [
      "<html>not ICS</html>",
      calendar(event().replace("20261020T103000", "20261020T080000")),
      calendar(event().replace("20261020T103000", "20271120T103000")),
      calendar(event().replace("UID:synthetic-course", "")),
    ]) {
      await expect(parseIcs(text, window)).rejects.toMatchObject({
        code: "ics_invalid",
      });
    }
    for (const text of [
      calendar(event("RRULE:FREQ=SECONDLY")),
      calendar(
        event(
          "RRULE:FREQ=DAILY;BYHOUR=" +
            Array.from({ length: 24 }, (_, i) => i).join(",") +
            ";BYMINUTE=" +
            Array.from({ length: 60 }, (_, i) => i).join(","),
        ),
      ),
      calendar("BEGIN:V\r\n".repeat(6) + "END:V\r\n".repeat(6)),
      calendar(
        event("RRULE:FREQ=DAILY;COUNT=999999").replaceAll(
          "20261020",
          "19000101",
        ),
      ),
    ]) {
      await expect(parseIcs(text, window)).rejects.toMatchObject({
        code: "ics_limit",
      });
    }
  });
});
