import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/server/db";
import { friendships, grants, snapshots, users } from "@/server/schema";
import { endpoint, json, session } from "@/server/http";
import { acceptedGrant } from "@/server/friends";
import { semesterWindow } from "@/lib/calendar";
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
  const shared = ids.length
    ? await database()
        .select({
          userId: users.id,
          username: users.username,
          events: snapshots.events,
          lastSuccess: snapshots.lastSuccess,
          error: snapshots.error,
          semester: snapshots.window,
        })
        .from(grants)
        .innerJoin(friendships, acceptedGrant(user.id, "calendar"))
        .innerJoin(users, eq(users.id, grants.owner))
        .leftJoin(
          snapshots,
          and(
            eq(snapshots.userId, grants.owner),
            eq(snapshots.semester, semester),
          ),
        )
        .where(inArray(grants.owner, ids))
    : [];
  return json({
    calendars: [
      {
        userId: user.id,
        username: user.username,
        events: own?.events || [],
        lastSuccess: own?.lastSuccess || null,
        error: own?.error || null,
        semester: own?.window || semesterWindow(semester),
      },
      ...shared.map((s) => ({
        ...s,
        events: s.events || [],
        semester: s.semester || semesterWindow(semester),
      })),
    ],
    revoked: ids.filter((id) => !shared.some((s) => s.userId === id)),
  });
});
