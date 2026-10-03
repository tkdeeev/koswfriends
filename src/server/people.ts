import { and, eq, sql } from "drizzle-orm";
import { database } from "./db";
import { users, snapshots } from "./schema";
import { related, isBlocked, canRead } from "./sharing";
import { personalEventRows } from "./personal-events";
import { expandPersonalEvents } from "../lib/personal-events";
import { currentSemester } from "../lib/calendar";
import { feedRows, combineFeeds, type FeedData } from "./feeds";
import { semesterWindow } from "../lib/calendar";
import {
  availability,
  unknownAvailability,
  type PersonOverview,
} from "../lib/availability";

export async function peopleOverview(
  viewer: string,
  id?: string,
): Promise<PersonOverview[]> {
  const semester = currentSemester();
  // Snapshot and custom events are read only within the live sharing predicate.
  const rows = await database()
    .select({
      id: users.id,
      username: users.username,
      accountType: users.accountType,
      name: users.name,
      avatarVersion: users.avatarVersion,
      allowed: sql<boolean>`(${users.id} = ${viewer} or ${canRead(users.id, viewer, "calendar")})`,
      events: snapshots.events,
      window: snapshots.window,
      lastSuccess: snapshots.lastSuccess,
      error: snapshots.error,
      feeds: sql<
        FeedData[]
      >`case when (${users.id} = ${viewer} or ${canRead(users.id, viewer, "calendar")}) then ${feedRows(users.id, semester)} else '[]'::jsonb end`,
      personal:
        sql`case when (${users.id} = ${viewer} or ${canRead(users.id, viewer, "calendar")}) then ${personalEventRows(users.id, semester)} else '[]'::jsonb end`.mapWith(
          (v) => v as Parameters<typeof expandPersonalEvents>[0],
        ),
    })
    .from(users)
    .leftJoin(
      snapshots,
      and(
        eq(snapshots.userId, users.id),
        eq(snapshots.semester, semester),
        sql`(${users.id} = ${viewer} or ${canRead(users.id, viewer, "calendar")})`,
      ),
    )
    .where(
      and(
        id ? eq(users.id, id) : undefined,
        sql`(${users.id} = ${viewer} or (${related(users.id, viewer)} and not ${isBlocked(users.id, viewer)}))`,
      ),
    );
  return rows.map((row) => {
    const calendar = combineFeeds(
      {
        events: row.events || [],
        lastSuccess: row.lastSuccess,
        error: row.error,
      },
      row.feeds,
    );
    return {
      person: {
        id: row.id,
        username: row.username,
        accountType: row.accountType,
        name: row.name,
        avatarVersion: row.avatarVersion,
      },
      availability: !row.allowed
        ? unknownAvailability("private")
        : row.window || row.feeds.length
          ? availability(
              [...calendar.events, ...expandPersonalEvents(row.personal)],
              {
                semester: row.window || semesterWindow(semester),
                error: calendar.error,
                lastSuccess: calendar.lastSuccess,
              },
            )
          : unknownAvailability(),
    };
  });
}
