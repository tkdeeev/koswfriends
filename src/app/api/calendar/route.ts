import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/server/db";
import { snapshots, users } from "@/server/schema";
import { endpoint, json, session } from "@/server/http";
import { canRead } from "@/server/sharing";
import { personalEventRows } from "@/server/personal-events";
import { expandPersonalEvents } from "@/lib/personal-events";
import { semesterWindow } from "@/lib/calendar";
import type { Person } from "@/lib/types";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const semester = z
    .string()
    .regex(/^B\d{2}[12]$/)
    .parse(req.nextUrl.searchParams.get("semester") || user.semester);
  const ids = z
    .array(z.uuid())
    .max(30)
    .parse(
      (req.nextUrl.searchParams.get("friends") || "")
        .split(",")
        .filter(Boolean),
    );
  const [own] = await database()
    .select()
    .from(snapshots)
    .where(
      and(eq(snapshots.userId, user.id), eq(snapshots.semester, semester)),
    );
  const [personal] = await database()
    .select({ events: personalEventRows(user.id, semester) })
    .from(users)
    .where(eq(users.id, user.id));
  const ownEvents = [
    ...(own?.events || []),
    ...expandPersonalEvents(personal.events),
  ];
  const sharedRows = await database()
    .select({
      userId: users.id,
      username: users.username,
      name: users.name,
      events: snapshots.events,
      lastSuccess: snapshots.lastSuccess,
      error: snapshots.error,
      semester: snapshots.window,
      personal: personalEventRows(users.id, semester),
    })
    .from(users)
    .leftJoin(
      snapshots,
      and(eq(snapshots.userId, users.id), eq(snapshots.semester, semester)),
    )
    .where(canRead(users.id, user.id, "calendar"));
  const shared = sharedRows.map(({ personal, ...row }) => ({
    ...row,
    events: [...(row.events || []), ...expandPersonalEvents(personal)],
  }));
  // Default view needs only matching attendees, not everyone's full calendar.
  const ownIds = new Set(
    ownEvents.filter((e) => !e.cancelled).map((e) => e.id),
  );
  const attendees: Record<string, Person[]> = {};
  for (const person of shared)
    for (const event of person.events || []) {
      if (event.cancelled || !ownIds.has(event.id)) continue;
      (attendees[event.id] ||= []).push({
        id: person.userId,
        username: person.username,
        name: person.name,
      });
    }
  return json({
    calendars: [
      {
        userId: user.id,
        username: user.username,
        name: user.name,
        events: ownEvents,
        lastSuccess: own?.lastSuccess || null,
        error: own?.error || null,
        semester: own?.window || semesterWindow(semester),
      },
      ...shared
        .filter((s) => ids.includes(s.userId))
        .map((s) => ({
          ...s,
          events: s.events || [],
          semester: s.semester || semesterWindow(semester),
        })),
    ],
    people: shared.map((p) => ({
      id: p.userId,
      username: p.username,
      name: p.name,
    })),
    attendees,
    revoked: ids.filter((id) => !shared.some((s) => s.userId === id)),
  });
});
