import type { BrowserContext } from "@playwright/test";
import { DateTime } from "luxon";
import { database } from "../../src/server/db";
import { users, sessions, snapshots } from "../../src/server/schema";
import { hash } from "../../src/server/security";
import { currentSemester, semesterWindow, ZONE } from "../../src/lib/calendar";
import type { Lesson } from "../../src/lib/types";
if (process.env.KWF_TEST_DATABASE !== "yes")
  throw new Error("Only synthetic test databases are allowed");
let sequence = 0;
export async function seed(context: BrowserContext) {
  const username = `synthetic-${process.pid}-${++sequence}`;
  const semester = currentSemester();
  const [user] = await database()
    .insert(users)
    .values({ username, name: username, semester })
    .returning();
  const token = `synthetic-session-${username}`;
  await database()
    .insert(sessions)
    .values({
      userId: user.id,
      hash: hash(token),
      csrf: `synthetic-csrf-${username}`,
      expiresAt: new Date(Date.now() + 3600000),
    });
  const start = DateTime.now()
    .setZone(ZONE)
    .startOf("week")
    .plus({ days: 3, hours: 9 });
  const lesson: Lesson = {
    id: "synthetic-common-1",
    course: "TEST-MAT",
    title: { cs: "Ilustrační matematika", en: "Illustrative mathematics" },
    group: "101",
    type: "tutorial",
    start: start.toISO()!,
    end: start.plus({ minutes: 90 }).toISO()!,
    room: "TEST-101",
    cancelled: false,
  };
  await database()
    .insert(snapshots)
    .values({
      userId: user.id,
      semester,
      window: { ...semesterWindow(semester), verified: true },
      events: [
        lesson,
        {
          ...lesson,
          id: "synthetic-overlap",
          course: "TEST-PRG",
          start: start.plus({ minutes: 45 }).toISO()!,
          end: start.plus({ minutes: 135 }).toISO()!,
        },
        {
          ...lesson,
          id: "synthetic-cancelled",
          course: "TEST-CANCEL",
          cancelled: true,
          start: start.plus({ days: 1 }).toISO()!,
          end: start.plus({ days: 1, minutes: 90 }).toISO()!,
        },
      ],
      lastSuccess: new Date(),
    });
  await context.addCookies([
    {
      name: "kwf_session",
      value: token,
      url: "http://localhost:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return user;
}
