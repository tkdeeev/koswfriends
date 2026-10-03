import { and, eq, sql } from "drizzle-orm";
import { database, type TX } from "./db";
import { calendarFeeds, feedSnapshots, users } from "./schema";
import { AppError, decrypt, encrypt, hash, safeCode } from "./security";
import { semesterWindow } from "../lib/calendar";
import { fetchIcs, feedUrl } from "./feed-fetch";
import { parseIcs } from "./ics";
import type { Lesson } from "../lib/types";

export type FeedData = {
  events: Lesson[];
  lastSuccess: string | null;
  error: string | null;
};
export function feedRows(userId: string | typeof users.id, semester: string) {
  return sql<
    FeedData[]
  >`coalesce((select jsonb_agg(jsonb_build_object('events', coalesce(fs.events, '[]'::jsonb), 'lastSuccess', fs.last_success, 'error', coalesce(fs.error, case when fs.last_success is null then 'ics_pending' end))) from calendar_feeds f left join feed_snapshots fs on fs.feed_id = f.id and fs.semester = ${semester} where f.user_id = ${userId}), '[]'::jsonb)`;
}
export function combineFeeds(
  source: {
    events: Lesson[];
    lastSuccess: Date | string | null;
    error: string | null;
  },
  feeds: FeedData[],
) {
  const dates = [source.lastSuccess, ...feeds.map((f) => f.lastSuccess)]
    .filter(Boolean)
    .map((d) => new Date(d!).getTime());
  return {
    events: [
      ...new Map(
        [...source.events, ...feeds.flatMap((f) => f.events)].map((event) => [
          event.id,
          event,
        ]),
      ).values(),
    ],
    lastSuccess: dates.length
      ? new Date(Math.min(...dates)).toISOString()
      : null,
    error: source.error || feeds.find((f) => f.error)?.error || null,
  };
}
async function lockFeeds(tx: TX, userId: string, wait = true) {
  const result = await tx.execute(
    wait
      ? sql`select pg_advisory_xact_lock(hashtext(${`feeds:${userId}`}))`
      : sql`select pg_try_advisory_xact_lock(hashtext(${`feeds:${userId}`})) as acquired`,
  );
  if (!wait && !result[0]?.acquired) throw new AppError("sync_busy", 409);
}
export async function addFeed(
  userId: string,
  semester: string,
  name: string,
  value: string,
) {
  const url = feedUrl(value).toString();
  const result = await database().transaction(async (tx) => {
    await lockFeeds(tx, userId);
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new AppError("unauthorized", 401);
    if (user.feedAttemptAt && Date.now() - user.feedAttemptAt.getTime() < 60000)
      throw new AppError("sync_cooldown", 429);
    const feeds = await tx
      .select()
      .from(calendarFeeds)
      .where(eq(calendarFeeds.userId, userId));
    if (feeds.length >= 5) throw new AppError("ics_full");
    if (feeds.some((feed) => feed.urlHash === hash(url)))
      throw new AppError("ics_duplicate");
    // Commit this timestamp even on a rejected download to rate-limit expensive failures.
    await tx
      .update(users)
      .set({ feedAttemptAt: new Date() })
      .where(eq(users.id, userId));
    let events: Lesson[];
    try {
      events = await parseIcs(await fetchIcs(url), semesterWindow(semester));
    } catch (error) {
      return { error: safeCode(error) };
    }
    const [feed] = await tx
      .insert(calendarFeeds)
      .values({ userId, name, url: encrypt(url), urlHash: hash(url) })
      .returning();
    await tx.insert(feedSnapshots).values({
      feedId: feed.id,
      semester,
      events,
      lastAttempt: new Date(),
      lastSuccess: new Date(),
    });
    return { id: feed.id, count: events.length };
  });
  if (result.error) throw new AppError(result.error);
  return result;
}
export async function removeFeed(userId: string, id: string) {
  await database().transaction(async (tx) => {
    await lockFeeds(tx, userId);
    const removed = await tx
      .delete(calendarFeeds)
      .where(and(eq(calendarFeeds.id, id), eq(calendarFeeds.userId, userId)))
      .returning();
    if (!removed.length) throw new AppError("not_found", 404);
  });
}
export async function synchronizeFeeds(
  userId: string,
  semester: string,
  manual = false,
) {
  return database().transaction(async (tx) => {
    await lockFeeds(tx, userId, false);
    const feeds = await tx
      .select()
      .from(calendarFeeds)
      .where(eq(calendarFeeds.userId, userId));
    if (!feeds.length) return { ok: true, count: 0 };
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) return { ok: true, count: 0 };
    if (
      user.feedAttemptAt &&
      Date.now() - user.feedAttemptAt.getTime() < (manual ? 60000 : 15 * 60000)
    )
      return manual
        ? { ok: false, error: "sync_cooldown" }
        : { ok: true, count: 0 };
    await tx
      .update(users)
      .set({ feedAttemptAt: new Date() })
      .where(eq(users.id, userId));
    let count = 0,
      error: string | null = null;
    for (const feed of feeds) {
      const where = and(
        eq(feedSnapshots.feedId, feed.id),
        eq(feedSnapshots.semester, semester),
      );
      const [old] = await tx.select().from(feedSnapshots).where(where);
      if (
        old &&
        Date.now() - old.lastAttempt.getTime() < (manual ? 60000 : 15 * 60000)
      ) {
        if (manual) error ||= "sync_cooldown";
        continue;
      }
      await tx
        .insert(feedSnapshots)
        .values({ feedId: feed.id, semester, lastAttempt: new Date() })
        .onConflictDoUpdate({
          target: [feedSnapshots.feedId, feedSnapshots.semester],
          set: { lastAttempt: new Date() },
        });
      try {
        const events = await parseIcs(
          await fetchIcs(decrypt(feed.url)),
          semesterWindow(semester),
        );
        count += events.length;
        await tx
          .update(feedSnapshots)
          .set({ events, lastSuccess: new Date(), error: null })
          .where(where);
      } catch (e) {
        const code = safeCode(e);
        error ||= code;
        await tx.update(feedSnapshots).set({ error: code }).where(where);
      }
    }
    return error ? { ok: false, error } : { ok: true, count };
  });
}
