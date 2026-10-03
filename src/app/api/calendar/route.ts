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
import { feedRows, combineFeeds } from "@/server/feeds";
export const dynamic = "force-dynamic";
export const GET = endpoint(async (req) => {
  const { user } = await session(req);
  const semester = z
    .string()
    .regex(/^B\d{2}[12]$/)
    .parse(req.nextUrl.searchParams.get("semester") || user.semester);
  const all = req.nextUrl.searchParams.get("friends") === "all";
  const ids = z
    .array(z.uuid())
    .max(1000)
    .parse(
      (all ? "" : req.nextUrl.searchParams.get("friends") || "")
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
    .select({
      events: personalEventRows(user.id, semester),
      feeds: feedRows(user.id, semester),
    })
    .from(users)
    .where(eq(users.id, user.id));
  const ownCalendar = combineFeeds(
    {
      events: own?.events || [],
      lastSuccess: own?.lastSuccess || null,
      error: own?.error || null,
    },
    personal.feeds,
  );
  const ownEvents = [
    ...ownCalendar.events,
    ...expandPersonalEvents(personal.events),
  ];
  const sharedRows = await database()
    .select({
      userId: users.id,
      username: users.username,
      accountType: users.accountType,
      name: users.name,
      avatarVersion: users.avatarVersion,
      events: snapshots.events,
      lastSuccess: snapshots.lastSuccess,
      error: snapshots.error,
      semester: snapshots.window,
      personal: personalEventRows(users.id, semester),
      feeds: feedRows(users.id, semester),
    })
    .from(users)
    .leftJoin(
      snapshots,
      and(eq(snapshots.userId, users.id), eq(snapshots.semester, semester)),
    )
    .where(canRead(users.id, user.id, "calendar"));
  const shared = sharedRows.map(({ personal, feeds, ...row }) => {
    const imported = combineFeeds({ ...row, events: row.events || [] }, feeds);
    return {
      ...row,
      ...imported,
      events: [...imported.events, ...expandPersonalEvents(personal)],
    };
  });
  // Matching attendees remain available even when overlays are switched off.
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
        accountType: person.accountType,
        name: person.name,
        avatarVersion: person.avatarVersion,
      });
    }
  return json({
    calendars: [
      {
        userId: user.id,
        username: user.username,
        accountType: user.accountType,
        name: user.name,
        avatarVersion: user.avatarVersion,
        events: ownEvents,
        lastSuccess: ownCalendar.lastSuccess,
        error: ownCalendar.error,
        semester: own?.window || semesterWindow(semester),
      },
      ...shared
        .filter((s) => all || ids.includes(s.userId))
        .map((s) => ({
          ...s,
          events: s.events || [],
          semester: s.semester || semesterWindow(semester),
        })),
    ],
    people: shared.map((p) => ({
      id: p.userId,
      username: p.username,
      accountType: p.accountType,
      name: p.name,
      avatarVersion: p.avatarVersion,
    })),
    attendees,
    revoked: ids.filter((id) => !shared.some((s) => s.userId === id)),
  });
});
