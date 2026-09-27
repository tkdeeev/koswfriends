import { and, eq, sql } from "drizzle-orm";
import { database } from "./db";
import { users, snapshots } from "./schema";
import { related, isBlocked, canRead } from "./sharing";
import { personalEventRows } from "./personal-events";
import { expandPersonalEvents } from "../lib/personal-events";
import { currentSemester } from "../lib/calendar";
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
      name: users.name,
      avatarVersion: users.avatarVersion,
      allowed: sql<boolean>`(${users.id} = ${viewer} or ${canRead(users.id, viewer, "calendar")})`,
      events: snapshots.events,
      window: snapshots.window,
      lastSuccess: snapshots.lastSuccess,
      error: snapshots.error,
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
  return rows.map((row) => ({
    person: {
      id: row.id,
      username: row.username,
      name: row.name,
      avatarVersion: row.avatarVersion,
    },
    availability: !row.allowed
      ? unknownAvailability("private")
      : row.window
        ? availability(
            [...(row.events || []), ...expandPersonalEvents(row.personal)],
            {
              semester: row.window,
              error: row.error,
              lastSuccess: row.lastSuccess?.toISOString() || null,
            },
          )
        : unknownAvailability(),
  }));
}
